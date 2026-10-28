<script setup lang="ts">
import type { ChapterDocument, NameKind, PlayableStory, ProjectDocument, SaveData } from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { onMounted, onUnmounted, provide, ref, shallowRef } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { editorMessages } from '../i18n/editorMessages'
import { errorText } from '../i18n/errorMessages'
import { projectsMessages } from '../i18n/projectsMessages'
import LanguageSelect from '../settings/LanguageSelect.vue'
import CastTab from './CastTab.vue'
import ChaptersTab from './ChaptersTab.vue'
import DefinitionsTab from './DefinitionsTab.vue'
import DetailsTab from './DetailsTab.vue'
import { EDITOR } from './editorContext'
import ExportTab from './ExportTab.vue'
import ImportTab from './ImportTab.vue'
import IndexTab from './IndexTab.vue'
import StoryboardTab from './StoryboardTab.vue'
import type { OpenProject, PreviewNote } from './openProject'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { actionFor, type ShortcutId } from '../shortcuts/shortcuts'
import { formatSize, safeFileName, usePreparedDownload } from './preparedDownload'

const props = defineProps<{ open: OpenProject }>()
const emit = defineEmits<{ close: []; preview: [story: PlayableStory, resumeFrom: SaveData | null] }>()

const TABS = ['chapters', 'storyboard', 'import', 'cast', 'definitions', 'index', 'details', 'export'] as const
type TabId = typeof TABS[number]
const locale = useLocale()
const text = useMessages(editorMessages)
const common = useMessages(commonMessages)
const projectsText = useMessages(projectsMessages)

const project = shallowRef<ProjectDocument>(props.open.project)
const chapters = shallowRef<ChapterDocument[]>(props.open.chapters)
const scenes = shallowRef<ChapterDocument[]>(props.open.scenes)
const tab = ref<TabId>(chapters.value.length === 0 ? 'import' : 'chapters')
const renaming = ref<string | null>(null)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const backupDownload = usePreparedDownload()
const { shortcuts, isPanelOpen } = useShortcuts()

function showStored() {
  project.value = props.open.project
  chapters.value = props.open.chapters
  scenes.value = props.open.scenes
}

async function act(change: () => Promise<unknown>, successMessage?: string | (() => string)) {
  message.value = null
  errorMessage.value = null
  try {
    await change()
    message.value = typeof successMessage === 'function' ? successMessage() : successMessage ?? null
    return true
  } catch (error) {
    errorMessage.value = errorText(error, locale.value)
    return false
  } finally {
    showStored()
  }
}

async function preview(fromChapterId: string | null) {
  await act(async () => emit('preview', await props.open.playable(fromChapterId), null))
}

async function previewFrom(chapterId: string, nodeId: string) {
  let note: PreviewNote | null = null
  await act(async () => {
    const prepared = await props.open.previewFrom(chapterId, nodeId, new Date())
    note = prepared.note
    emit('preview', prepared.story, prepared.resumeFrom)
  }, () => note === null ? '' : text.value.previewNotes[note])
}

async function confirmRename() {
  const name = renaming.value
  if (name !== null && await act(() => props.open.rename(name))) {
    renaming.value = null
  }
}

async function backUp() {
  await act(async () => backupDownload.offer(text.value.backupFileName(safeFileName(props.open.project.name, locale.value)), await props.open.backup(new Date())))
}

let leaveGuard: ((proceed: () => void) => boolean) | null = null

/** Runs what would leave the tab shown once nothing would be lost: the tab may ask the author first. */
function whenFree(proceed: () => void) {
  if (leaveGuard === null || leaveGuard(proceed)) {
    proceed()
  }
}

/** Shows a tab, once the tab shown has nothing to lose. */
const switchTab = (id: TabId) => {
  if (id !== tab.value) {
    whenFree(() => showTab(id))
  }
}

function showTab(id: TabId) {
  tab.value = id
  message.value = null
  errorMessage.value = null
}

const storyboardRequest = ref<{ kind: 'goToBoard' | 'togglePanel' | 'reveal'; nodeId?: string; count: number } | null>(null)
function requestStoryboard(kind: 'goToBoard' | 'togglePanel' | 'reveal', nodeId?: string) {
  storyboardRequest.value = { kind, ...(nodeId === undefined ? {} : { nodeId }), count: (storyboardRequest.value?.count ?? 0) + 1 }
}

const TAB_SHORTCUTS: Partial<Record<ShortcutId, TabId>> = {
  tabChapters: 'chapters',
  tabStoryboard: 'storyboard',
  tabImport: 'import',
  tabCast: 'cast',
  tabDefinitions: 'definitions',
  tabIndex: 'index',
  tabDetails: 'details',
  tabExport: 'export',
}

