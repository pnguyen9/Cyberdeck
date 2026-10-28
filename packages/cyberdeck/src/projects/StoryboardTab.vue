<script setup lang="ts">
import {
  blockOfContainer,
  describeCondition,
  describeStageCommand,
  flattenNodes,
  flattenStoredNodes,
  locateNode,
  moveNodes,
  nodesText,
  previewNodeEdit,
  removeNodes,
  stepNodes,
  storyboardEntries,
  indexNames,
  knownNamesForEdit,
  storyboardLevel,
  storyFlow,
  type ChapterDocument,
  type DropSlot,
  type LevelElement,
  type NodeEditTarget,
  type StoredCondition,
  type StoredNode,
  type StoryboardEntry,
} from '@cyberdeck/core'
import { createTextboxLayout, useLocale, useMessages } from '@cyberdeck/stage'
import { storyWords } from '../i18n/storyWords'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { indexMessages } from '../i18n/indexMessages'
import { storyboardMessages } from '../i18n/storyboardMessages'
import { vocabularyOf } from '../editing/tagText'
import { useEditorSettings } from '../settings/editorSettings'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { actionFor, chordDescriber, type ShortcutId } from '../shortcuts/shortcuts'
import TagTextEditor from '../editing/TagTextEditor.vue'
import { problemMessage } from '../importing/problemMessages'
import { answeredStoryboardRequests, useEditor } from './editorContext'
import { summariseUses } from './nameUses'
import { emptyLaneId, NO_SELECTION, only, rangeTo, toggle, type GridSelection, type PlacedElement } from './gridSelection'
import StoryboardGrid from './StoryboardGrid.vue'
import UnsavedQuestion from './UnsavedQuestion.vue'
import { useUnsavedChanges } from './unsavedChanges'
import StoryTree from './StoryTree.vue'

const { open, project, chapters, scenes, act, storyboardChapterId, previewFrom, storyboardRequest, openIndex, startEmptyDocument } = useEditor()
const { shortcuts, isPanelOpen } = useShortcuts()
const settings = useEditorSettings()
const locale = useLocale()
const text = useMessages(storyboardMessages)
const words = computed(() => storyWords[locale.value])
const common = useMessages(commonMessages)
const indexText = useMessages(indexMessages)
const describeChord = computed(() => chordDescriber(locale.value))
/** The first keys of an action, as shown on buttons; empty when the author removed them all. */
const keysOf = (actionId: ShortcutId) => shortcuts.value[actionId].map(describeChord.value)[0] ?? ''

const BRANCH_COLORS = ['#5eead4', '#fbbf24', '#c4b5fd', '#fda4af', '#bef264', '#93c5fd']

type EditableEntry = Extract<StoryboardEntry, { type: 'card' | 'marker' }>
type BlockElement = Extract<LevelElement, { kind: 'block' }>
/** A stop of the keyboard in the grid: an element, or the stand-in of an empty branch. */
interface GridItem extends PlacedElement {
  index: number
  element: LevelElement | null
}

/** Chapters then scenes: the storyboard shows either. */
const documents = computed(() => [...chapters.value, ...scenes.value])
const chapter = computed(() => documents.value.find(candidate => candidate.id === storyboardChapterId.value) ?? chapters.value[0] ?? scenes.value[0] ?? null)
const isScene = computed(() => chapter.value !== null && project.value.sceneOrder.includes(chapter.value.id))
const sceneNames = computed(() => new Map(scenes.value.map(scene => [scene.id, scene.title ?? ''])))
/** The grid sorts cards like slides; the tree shows each condition's branches side by side, for reading, not moving. */
const view = ref<'grid' | 'tree'>('grid')

/** The block whose branches the grid shows; null for the chapter's own level. */
const blockId = ref<string | null>(null)
/** Over the whole story: an ending in one chapter can leave the next one unread, a scene that ends what follows its plays. */
const flow = computed(() => storyFlow(chapters.value, scenes.value))
const playStops = computed(() => flow.value.playStops)
/** Nodes no path reaches. */
const unreachableIds = computed(() => flow.value.unreachableIds)
const endlessLoopIds = computed(() => flow.value.endlessLoopIds)
const chapterUnreachableCount = computed(() => chapter.value === null
  ? 0
  : flattenStoredNodes(chapter.value.nodes).filter(node => (node.type === 'page' || node.type === 'choice') && unreachableIds.value.has(node.id)).length)
const level = computed(() => chapter.value === null
  ? null
  : storyboardLevel(chapter.value, project.value, blockId.value, {
    words: words.value,
    blockPageLimit: settings.value.blockPageLimit,
    sceneNames: sceneNames.value,
    playStops: playStops.value,
    unreachableIds: unreachableIds.value,
    endlessLoopIds: endlessLoopIds.value,
  }))
const gridItems = computed<GridItem[]>(() => (level.value?.lanes ?? []).flatMap((lane): GridItem[] => lane.elements.length === 0
  ? [{ id: emptyLaneId(lane.containerId), containerId: lane.containerId, index: 0, element: null }]
  : lane.elements.map(element => ({ id: element.id, containerId: lane.containerId, index: element.index, element }))))
const itemsById = computed(() => new Map(gridItems.value.map(item => [item.id, item])))
const treeEntries = computed(() => chapter.value === null ? [] : storyboardEntries(chapter.value, project.value, { sceneNames: sceneNames.value, words: words.value }))
const entriesById = computed(() => new Map(treeEntries.value.map(entry => [entry.id, entry])))

/** Where the keyboard is: hovering an element does not select it. */
const focusedId = ref<string | null>(null)
const selection = ref<GridSelection>(NO_SELECTION)
const anchorId = ref<string | null>(null)
/** Nodes cut, waiting for Ctrl+V to put them after the focused element, at any level of the chapter. */
const cutIds = ref<readonly string[]>([])
const hint = ref<string | null>(null)
const dropTarget = ref<{ elementId: string; side: 'before' | 'after' } | null>(null)
const isDragging = ref(false)
const board = ref<HTMLElement | null>(null)
const elements = new Map<string, HTMLElement>()

