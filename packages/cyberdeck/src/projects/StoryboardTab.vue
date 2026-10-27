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
  storyboardLevel,
  alwaysStops,
  readingFlow,
  type ChapterDocument,
  type DropSlot,
  type LevelElement,
  type NodeEditTarget,
  type StoredCondition,
  type StoredNode,
  type StoryboardEntry,
} from '@cyberdeck/core'
import { createTextboxLayout } from '@cyberdeck/stage'
import { computed, nextTick, ref, watch } from 'vue'
import { vocabularyOf } from '../editing/tagText'
import { useEditorSettings } from '../settings/editorSettings'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { actionFor, describeChord, type ShortcutId } from '../shortcuts/shortcuts'
import TagTextEditor from '../editing/TagTextEditor.vue'
import { problemMessage } from '../importing/problemMessages'
import { useEditor } from './editorContext'
import { emptyLaneId, NO_SELECTION, only, rangeTo, toggle, type GridSelection, type PlacedElement } from './gridSelection'
import StoryboardGrid from './StoryboardGrid.vue'
import StoryTree from './StoryTree.vue'

const { open, project, chapters, scenes, act, storyboardChapterId, previewFrom } = useEditor()
const { shortcuts, isPanelOpen } = useShortcuts()
const settings = useEditorSettings()
/** The first keys of an action, as shown on buttons; empty when the author removed them all. */
const keysOf = (actionId: ShortcutId) => shortcuts.value[actionId].map(describeChord)[0] ?? ''

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
/** Whether a play never comes back, its scene always ending. */
const playStops = computed(() => {
  const scenesById = new Map(scenes.value.map(scene => [scene.id, scene]))
  const stopsById = new Map<string, boolean>()
  const stops = (play: StoredNode): boolean => {
    const sceneId = play.type === 'play' ? play.sceneId : ''
    if (!stopsById.has(sceneId)) {
      // The import refuses scenes playing themselves; were one there, it is taken to come back.
      stopsById.set(sceneId, false)
      const scene = scenesById.get(sceneId)
      stopsById.set(sceneId, scene !== undefined && alwaysStops(scene.nodes, stops))
    }
    return stopsById.get(sceneId)!
  }
  return stops
})
/** Over the whole story: an ending in one chapter can leave the next one unread, a scene that ends what follows its plays. */
const flow = computed(() => readingFlow(chapters.value.map(candidate => candidate.nodes), {
  scenes: scenes.value.map(scene => scene.nodes),
  playStops: playStops.value,
  conditionalChapters: new Set(chapters.value.flatMap((candidate, index) => candidate.condition === undefined ? [] : [index])),
}))
/** Nodes no path reaches. */
const unreachableIds = computed(() => new Set([...flow.value.unreachable].map(node => node.id)))
const endlessLoopIds = computed(() => new Set([...flow.value.endlessLoops].map(node => node.id)))
const chapterUnreachableCount = computed(() => chapter.value === null
  ? 0
  : flattenStoredNodes(chapter.value.nodes).filter(node => (node.type === 'page' || node.type === 'choice') && unreachableIds.value.has(node.id)).length)