/** Shortcuts of the whole project, which work while typing too: they all take Alt by default. */
function onKeydown(event: KeyboardEvent) {
  if (isPanelOpen.value || !event.altKey && !event.ctrlKey && !event.metaKey) {
    return
  }
  const action = actionFor(shortcuts.value, event, 'Everywhere')
  const index = TABS.indexOf(tab.value)
  const target = action === 'previousTab' ? TABS[(index - 1 + TABS.length) % TABS.length]
    : action === 'nextTab' ? TABS[(index + 1) % TABS.length]
      : action === null ? undefined : TAB_SHORTCUTS[action]
  if (target !== undefined) {
    event.preventDefault()
    switchTab(target)
  } else if (action === 'togglePanel' && tab.value === 'storyboard') {
    event.preventDefault()
    requestStoryboard(action)
  } else if (action === 'goToBoard') {
    event.preventDefault()
    // From another tab, asked only once the storyboard is shown: an author keeping on editing there asked nothing of it.
    if (tab.value === 'storyboard') {
      requestStoryboard(action)
    } else {
      whenFree(() => {
        showTab('storyboard')
        requestStoryboard(action)
      })
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const importDraft = ref<{ text: string; fileName: string | null }>({ text: '', fileName: null })
const storyboardChapterId = ref<string | null>(null)
/** Shows a chapter or scene in the storyboard; with a node, the card itself, inside the blocks holding it. */
function openStoryboard(chapterId: string, nodeId?: string) {
  whenFree(() => {
    storyboardChapterId.value = chapterId
    showTab('storyboard')
    if (nodeId !== undefined) {
      requestStoryboard('reveal', nodeId)
    }
  })
}
const setLeaveGuard = (guard: ((proceed: () => void) => boolean) | null) => {
  leaveGuard = guard
}
/** The first `Chapter N` or `Scene N` free, in the author's language: renamed at will in Chapters. */
function freeTitle(kind: 'chapter' | 'scene'): string {
  const taken = new Set([...chapters.value, ...scenes.value].map(document => document.title))
  const titleOf = (number: number) => kind === 'chapter' ? text.value.newChapterTitle(number) : text.value.newSceneTitle(number)
  let number = (kind === 'chapter' ? chapters.value.length : scenes.value.length) + 1
  while (taken.has(titleOf(number))) {
    number++
  }
  return titleOf(number)
}

async function startEmptyDocument(kind: 'chapter' | 'scene') {
  const title = freeTitle(kind)
  let documentId: string | null = null
  if (await act(async () => {
    documentId = await props.open.addEmptyDocument(kind, title)
  }) && documentId !== null) {
    openStoryboard(documentId)
    // Said once there: showing a tab clears the message of the one left.
    message.value = text.value.documentStarted(title)
  }
}

const indexFocus = ref<{ kind: NameKind; id: string } | null>(null)
function openIndex(kind: NameKind, id: string) {
  whenFree(() => {
    indexFocus.value = { kind, id }
    showTab('index')
  })
}
provide(EDITOR, { open: props.open, project, chapters, scenes, act, preview, previewFrom, importDraft, storyboardChapterId, openStoryboard, setLeaveGuard, storyboardRequest, indexFocus, openIndex, startEmptyDocument })
</script>

<template>
  <main class="editor-page">
    <header class="header">
      <button class="link-button" @click="whenFree(() => emit('close'))">{{ projectsText.backToProjects }}</button>
      <div class="title-row">
        <form v-if="renaming !== null" class="rename" @submit.prevent="confirmRename">
          <input v-model="renaming" class="text-input" :aria-label="text.projectName" autocomplete="off">
          <button class="button primary small" type="submit">{{ common.rename }}</button>
          <button class="button small" type="button" @click="renaming = null">{{ common.cancel }}</button>
        </form>
        <h1 v-else>
          {{ project.name }}
          <button class="link-button" @click="renaming = project.name">{{ common.rename }}</button>
        </h1>
        <div class="header-actions">
          <LanguageSelect />
          <button class="button" :title="text.keyboardShortcuts" @click="isPanelOpen = true">{{ text.shortcuts }}</button>
          <button class="button" @click="backUp">{{ text.backUp }}</button>
          <button class="button primary" :disabled="chapters.length === 0" @click="preview(null)">{{ text.preview }}</button>
        </div>
      </div>
      <p v-if="backupDownload.prepared.value !== null" class="backup">
        <a class="download" :href="backupDownload.prepared.value.url" :download="backupDownload.prepared.value.fileName">
          {{ common.download(backupDownload.prepared.value.fileName) }}
        </a>
        <span class="muted"> {{ text.backupHelp(formatSize(backupDownload.prepared.value.byteSize, locale)) }}</span>
      </p>
    </header>

    <nav class="tabs" :aria-label="text.tabsLabel">
      <button
        v-for="tabId in TABS"
        :key="tabId"
        class="tab"
        :class="{ current: tab === tabId }"
        :aria-current="tab === tabId ? 'page' : undefined"
        @click="switchTab(tabId)"
      >
        {{ text.tabs[tabId] }}
      </button>
    </nav>

    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>

    <ChaptersTab v-if="tab === 'chapters'" @import="switchTab('import')" />
    <StoryboardTab v-else-if="tab === 'storyboard'" />
    <!-- Straight to the chapters, keeping the message that says what was imported. -->
    <ImportTab v-else-if="tab === 'import'" @imported="tab = 'chapters'" />
    <CastTab v-else-if="tab === 'cast'" />
    <DefinitionsTab v-else-if="tab === 'definitions'" />
    <IndexTab v-else-if="tab === 'index'" />
    <DetailsTab v-else-if="tab === 'details'" />
    <ExportTab v-else />
  </main>
</template>

<style scoped>
.header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header > .link-button {
  align-self: flex-start;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px 24px;
}

h1 .link-button {
  margin-left: 8px;
  font-weight: 400;
}

.rename {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rename .text-input {
  width: auto;
  min-width: 240px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.backup {
  margin: 0;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 24px 0 16px;
  border-bottom: 1px solid #2c3442;
}

.tab {
  padding: 8px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  font: inherit;
  color: #a3acbb;
  cursor: pointer;
}

.tab.current {
  border-bottom-color: #9eeaff;
  color: #9eeaff;
}

.tab:hover,
.tab:focus-visible {
  color: #e6e9ef;
}
</style>