/** The selection as far as it is on screen: nodes removed, or out of the level shown, drop out of it. */
const shownSelection = computed<GridSelection>(() => {
  const ids = selection.value.ids.filter(id => {
    const item = itemsById.value.get(id)
    return item !== undefined && item.element !== null && item.containerId === selection.value.containerId
  })
  return ids.length === 0 ? NO_SELECTION : { containerId: selection.value.containerId, ids }
})
const selectedIds = computed(() => new Set(shownSelection.value.ids))
const cutIdSet = computed(() => new Set(cutIds.value))

const focusedItem = computed(() => view.value === 'grid' ? itemsById.value.get(focusedId.value ?? '') ?? null : null)
const focusedEntry = computed((): EditableEntry | null => {
  if (view.value === 'tree') {
    const entry = entriesById.value.get(focusedId.value ?? '')
    return entry?.type === 'card' || entry?.type === 'marker' ? entry : null
  }
  const element = focusedItem.value?.element
  return element?.kind === 'entry' ? element.entry : null
})
const focusedBlock = computed((): BlockElement | null => focusedItem.value?.element?.kind === 'block' ? focusedItem.value.element : null)

const layout = createTextboxLayout()
/**
 * A page or marker being edited as text, or new pages being written at a slot, in the chapter it was
 * opened in, whatever the board shows meanwhile; `original` tells whether it changed.
 */
const editing = ref<{ chapterId: string; target: NodeEditTarget; text: string; original: string } | null>(null)
const isEditChanged = computed(() => editing.value !== null && editing.value.text !== editing.value.original)
const editingId = computed(() => editing.value?.target.type === 'replace' ? editing.value.target.nodeId : null)
/** What waits for the author to save or drop the changes of the edit open: nothing written is ever thrown away unasked. */
const pending = ref<{ question: string; run: () => void } | null>(null)
/** In a narrow window, the panel slides over the board from the right; wide, it is always beside it. */
const isPanelShown = ref(false)
const editor = ref<{ focus: () => void } | null>(null)
const vocabulary = computed(() => vocabularyOf(project.value, scenes.value))
/** The project's names as the edit may use them: worked out once for each edit, not on every key typed. */
const editKnownNames = computed(() => editing.value === null ? null : knownNamesForEdit(project.value, documents.value, editing.value.chapterId, editing.value.target, words.value))
const editPreview = computed(() => editing.value === null || editKnownNames.value === null
  ? null
  : previewNodeEdit(editing.value.text, project.value, documents.value, editing.value.chapterId, editing.value.target, layout, editKnownNames.value))
const editPageCount = computed(() => editPreview.value?.result.chapters.flatMap(written => flattenNodes(written.nodes)).filter(node => node.type === 'page').length ?? 0)
const canSaveEdit = computed(() => editPreview.value !== null && !editPreview.value.hasErrors && (editing.value?.target.type === 'replace' || editing.value?.text.trim() !== ''))

watch(() => chapter.value?.id, () => {
  blockId.value = null
  focusedId.value = null
  selection.value = NO_SELECTION
  anchorId.value = null
  cutIds.value = []
  hint.value = null
}, { immediate: true })

/** A block undone or removed while shown: back to the chapter. */
watch(level, current => {
  if (current === null && blockId.value !== null) {
    blockId.value = null
  }
})

/** Runs at once when the edit open has no changes; otherwise asks first, the answer coming from the panel. */
function settleEdit(question: string, run: () => void) {
  if (!isEditChanged.value) {
    run()
    return
  }
  pending.value = { question, run }
  isPanelShown.value = true
}

function openEdit(target: NodeEditTarget, text: string) {
  const current = chapter.value
  if (current === null) {
    return
  }
  pending.value = null
  editing.value = { chapterId: current.id, target, text, original: text }
  isPanelShown.value = true
  void nextTick(() => editor.value?.focus())
}

function startEditing(entry: EditableEntry) {
  if (editingId.value === entry.node.id) {
    void nextTick(() => editor.value?.focus())
    return
  }
  settleEdit(text.value.unsavedPage, () => openEdit({ type: 'replace', nodeId: entry.node.id }, nodesText(project.value, [entry.node], scenes.value)))
}

/** Right after the focused element; in an empty branch, its start; with no focus, at the end of the level's first list. */
function slotAfterFocus(): DropSlot {
  if (view.value === 'tree') {
    return entriesById.value.get(focusedId.value ?? '')?.slot ?? { containerId: null, index: chapter.value?.nodes.length ?? 0 }
  }
  const firstLane = level.value?.lanes[0]
  const item = focusedItem.value ?? gridItems.value.findLast(candidate => candidate.containerId === firstLane?.containerId) ?? null
  return item === null ? { containerId: null, index: 0 } : { containerId: item.containerId, index: item.element === null ? 0 : item.index + 1 }
}

function startAdding() {
  settleEdit(text.value.unsavedPage, () => openEdit({ type: 'insert', slot: slotAfterFocus() }, ''))
}

async function saveEdit(): Promise<boolean> {
  const current = editing.value
  const preview = editPreview.value
  if (current === null || preview === null || !canSaveEdit.value) {
    return false
  }
  const { chapterId } = current
  let nodeIds: string[] = []
  const message = current.target.type === 'insert' ? text.value.pagesAdded(editPageCount.value) : text.value.pageSaved
  if (await act(async () => {
    nodeIds = await open.editNodes(chapterId, preview, current.target)
  }, message)) {
    closeEdit()
    follow(nodeIds)
    return true
  }
  return false
}

/** Closes the edit, back on the board, on the card that was edited. */
function closeEdit(editedId = editingId.value) {
  editing.value = null
  pending.value = null
  isPanelShown.value = false
  board.value?.focus()
  if (editedId !== null) {
    reveal(editedId)
  }
}

function cancelEdit() {
  const editedId = editingId.value
  settleEdit(text.value.closeWithoutSaving, () => closeEdit(editedId))
}

async function answerSave() {
  const waiting = pending.value
  if (waiting !== null && await saveEdit()) {
    waiting.run()
  }
}