const level = computed(() => chapter.value === null
  ? null
  : storyboardLevel(chapter.value, project.value, blockId.value, {
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
const treeEntries = computed(() => chapter.value === null ? [] : storyboardEntries(chapter.value, project.value, { sceneNames: sceneNames.value }))
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
/** A page or marker being edited as text, or new pages being written at a slot. */
const editing = ref<{ target: NodeEditTarget; text: string } | null>(null)
const editor = ref<{ focus: () => void } | null>(null)
const vocabulary = computed(() => vocabularyOf(project.value, scenes.value))
const editPreview = computed(() => editing.value === null || chapter.value === null
  ? null
  : previewNodeEdit(editing.value.text, project.value, documents.value, chapter.value.id, editing.value.target, layout))
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

function startEditing(entry: EditableEntry) {
  editing.value = { target: { type: 'replace', nodeId: entry.node.id }, text: nodesText(project.value, [entry.node], scenes.value) }
  void nextTick(() => editor.value?.focus())
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
  editing.value = { target: { type: 'insert', slot: slotAfterFocus() }, text: '' }
  void nextTick(() => editor.value?.focus())
}

async function saveEdit() {
  const current = editing.value
  const preview = editPreview.value
  if (current === null || preview === null || chapter.value === null || !canSaveEdit.value) {
    return
  }
  const chapterId = chapter.value.id
  let nodeIds: string[] = []
  const message = current.target.type === 'insert'
    ? `${editPageCount.value} ${editPageCount.value === 1 ? 'page' : 'pages'} added. Ctrl+Z takes ${editPageCount.value === 1 ? 'it' : 'them'} out.`
    : 'Saved. Ctrl+Z puts the old text back.'
  if (await act(async () => {
    nodeIds = await open.editNodes(chapterId, preview, current.target)
  }, message)) {
    editing.value = null
    follow(nodeIds)
    board.value?.focus()
  }
}

function cancelEdit() {
  editing.value = null
  board.value?.focus()
}

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
    hint.value = `${ids.length} selected: Enter opens one at a time.`
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
  hint.value = `${ids.length} cut: focus where ${ids.length === 1 ? 'it goes' : 'they go'}, in this level or another, then ${keysOf('paste')}.`
}

async function paste() {
  const ids = cutIds.value
  if (ids.length === 0) {
    return
  }
  if (await moveTo(ids, slotAfterFocus())) {
    cutIds.value = []
  } else {
    hint.value = 'Nothing moved: a block cannot go inside itself.'
  }
}

async function removeSelected() {
  const { ids } = shownSelection.value
  const first = itemsById.value.get(ids[0] ?? '')
  const count = ids.length
  const current = chapter.value
  if (first === undefined || current === null) {
    return
  }
  await act(() => open.replaceChapter(removeNodes(current, ids, new Date().toISOString())), `${count} ${count === 1 ? 'entry' : 'entries'} removed. Ctrl+Z puts ${count === 1 ? 'it' : 'them'} back.`)
  selection.value = NO_SELECTION
  const lane = gridItems.value.filter(item => item.containerId === first.containerId)
  focusedId.value = (lane.find(item => item.element === null || item.index >= first.index) ?? lane.at(-1))?.id ?? null
  scrollToFocus()
}

async function undo() {
  await act(async () => {
    const chapterId = await open.undo()
    if (chapterId !== null) {
      storyboardChapterId.value = chapterId
    }
  }, open.canUndo ? 'Undone.' : 'Undone. Nothing more to undo.')
}

function onPick(elementId: string, event: MouseEvent) {
  board.value?.focus()
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
  event.dataTransfer?.setData('text/plain', `${shownSelection.value.ids.length} storyboard entries`)
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
    ...page.inlineCommands.map(command => `${describeStageCommand(command, project.value)}, after “…${page.text.slice(Math.max(0, command.offset - 24), command.offset)}”`),
  ]
}

/** Names by identifier, looked up for every card the grid draws. */
const characterNames = computed(() => new Map(project.value.characters.map(character => [character.id, character.name])))
const decisionsById = computed(() => new Map(project.value.decisions.map(decision => [decision.id, decision])))
const speakerName = (speakerId: string | null) => speakerId === null ? null : characterNames.value.get(speakerId) ?? null
const conditionText = (condition: StoredCondition) => describeCondition(condition, project.value)
const decisionName = (decisionId: string) => decisionsById.value.get(decisionId)?.name ?? '?'
const valueName = (decisionId: string, valueId: string) => decisionsById.value.get(decisionId)?.values.find(value => value.id === valueId)?.name ?? '?'
const pagesWord = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`
const branchPageCount = (lane: BlockElement['branches'][number], block: BlockElement) => {
  const branch = block.node.type === 'condition' ? block.node.branches.find(candidate => candidate.id === lane.containerId) : block.node
  return branch === undefined ? 0 : flattenStoredNodes(branch.nodes).filter(node => node.type === 'page' || node.type === 'choice').length
}
</script>

<template>
  <section class="storyboard">
    <p v-if="chapter === null" class="muted">No chapters yet: import a text first.</p>
    <template v-else>
      <div class="toolbar">
        <label class="field chapter-picker">
          <span>{{ isScene ? 'Scene' : 'Chapter' }}</span>
          <select class="text-input" :value="chapter.id" @change="storyboardChapterId = ($event.target as HTMLSelectElement).value">
            <optgroup label="Chapters">
              <option v-for="candidate in chapters" :key="candidate.id" :value="candidate.id">{{ candidate.title ?? 'Untitled chapter' }}</option>
            </optgroup>
            <optgroup v-if="scenes.length > 0" label="Scenes">
              <option v-for="candidate in scenes" :key="candidate.id" :value="candidate.id">{{ candidate.title }}</option>
            </optgroup>
          </select>
        </label>
        <div class="view-switch" role="group" aria-label="View">
          <button class="button small" :class="{ primary: view === 'grid' }" :aria-pressed="view === 'grid'" @click="view = 'grid'">Grid</button>
          <button class="button small" :class="{ primary: view === 'tree' }" :aria-pressed="view === 'tree'" @click="view = 'tree'">Tree</button>
        </div>
        <label class="field block-limit" :class="{ unused: view !== 'grid' }" :inert="view !== 'grid'" title="Blocks with more pages show as one card; Enter opens them">
          <span>Block as one card above</span>
          <input v-model.number="settings.blockPageLimit" class="text-input" type="number" min="1" max="99" step="1" aria-label="Pages above which a block shows as one card">
        </label>
        <p class="muted keys">
          <template v-if="view === 'grid'">
            {{ keysOf('toggleSelected') }} selects · drag, or {{ keysOf('moveSelectionBack') }} / {{ keysOf('moveSelectionForward') }}, moves ·
            {{ keysOf('cut') }} / {{ keysOf('paste') }} move between levels · {{ keysOf('edit') }} edits or opens a block · {{ keysOf('leave') }} leaves it ·
          </template>
          <template v-else>{{ keysOf('edit') }} edits ·</template>
          {{ keysOf('addPage') }} adds a page · {{ keysOf('previewFromHere') }} previews ·
          <button class="link-button" @click="isPanelOpen = true">All shortcuts <kbd>{{ keysOf('showShortcuts') }}</kbd></button>
        </p>
      </div>

      <p v-if="chapter.condition !== undefined" class="only-if">Played only if {{ conditionText(chapter.condition) }}; passed by otherwise.</p>
      <p v-if="chapterUnreachableCount > 0" class="warning" role="note">
        ⚠ {{ chapterUnreachableCount }} {{ chapterUnreachableCount === 1 ? 'page of this chapter is' : 'pages of this chapter are' }} never reached:
        shown faded, and counted on the blocks that hold them. Move them before the ending, or into a branch.
      </p>
      <div class="layout">
        <div
          ref="board"
          class="board"
          :class="{ tree: view === 'tree' }"
          tabindex="0"
          role="listbox"
          aria-label="Storyboard"
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
            :chapter-title="isScene ? `Scene: ${chapter.title}` : chapter.title ?? 'Untitled chapter'"
            :focused-id="focusedId"
            :selected-ids="selectedIds"
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

        <aside class="inspector" aria-live="polite">
          <div v-if="editing !== null" class="edit">
            <h3>{{ editing.target.type === 'insert' ? 'New pages' : 'Edit' }}</h3>
            <TagTextEditor
              ref="editor"
              v-model="editing.text"
              :vocabulary="vocabulary"
              :layout="layout"
              label="Text of the page"
              :placeholder="'— Marie: A new line.\n[bg: rooftop]\nNarration.'"
              @submit="saveEdit"
              @cancel="cancelEdit"
            />
            <ul v-if="editPreview !== null && editPreview.problems.length > 0" class="problems">
              <li v-for="(problem, index) in editPreview.problems" :key="index" :class="problem.severity">{{ problemMessage(problem) }}</li>
            </ul>
            <p v-else-if="editPageCount > 1" class="muted">Becomes {{ editPageCount }} pages.</p>
            <div class="edit-actions">
              <button class="button primary small" :disabled="!canSaveEdit" @click="saveEdit">Save <kbd>{{ keysOf('save') }}</kbd></button>
              <button class="button small" @click="cancelEdit">Cancel <kbd>{{ keysOf('cancel') }}</kbd></button>
            </div>
          </div>
          <template v-else-if="focusedEntry?.type === 'card' && focusedEntry.node.type === 'page'">
            <h3>Page {{ focusedEntry.number }} · {{ focusedEntry.node.kind }}</h3>
            <p v-if="speakerName(focusedEntry.node.speakerId) !== null" class="speaker">{{ speakerName(focusedEntry.node.speakerId) }}</p>
            <p class="full-text">{{ focusedEntry.node.text }}</p>
            <template v-if="stagingOf(focusedEntry).length > 0">
              <h4>Staging</h4>
              <ul>
                <li v-for="line in stagingOf(focusedEntry)" :key="line">{{ line }}</li>
              </ul>
            </template>
          </template>
          <template v-else-if="focusedEntry?.type === 'card' && focusedEntry.node.type === 'choice'">
            <h3>Choice {{ focusedEntry.number }} · {{ decisionName(focusedEntry.node.decisionId) }}</h3>
            <ul>
              <li v-for="option in focusedEntry.node.options" :key="option.id">
                {{ option.text }} → {{ valueName(focusedEntry.node.decisionId, option.valueId) }}<span v-if="option.condition !== null" class="muted">, offered only if {{ conditionText(option.condition) }}</span>
              </li>
            </ul>
          </template>
          <p v-else-if="focusedEntry?.type === 'marker'" class="muted">{{ focusedEntry.node.type }}: {{ focusedEntry.text }}</p>
          <template v-else-if="focusedBlock?.node.type === 'loop'">
            <h3>Loop {{ focusedBlock.numbers }} · {{ pagesWord(focusedBlock.pageCount) }}</h3>
            <p class="muted">Its pages play again and again, until a [break] inside leaves the loop.</p>
            <p v-if="focusedBlock.isEndless" class="warning">⚠ Nothing inside leaves it: the player would be stuck. Add a [break] in a branch the player can reach, or an [ending].</p>
            <p class="muted">It moves as one piece. Open it to work on its pages.</p>
          </template>
          <template v-else-if="focusedBlock !== null && focusedBlock.node.type === 'condition'">
            <h3>Block {{ focusedBlock.numbers }} · {{ pagesWord(focusedBlock.pageCount) }}</h3>
            <ul>
              <li v-for="lane in focusedBlock.branches" :key="lane.containerId ?? ''">{{ lane.text }}: {{ pagesWord(branchPageCount(lane, focusedBlock)) }}</li>
            </ul>
            <p v-if="focusedBlock.allRoutesEnd" class="muted">★ Every route ends inside: nothing after it is reached from here.</p>
            <p v-else-if="focusedBlock.endingRouteCount > 0" class="muted">★ {{ focusedBlock.endingRouteCount }} of {{ focusedBlock.branches.length }} routes end inside; the others go on after it.</p>
            <p class="muted">It moves as one piece. Open it to work on its pages.</p>
          </template>
          <p v-else-if="focusedItem?.element === null" class="muted">This branch has no page yet.</p>
          <p v-else class="muted">Select a card to see it in full.</p>
          <p v-if="editing === null && focusedId !== null && unreachableIds.has(focusedId)" class="warning">
            Never reached: every path before it ends, at an ending or in a block whose branches, else included, all end.
            Move it before that, or into a branch.
          </p>
          <p v-if="editing === null && shownSelection.ids.length > 1" class="muted">{{ shownSelection.ids.length }} selected</p>
          <p v-if="editing === null && hint !== null" class="hint" role="status">{{ hint }}</p>
          <div v-if="editing === null" class="inspector-actions">
            <button v-if="focusedEntry !== null" class="button small" @click="startEditing(focusedEntry)">Edit <kbd>{{ keysOf('edit') }}</kbd></button>
            <button v-if="focusedBlock !== null" class="button small" @click="openElement(focusedBlock.id)">Open the block <kbd>{{ keysOf('edit') }}</kbd></button>
            <button v-if="focusedEntry?.type === 'card'" class="button small" @click="previewFocused">Preview from here ▶ <kbd>{{ keysOf('previewFromHere') }}</kbd></button>
            <button class="button small" @click="startAdding">{{ chapter.nodes.length === 0 ? 'Write the first page' : focusedItem?.element === null ? 'Write a page here' : 'Add a page after' }} <kbd>{{ keysOf('addPage') }}</kbd></button>
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

.problems .error {
  color: #f28b82;
}

.problems .warning {
  color: #f6c177;
}

kbd {
  margin-left: 4px;
  font: 11px/1 system-ui, sans-serif;
  color: #7b8597;
}
</style>