function answerDiscard() {
  const waiting = pending.value
  editing.value = null
  pending.value = null
  waiting?.run()
  if (editing.value === null) {
    board.value?.focus()
  }
}

function answerKeepEditing() {
  pending.value = null
  void nextTick(() => editor.value?.focus())
}

/** Shows a card wherever it is, inside the blocks holding it, and puts the focus on it without changing the selection. */
function reveal(nodeId: string) {
  const current = chapter.value
  const place = current === null ? null : locateNode(current, nodeId)
  if (current === null || place === null) {
    return
  }
  if (view.value === 'grid') {
    blockId.value = blockOfContainer(current, place.containerId)
  }
  focusedId.value = nodeId
  scrollToFocus()
}

/**
 * From elsewhere, to the board on the selection, or on the first element selected when there is none;
 * from the page edited, to its card; from the board, back into the page edited.
 */
function goToBoard() {
  const active = document.activeElement
  const isInEditor = editing.value !== null && active instanceof HTMLElement && active.closest('.edit') !== null
  if (editing.value !== null && active === board.value) {
    isPanelShown.value = true
    void nextTick(() => editor.value?.focus())
    return
  }
  board.value?.focus()
  if (isInEditor) {
    if (editingId.value !== null) {
      reveal(editingId.value)
    } else {
      scrollToFocus()
    }
    return
  }
  const selectedId = shownSelection.value.ids[0]
  if (selectedId !== undefined) {
    focusedId.value = selectedId
    scrollToFocus()
    return
  }
  if (view.value === 'tree') {
    focusedId.value = treeEntries.value.find(entry => entry.type === 'card' || entry.type === 'marker')?.id ?? null
  } else {
    const first = gridItems.value.find(item => item.element !== null) ?? gridItems.value[0]
    focusedId.value = first?.id ?? null
    if (first !== undefined && first.element !== null) {
      selection.value = only(first)
      anchorId.value = first.id
    }
  }
  scrollToFocus()
}

// A request made from another tab is already there when the storyboard appears: it is answered then, and only once.
/** An edit without changes closes when its card is gone, removed or undone; one with changes keeps them, to be saved as new pages. */
watch(documents, current => {
  const edited = editing.value
  if (edited === null || edited.target.type !== 'replace') {
    return
  }
  const nodeId = edited.target.nodeId
  const document = current.find(candidate => candidate.id === edited.chapterId)
  if (document === undefined || !flattenStoredNodes(document.nodes).some(node => node.id === nodeId)) {
    if (isEditChanged.value) {
      hint.value = text.value.cardGone
      editing.value = { ...edited, chapterId: chapter.value?.id ?? edited.chapterId, target: { type: 'insert', slot: slotAfterFocus() } }
    } else {
      editing.value = null
    }
  }
})

watch(storyboardRequest, request => {
  if (request === null || answeredStoryboardRequests.has(request)) {
    return
  }
  answeredStoryboardRequests.add(request)
  // Answered once the board is drawn.
  void nextTick(() => {
    if (request.kind === 'goToBoard') {
      goToBoard()
    } else if (request.kind === 'togglePanel') {
      isPanelShown.value = !isPanelShown.value
    } else if (request.nodeId !== undefined) {
      board.value?.focus()
      reveal(request.nodeId)
    }
  })
}, { immediate: true })

function onChapterPicked(event: Event) {
  const select = event.target as HTMLSelectElement
  const chosenId = select.value
  // The picker shows the chapter of the board until the author has answered.
  select.value = chapter.value?.id ?? ''
  settleEdit(text.value.unsavedPage, () => {
    editing.value = null
    storyboardChapterId.value = chosenId
  })
}

useUnsavedChanges(() => isEditChanged.value, proceed => settleEdit(text.value.unsavedPage, proceed))
onMounted(() => board.value?.focus())

/** Pages and choices can be played from; the preview finds a way there. */
function previewFocused() {
  const entry = focusedEntry.value
  if (entry?.type === 'card' && chapter.value !== null) {
    previewFrom(chapter.value.id, entry.node.id)
  }
}

function branchColor(branch: string): string | undefined {
  const letter = branch.at(-1)
  return letter === undefined ? undefined : BRANCH_COLORS[(letter.charCodeAt(0) - 97) % BRANCH_COLORS.length]
}

function registerElement(elementId: string, element: unknown) {
  if (element instanceof HTMLElement) {
    elements.set(elementId, element)
  } else {
    elements.delete(elementId)
  }
}

function scrollToFocus() {
  void nextTick(() => elements.get(focusedId.value ?? '')?.scrollIntoView({ block: 'nearest' }))
}

/** The elements of a list of the level shown, in order. */
const siblingsOf = (containerId: string | null) => gridItems.value.filter(item => item.containerId === containerId && item.element !== null)

/** Moves the focus; with `extend`, the selection runs from its anchor, or from where the focus was, to there. */
function focusOn(elementId: string, extend: boolean) {
  const previousId = focusedId.value
  focusedId.value = elementId
  const item = itemsById.value.get(elementId)
  if (extend && item !== undefined && item.element !== null) {
    const anchor = itemsById.value.get(anchorId.value ?? previousId ?? '') ?? null
    selection.value = rangeTo(anchor?.element === null ? null : anchor, item, siblingsOf(item.containerId))
    anchorId.value = anchor === null || anchor.element === null ? elementId : anchor.id
  }
  scrollToFocus()
}

/** The element in the row above or below, nearest horizontally, as laid out on the screen. */
function verticalNeighbour(fromId: string | null | undefined, candidateIds: readonly string[], direction: 1 | -1): string | undefined {
  const current = elements.get(fromId ?? '')?.getBoundingClientRect()
  if (current === undefined) {
    return undefined
  }
  const beyond = candidateIds
    .flatMap(id => {
      const rect = elements.get(id)?.getBoundingClientRect()
      return rect === undefined ? [] : [{ id, rect }]
    })
    .filter(({ rect }) => direction === 1 ? rect.top >= current.bottom - 1 : rect.bottom <= current.top + 1)
  if (beyond.length === 0) {
    return undefined
  }
  const nearest = beyond.reduce((best, candidate) => (direction === 1 ? candidate.rect.top < best.rect.top : candidate.rect.bottom > best.rect.bottom) ? candidate : best)
  const centre = current.left + current.width / 2
  const distance = (rect: DOMRect) => Math.abs(rect.left + rect.width / 2 - centre)
  return beyond
    .filter(({ rect }) => rect.top < nearest.rect.bottom && rect.bottom > nearest.rect.top)
    .reduce((best, candidate) => distance(candidate.rect) < distance(best.rect) ? candidate : best)
    .id
}

function onKeydown(event: KeyboardEvent) {
  const action = actionFor(shortcuts.value, event, 'Storyboard')
  if (action === null || action === 'showShortcuts') {
    return
  }
  event.preventDefault()
  const stops = view.value === 'grid' ? gridItems.value.map(item => item.id) : treeEntries.value.map(entry => entry.id)
  const index = stops.indexOf(focusedId.value ?? '')
  const focusSteps: Partial<Record<ShortcutId, () => string | undefined>> = {
    focusPrevious: () => stops[Math.max(0, index - 1)],
    focusNext: () => stops[Math.min(stops.length - 1, index + 1)],
    focusAbove: () => verticalNeighbour(focusedId.value, stops, -1),
    focusBelow: () => verticalNeighbour(focusedId.value, stops, 1),
    focusFirst: () => stops[0],
    focusLast: () => stops.at(-1),
  }
  const step = focusSteps[action]
  if (step !== undefined) {
    // With no focus yet, steps start from the first element; Home and End still go to their end.
    const target = index === -1 && action !== 'focusLast' ? stops[0] : step()
    if (target !== undefined) {
      focusOn(target, event.shiftKey && view.value === 'grid')
    }
    return
  }
  hint.value = null
  switch (action) {
    case 'edit':
      openTarget()
      return
    case 'addPage':
      startAdding()
      return
    case 'previewFromHere':
      previewFocused()
      return
    case 'undo':
      void undo()
      return
  }
  // The tree is for reading: what selects and moves belongs to the grid.
  if (view.value !== 'grid') {
    return
  }
  switch (action) {
    case 'toggleSelected':
      if (focusedItem.value?.element != null) {
        selection.value = toggle(shownSelection.value, focusedItem.value, siblingsOf(focusedItem.value.containerId))
        anchorId.value = focusedItem.value.id
      }
      break
    case 'selectAll': {
      const containerId = (focusedItem.value ?? gridItems.value[0])?.containerId ?? null
      selection.value = { containerId, ids: siblingsOf(containerId).map(item => item.id) }
      break
    }
    case 'moveSelectionBack':
    case 'moveSelectionForward':
      void stepSelection(action === 'moveSelectionBack' ? -1 : 1)
      break
    case 'moveSelectionUp':
    case 'moveSelectionDown':
      void moveSelectionVertically(action === 'moveSelectionUp' ? -1 : 1)
      break
    case 'cut':
      cutSelection()
      break
    case 'paste':
      void paste()
      break
    case 'leave':
      leave()
      break
    case 'remove':
      if (shownSelection.value.ids.length > 0) {
        void removeSelected()
      }
      break
  }
}

/** Enter: the focused element, where the eyes are, when at most one is selected; several selected open nothing. */
function openTarget() {
  if (view.value === 'tree') {
    if (focusedEntry.value !== null) {
      startEditing(focusedEntry.value)
    }
    return
  }
  const ids = shownSelection.value.ids
  if (ids.length > 1) {
    hint.value = text.value.severalSelected(ids.length)
    return
  }
  openElement(focusedId.value ?? ids[0])
}

function openElement(elementId: string | null | undefined) {
  const item = itemsById.value.get(elementId ?? '')
  if (item === undefined) {
    return
  }
  focusedId.value = item.id
  if (item.element === null) {
    startAdding()
  } else if (item.element.kind === 'block') {
    showLevel(item.element.id, null)
  } else {
    startEditing(item.element.entry)
  }
}

/** Shows the level inside a block, or the chapter's for null, focusing an element of it: its first one by default. */
function showLevel(targetBlockId: string | null, focusId: string | null) {
  blockId.value = targetBlockId
  selection.value = NO_SELECTION
  anchorId.value = null
  focusedId.value = focusId ?? gridItems.value[0]?.id ?? null
  board.value?.focus()
  scrollToFocus()
}

/** Up to a level of the path, focusing the block the way down went through. */
function goTo(targetBlockId: string | null) {
  const pathIds = level.value?.path.map(entry => entry.id) ?? []
  const childIndex = targetBlockId === null ? 0 : pathIds.indexOf(targetBlockId) + 1
  showLevel(targetBlockId, pathIds[childIndex] ?? null)
}

/** Escape: lets go of the selection; with none, leaves the block; at the chapter's level, forgets what was cut. */
function leave() {
  if (shownSelection.value.ids.length > 0) {
    selection.value = NO_SELECTION
  } else if (level.value !== null && level.value.path.length > 0) {
    goTo(level.value.path.at(-2)?.id ?? null)
  } else {
    cutIds.value = []
  }
}

/** Shows the level holding the nodes and selects them, after they moved or were written. */
function follow(nodeIds: readonly string[]) {
  const current = chapter.value
  const place = current === null || nodeIds[0] === undefined ? null : locateNode(current, nodeIds[0])
  if (current === null || place === null) {
    return
  }
  if (view.value === 'grid') {
    blockId.value = blockOfContainer(current, place.containerId)
  }
  selection.value = { containerId: place.containerId, ids: nodeIds.filter(nodeId => locateNode(current, nodeId)?.containerId === place.containerId) }
  focusedId.value = nodeIds[0]!
  anchorId.value = nodeIds[0]!
  scrollToFocus()
}

/** Applies a move to the chapter shown, then follows the nodes moved; false when the move changes nothing. */
async function applyMove(nodeIds: readonly string[], transform: (current: ChapterDocument, now: string) => ChapterDocument, successMessage?: string): Promise<boolean> {
  const current = chapter.value
  if (current === null || nodeIds.length === 0) {
    return false
  }
  if (isEditChanged.value) {
    settleEdit(text.value.unsavedBeforeMoving, () => void applyMove(nodeIds, transform, successMessage))
    return false
  }
  const moved = transform(current, new Date().toISOString())
  if (moved === current) {
    return false
  }
  if (!await act(() => open.replaceChapter(moved), successMessage)) {
    return false
  }
  follow(nodeIds)
  return true
}

const moveTo = (nodeIds: readonly string[], slot: DropSlot, successMessage?: string) =>
  applyMove(nodeIds, (current, now) => moveNodes(current, nodeIds, slot, now), successMessage)

/** One place back or forth; past the start or end of a branch, out of the block. */
async function stepSelection(direction: -1 | 1) {
  const ids = shownSelection.value.ids
  await applyMove(ids, (current, now) => stepNodes(current, ids, direction, now))
}

/** To the place of the element in the row above or below, which may be in the next branch. */
async function moveSelectionVertically(direction: -1 | 1) {
  const { containerId, ids } = shownSelection.value
  const targetId = verticalNeighbour(direction === 1 ? ids.at(-1) : ids[0], gridItems.value.filter(item => !ids.includes(item.id)).map(item => item.id), direction)
  const target = itemsById.value.get(targetId ?? '')
  if (target === undefined) {
    return
  }
  const index = target.element === null ? 0 : target.index + (direction === 1 && target.containerId === containerId ? 1 : 0)
  await moveTo(ids, { containerId: target.containerId, index })
}

function cutSelection() {
  const ids = shownSelection.value.ids
  if (ids.length === 0) {
    return
  }
  cutIds.value = ids
  selection.value = NO_SELECTION
  hint.value = text.value.cut(ids.length, keysOf('paste'))
}

async function paste() {
  const ids = cutIds.value
  if (ids.length === 0) {
    return
  }
  if (await moveTo(ids, slotAfterFocus())) {
    cutIds.value = []
  } else {
    hint.value = text.value.nothingMoved
  }
}

async function removeSelected() {
  if (isEditChanged.value) {
    settleEdit(text.value.unsavedBeforeRemoving, () => void removeSelected())
    return
  }
  const { ids } = shownSelection.value
  const first = itemsById.value.get(ids[0] ?? '')
  const count = ids.length
  const current = chapter.value
  if (first === undefined || current === null) {
    return
  }
  // Definitions removed stay declared, in the project's definitions.
  const definitionCount = flattenStoredNodes(flattenStoredNodes(current.nodes).filter(node => ids.includes(node.id))).filter(node => node.type === 'definition').length
  await act(() => open.replaceChapter(removeNodes(current, ids, new Date().toISOString())), text.value.removed(count, definitionCount))
  selection.value = NO_SELECTION
  const lane = gridItems.value.filter(item => item.containerId === first.containerId)
  focusedId.value = (lane.find(item => item.element === null || item.index >= first.index) ?? lane.at(-1))?.id ?? null
  scrollToFocus()
}

async function moveToDefinitions(nodeId: string) {
  const current = chapter.value
  if (current !== null) {
    await act(() => open.moveToDefinitions(current.id, nodeId), text.value.movedToDefinitions)
  }
}

async function undo() {
  if (isEditChanged.value) {
    settleEdit(text.value.unsavedBeforeUndoing, () => void undo())
    return
  }
  await act(async () => {
    const chapterId = await open.undo()
    if (chapterId !== null) {
      storyboardChapterId.value = chapterId
    }
  }, open.canUndo ? text.value.undone : text.value.undoneLast)
}

function onPick(elementId: string, event: MouseEvent) {
  board.value?.focus()
  isPanelShown.value = true
  hint.value = null
  focusedId.value = elementId
  const item = itemsById.value.get(elementId)
  if (view.value === 'tree' || item === undefined || item.element === null) {
    return
  }
  if (event.shiftKey) {
    selection.value = rangeTo(itemsById.value.get(anchorId.value ?? '') ?? null, item, siblingsOf(item.containerId))
    return
  }
  selection.value = event.ctrlKey || event.metaKey ? toggle(shownSelection.value, item, siblingsOf(item.containerId)) : only(item)
  anchorId.value = elementId
}

function startDrag(elementId: string, event: DragEvent) {
  const item = itemsById.value.get(elementId)
  if (item === undefined || item.element === null) {
    return
  }
  if (!selectedIds.value.has(elementId)) {
    selection.value = only(item)
    anchorId.value = elementId
  }
  focusedId.value = elementId
  isDragging.value = true
  event.dataTransfer?.setData('text/plain', text.value.draggedEntries(shownSelection.value.ids.length))
  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function dragOver(elementId: string, event: DragEvent) {
  if (!isDragging.value) {
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropTarget.value = { elementId, side: event.clientX < rect.left + rect.width / 2 ? 'before' : 'after' }
}

/** Over the empty end of a list, nodes go after its last element. */
function dragOverBoard(event: DragEvent) {
  if (!isDragging.value || level.value === null) {
    return
  }
  const laneElement = event.target instanceof Element ? event.target.closest('[data-lane]') : null
  const lane = level.value.lanes[laneElement === null ? level.value.lanes.length - 1 : Number(laneElement.getAttribute('data-lane'))]
  if (lane !== undefined) {
    const last = lane.elements.at(-1)
    dropTarget.value = last === undefined ? { elementId: emptyLaneId(lane.containerId), side: 'before' } : { elementId: last.id, side: 'after' }
  }
}

async function drop() {
  const target = dropTarget.value
  endDrag()
  const item = itemsById.value.get(target?.elementId ?? '')
  if (target === null || item === undefined) {
    return
  }
  const index = item.element === null ? 0 : item.index + (target.side === 'after' ? 1 : 0)
  await moveTo(shownSelection.value.ids, { containerId: item.containerId, index })
}

/** Dropped on a level of the path: the nodes go there, right after the block they came out of. */
async function dropOnPath(pathIndex: number) {
  endDrag()
  const passedBlock = level.value?.path[pathIndex]
  const place = passedBlock === undefined || chapter.value === null ? null : locateNode(chapter.value, passedBlock.id)
  if (place !== null) {
    await moveTo(shownSelection.value.ids, { containerId: place.containerId, index: place.index + 1 })
  }
}

function endDrag() {
  isDragging.value = false
  dropTarget.value = null
}

function stagingOf(entry: EditableEntry): string[] {
  if (entry.type !== 'card' || entry.node.type !== 'page') {
    return []
  }
  const page = entry.node
  return [
    ...page.commandsBefore.map(command => describeStageCommand(command, project.value)),
    ...page.inlineCommands.map(command => text.value.inlineStaging(describeStageCommand(command, project.value), page.text.slice(Math.max(0, command.offset - 24), command.offset))),
  ]
}

/**
 * The decisions and memories the cards on screen use: the whole chapter's, or in the grid, those
 * inside the block opened; a chapter's own `[only if]` counts at its level.
 */
const namesInView = computed(() => {
  const current = chapter.value
  if (current === null) {
    return []
  }
  const block = view.value === 'grid' && blockId.value !== null ? flattenStoredNodes(current.nodes).find(node => node.id === blockId.value) : undefined
  const nodeIds = new Set(flattenStoredNodes(block === undefined ? current.nodes : [block]).map(node => node.id))
  return indexNames(project.value, [current])
    .filter(name => name.kind === 'decision' || name.kind === 'memory')
    .map(name => ({ name, uses: name.uses.filter(entry => entry.nodeId === null ? block === undefined : nodeIds.has(entry.nodeId)) }))
    .filter(entry => entry.uses.length > 0)
})
const isInViewOpen = ref(true)

/** Names by identifier, looked up for every card the grid draws. */
const characterNames = computed(() => new Map(project.value.characters.map(character => [character.id, character.name])))
const decisionsById = computed(() => new Map(project.value.decisions.map(decision => [decision.id, decision])))
const speakerName = (speakerId: string | null) => speakerId === null ? null : characterNames.value.get(speakerId) ?? null
const conditionText = (condition: StoredCondition) => describeCondition(condition, project.value)
const decisionName = (decisionId: string) => decisionsById.value.get(decisionId)?.name ?? '?'
const valueName = (decisionId: string, valueId: string) => decisionsById.value.get(decisionId)?.values.find(value => value.id === valueId)?.name ?? '?'
const pagesWord = (count: number) => common.value.pageCount(count)
const branchPageCount = (lane: BlockElement['branches'][number], block: BlockElement) => {
  const branch = block.node.type === 'condition' ? block.node.branches.find(candidate => candidate.id === lane.containerId) : block.node
  return branch === undefined ? 0 : flattenStoredNodes(branch.nodes).filter(node => node.type === 'page' || node.type === 'choice').length
}
</script>

<template>
  <section class="storyboard">
    <p v-if="chapter === null" class="muted">
      {{ text.noChapters }}
      <button class="button small" @click="startEmptyDocument('chapter')">{{ text.startChapter }}</button>
    </p>
    <template v-else>
      <div class="toolbar">
        <label class="field chapter-picker">
          <span>{{ isScene ? text.scene : text.chapter }}</span>
          <select class="text-input" :value="chapter.id" @change="onChapterPicked">
            <optgroup :label="text.chapters">
              <option v-for="candidate in chapters" :key="candidate.id" :value="candidate.id">{{ candidate.title ?? common.untitledChapter }}</option>
            </optgroup>
            <optgroup v-if="scenes.length > 0" :label="text.scenes">
              <option v-for="candidate in scenes" :key="candidate.id" :value="candidate.id">{{ candidate.title }}</option>
            </optgroup>
          </select>
        </label>
        <div class="view-switch" role="group" :aria-label="text.view">
          <button class="button small" :class="{ primary: view === 'grid' }" :aria-pressed="view === 'grid'" @click="view = 'grid'">{{ text.grid }}</button>
          <button class="button small" :class="{ primary: view === 'tree' }" :aria-pressed="view === 'tree'" @click="view = 'tree'">{{ text.tree }}</button>
        </div>
        <label class="field block-limit" :class="{ unused: view !== 'grid' }" :inert="view !== 'grid'" :title="text.blockLimitTitle">
          <span>{{ text.blockLimit }}</span>
          <input v-model.number="settings.blockPageLimit" class="text-input" type="number" min="1" max="99" step="1" :aria-label="text.blockLimitLabel">
        </label>
        <p class="muted keys">
          <template v-if="view === 'grid'">
            {{ text.gridKeys({
              select: keysOf('toggleSelected'),
              back: keysOf('moveSelectionBack'),
              forward: keysOf('moveSelectionForward'),
              cut: keysOf('cut'),
              paste: keysOf('paste'),
              edit: keysOf('edit'),
              leave: keysOf('leave'),
            }) }}
          </template>
          <template v-else>{{ text.treeKeys(keysOf('edit')) }}</template>
          {{ text.addAndPreviewKeys(keysOf('addPage'), keysOf('previewFromHere')) }}
          <button class="link-button" @click="isPanelOpen = true">{{ text.allShortcuts }} <kbd>{{ keysOf('showShortcuts') }}</kbd></button>
        </p>
      </div>

      <p v-if="chapter.condition !== undefined" class="only-if">{{ text.playedOnlyIf(conditionText(chapter.condition)) }}</p>
      <p v-if="chapterUnreachableCount > 0" class="warning" role="note">
        {{ text.chapterUnreached(chapterUnreachableCount) }}
      </p>
      <div class="layout">
        <div
          ref="board"
          class="board"
          :class="{ tree: view === 'tree' }"
          tabindex="0"
          role="listbox"
          :aria-label="text.storyboard"
          aria-multiselectable="true"
          :aria-activedescendant="focusedId === null ? undefined : `${view === 'grid' ? 'element' : 'entry'}-${focusedId}`"
          @keydown="onKeydown"
          @dragover.prevent="dragOverBoard"
          @drop.prevent="drop"
        >
          <StoryTree
            v-if="view === 'tree'"
            :nodes="chapter.nodes"
            :entries-by-id="entriesById"
            :focused-id="focusedId"
            :selected-ids="selectedIds"
            :editing-id="editingId"
            :unreachable-ids="unreachableIds"
            :register="registerElement"
            :speaker-name="speakerName"
            :decision-name="decisionName"
            :condition-text="conditionText"
            :branch-color="branchColor"
            @pick="onPick"
          />
          <StoryboardGrid
            v-else-if="level !== null"
            :level="level"
            :chapter-title="isScene ? common.sceneLabel(`${chapter.title}`) : chapter.title ?? common.untitledChapter"
            :focused-id="focusedId"
            :selected-ids="selectedIds"
            :editing-id="editingId"
            :cut-ids="cutIdSet"
            :drop-target="dropTarget"
            :register="registerElement"
            :branch-color="branchColor"
            :speaker-name="speakerName"
            :decision-name="decisionName"
            :condition-text="conditionText"
            @pick="onPick"
            @open="openElement"
            @drag-start="startDrag"
            @drag-over="dragOver"
            @drop="drop"
            @drag-end="endDrag"
            @go-to="goTo"
            @drop-on-path="dropOnPath"
          />
        </div>

        <button
          class="panel-handle"
          :class="{ shown: isPanelShown }"
          :aria-expanded="isPanelShown"
          :title="text.togglePanel(isPanelShown, keysOf('togglePanel'))"
          @click="isPanelShown = !isPanelShown"
        >
          {{ isPanelShown ? '▸' : '◂' }}<span v-if="editing !== null" class="handle-mark" :aria-label="text.pageBeingEdited">✎</span>
        </button>
        <aside class="inspector" :class="{ shown: isPanelShown }" aria-live="polite">
          <UnsavedQuestion
            v-if="pending !== null"
            :question="pending.question"
            :can-save="canSaveEdit"
            :cannot-save-reason="text.cannotSaveEdit"
            @save="answerSave"
            @discard="answerDiscard"
            @keep="answerKeepEditing"
          />
          <div v-if="editing !== null" class="edit">
            <h3>{{ editing.target.type === 'insert' ? text.newPages : text.edit }}<span v-if="isEditChanged" class="changed" :title="text.notSavedYet"> ●</span></h3>
            <TagTextEditor
              ref="editor"
              v-model="editing.text"
              :vocabulary="vocabulary"
              :layout="layout"
              :label="text.pageText"
              :placeholder="text.pagePlaceholder"
              @submit="saveEdit"
              @cancel="cancelEdit"
            />
            <ul v-if="editPreview !== null && editPreview.problems.length > 0" class="problems">
              <li v-for="(problem, index) in editPreview.problems" :key="index" :class="problem.severity">{{ problemMessage(problem, locale) }}</li>
            </ul>
            <p v-else-if="editPageCount > 1" class="muted">{{ text.becomesPages(editPageCount) }}</p>
            <div class="edit-actions">
              <button class="button primary small" :disabled="!canSaveEdit" @click="saveEdit">{{ common.save }} <kbd>{{ keysOf('save') }}</kbd></button>
              <button class="button small" @click="cancelEdit">{{ common.cancel }} <kbd>{{ keysOf('cancel') }}</kbd></button>
            </div>
          </div>
          <template v-else-if="focusedEntry?.type === 'card' && focusedEntry.node.type === 'page'">
            <h3>{{ text.pageHeading(focusedEntry.number, focusedEntry.node.kind) }}</h3>
            <p v-if="speakerName(focusedEntry.node.speakerId) !== null" class="speaker">{{ speakerName(focusedEntry.node.speakerId) }}</p>
            <p class="full-text">{{ focusedEntry.node.text }}</p>
            <template v-if="stagingOf(focusedEntry).length > 0">
              <h4>{{ text.staging }}</h4>
              <ul>
                <li v-for="line in stagingOf(focusedEntry)" :key="line">{{ line }}</li>
              </ul>
            </template>
          </template>
          <template v-else-if="focusedEntry?.type === 'card' && focusedEntry.node.type === 'choice'">
            <h3>{{ text.choiceHeading(focusedEntry.number, decisionName(focusedEntry.node.decisionId)) }}</h3>
            <ul>
              <li v-for="option in focusedEntry.node.options" :key="option.id">
                {{ option.text }} → {{ valueName(focusedEntry.node.decisionId, option.valueId) }}<span v-if="option.condition !== null" class="muted">{{ text.offeredOnlyIf(conditionText(option.condition)) }}</span>
              </li>
            </ul>
          </template>
          <template v-else-if="focusedEntry?.type === 'marker' && focusedEntry.node.type === 'definition'">
            <h3>{{ text.declaredHere }}</h3>
            <p class="full-text">{{ focusedEntry.text }}</p>
            <p class="muted">{{ text.definitionHelp }}</p>
            <button class="button small" @click="moveToDefinitions(focusedEntry.node.id)">{{ text.moveToDefinitions }}</button>
          </template>
          <p v-else-if="focusedEntry?.type === 'marker'" class="muted">{{ text.marker(text.markerKinds[focusedEntry.node.type], focusedEntry.text) }}</p>
          <template v-else-if="focusedBlock?.node.type === 'loop'">
            <h3>{{ text.loopHeading(focusedBlock.numbers, pagesWord(focusedBlock.pageCount)) }}</h3>
            <p class="muted">{{ text.loopHelp }}</p>
            <p v-if="focusedBlock.isEndless" class="warning">{{ text.endlessLoop }}</p>
            <p class="muted">{{ text.loopMovesAsOne }}</p>
          </template>
          <template v-else-if="focusedBlock !== null && focusedBlock.node.type === 'condition'">
            <h3>{{ text.blockHeading(focusedBlock.numbers, pagesWord(focusedBlock.pageCount)) }}</h3>
            <ul>
              <li v-for="lane in focusedBlock.branches" :key="lane.containerId ?? ''">{{ text.branchPages(lane.text ?? '', pagesWord(branchPageCount(lane, focusedBlock))) }}</li>
            </ul>
            <p v-if="focusedBlock.allRoutesEnd" class="muted">{{ text.everyRouteEndsInside }}</p>
            <p v-else-if="focusedBlock.endingRouteCount > 0" class="muted">{{ text.someRoutesEndInside(focusedBlock.endingRouteCount, focusedBlock.branches.length) }}</p>
            <p class="muted">{{ text.blockMovesAsOne }}</p>
          </template>
          <p v-else-if="focusedItem?.element === null" class="muted">{{ text.emptyBranch }}</p>
          <p v-else class="muted">{{ text.selectACard }}</p>
          <p v-if="editing === null && focusedId !== null && unreachableIds.has(focusedId)" class="warning">
            {{ text.cardUnreached }}
          </p>
          <p v-if="shownSelection.ids.length > 1" class="muted">{{ text.selectedCount(shownSelection.ids.length) }}</p>
          <p v-if="hint !== null" class="hint" role="status">{{ hint }}</p>
          <details v-if="namesInView.length > 0" class="in-view" :open="isInViewOpen" @toggle="isInViewOpen = ($event.target as HTMLDetailsElement).open">
            <summary>{{ text.inThisView(namesInView.length) }}</summary>
            <ul>
              <li v-for="entry in namesInView" :key="`${entry.name.kind}:${entry.name.id}`">
                <button class="link-button name-link" :title="text.everyPlaceInIndex(indexText.kindLabels[entry.name.kind])" @click="openIndex(entry.name.kind, entry.name.id)">{{ entry.name.name }}</button>
                <span class="muted uses-text">{{ entry.name.kind === 'memory' ? text.memoryPrefix : '' }}{{ summariseUses(entry.name, entry.uses, project, locale) }}</span>
              </li>
            </ul>
          </details>
          <div v-if="editing === null" class="inspector-actions">
            <button v-if="focusedEntry !== null" class="button small" @click="startEditing(focusedEntry)">{{ text.editCard }} <kbd>{{ keysOf('edit') }}</kbd></button>
            <button v-if="focusedBlock !== null" class="button small" @click="openElement(focusedBlock.id)">{{ text.openBlock }} <kbd>{{ keysOf('edit') }}</kbd></button>
            <button v-if="focusedEntry?.type === 'card'" class="button small" @click="previewFocused">{{ text.previewFromHere }} <kbd>{{ keysOf('previewFromHere') }}</kbd></button>
            <button class="button small" @click="startAdding">{{ chapter.nodes.length === 0 ? text.writeFirstPage : focusedItem?.element === null ? text.writePageHere : text.addPageAfter }} <kbd>{{ keysOf('addPage') }}</kbd></button>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 24px;
  margin-bottom: 16px;
}

.view-switch {
  display: flex;
  gap: 4px;
}

.board.tree {
  display: block;
  overflow-x: auto;
}

.block-limit input {
  width: 64px;
}

/* Kept in its place, unseen, so that switching views never moves the switch from under the pointer. */
.block-limit.unused {
  visibility: hidden;
}

.chapter-picker {
  min-width: 260px;
}

.keys {
  flex-basis: 100%;
  margin: 0;
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 1000px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
}

.board {
  min-height: 200px;
  padding: 12px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  outline: none;
}

.board:focus-visible {
  border-color: #9eeaff;
}

.inspector {
  align-self: start;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
  overflow-wrap: anywhere;
}

/* Wide, the panel stays beside the board and follows the scroll; its handle is not needed. */
@media (min-width: 1000px) {
  .inspector {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 24px);
    overflow-y: auto;
  }

  .panel-handle {
    display: none;
  }
}

/* Narrow, the panel slides over the board from the right edge of the window, the same panel. */
@media (max-width: 999px) {
  /* Stretched between the edges: aligned at the start, a fixed box would shrink to its content. */
  .inspector {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    align-self: stretch;
    z-index: 20;
    box-sizing: border-box;
    width: min(380px, calc(100vw - 48px));
    overflow-y: auto;
    border-left: 1px solid #2c3442;
    border-radius: 0;
    box-shadow: -8px 0 24px rgb(0 0 0 / 0.45);
    transform: translateX(100%);
    visibility: hidden;
    transition: transform 0.2s ease, visibility 0s linear 0.2s;
  }

  .inspector.shown {
    transform: none;
    visibility: visible;
    transition: transform 0.2s ease;
  }

  .panel-handle {
    position: fixed;
    top: 50%;
    right: 0;
    z-index: 21;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 6px;
    border: 1px solid #2c3442;
    border-right: 0;
    border-radius: 8px 0 0 8px;
    background: #11151d;
    font: inherit;
    color: #9eeaff;
    cursor: pointer;
    transform: translateY(-50%);
    transition: right 0.2s ease;
  }

  .panel-handle.shown {
    right: min(380px, calc(100vw - 48px));
  }
}

.in-view {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid #2c3442;
  font-size: 14px;
}

.in-view summary {
  font-weight: 600;
  color: #a3acbb;
  cursor: pointer;
}

.in-view ul {
  margin-top: 6px;
  padding-left: 0;
  list-style: none;
}

.in-view li {
  margin: 4px 0;
}

.name-link {
  font-size: 14px;
  color: #9eeaff;
}

.uses-text {
  margin-left: 0.4em;
}

.handle-mark {
  color: #f5c451;
}

.changed {
  color: #f5c451;
}

.inspector h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.inspector h4 {
  margin: 12px 0 4px;
  font-size: 13px;
  color: #7b8597;
}

.inspector ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}

.hint {
  color: #9eeaff;
}

.warning {
  color: #f6c177;
}

.only-if {
  margin: 0 0 12px;
  color: #fbbf24;
}

.full-text {
  font: 16px/1.5 Georgia, serif;
}

.edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-actions,
.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.problems {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}


kbd {
  margin-left: 4px;
  font: 11px/1 system-ui, sans-serif;
  color: #7b8597;
}
</style>
