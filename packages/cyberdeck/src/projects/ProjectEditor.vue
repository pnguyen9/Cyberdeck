<script setup lang="ts">
import type { ChapterDocument, PlayableStory, ProjectDocument, SaveData } from '@cyberdeck/core'
import { provide, ref, shallowRef } from 'vue'
import CastTab from './CastTab.vue'
import ChaptersTab from './ChaptersTab.vue'
import DetailsTab from './DetailsTab.vue'
import { EDITOR } from './editorContext'
import ExportTab from './ExportTab.vue'
import ImportTab from './ImportTab.vue'
import StoryboardTab from './StoryboardTab.vue'
import type { OpenProject } from './openProject'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { formatSize, safeFileName, usePreparedDownload } from './preparedDownload'

const props = defineProps<{ open: OpenProject }>()
const emit = defineEmits<{ close: []; preview: [story: PlayableStory, resumeFrom: SaveData | null] }>()

const TABS = [
  { id: 'chapters', label: 'Chapters' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'import', label: 'Import' },
  { id: 'cast', label: 'Cast & files' },
  { id: 'details', label: 'Details' },
  { id: 'export', label: 'Export' },
] as const
type TabId = typeof TABS[number]['id']

const project = shallowRef<ProjectDocument>(props.open.project)
const chapters = shallowRef<ChapterDocument[]>(props.open.chapters)
const scenes = shallowRef<ChapterDocument[]>(props.open.scenes)
const tab = ref<TabId>(chapters.value.length === 0 ? 'import' : 'chapters')
const renaming = ref<string | null>(null)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const backupDownload = usePreparedDownload()
const { isPanelOpen } = useShortcuts()

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
    errorMessage.value = error instanceof Error ? error.message : String(error)
    return false
  } finally {
    showStored()
  }
}

async function preview(fromChapterId: string | null) {
  await act(async () => emit('preview', await props.open.playable(fromChapterId), null))
}

async function previewFrom(chapterId: string, nodeId: string) {
  let note: string | null = null
  await act(async () => {
    const prepared = await props.open.previewFrom(chapterId, nodeId, new Date())
    note = prepared.note
    emit('preview', prepared.story, prepared.resumeFrom)
  }, () => note ?? '')
}

async function confirmRename() {
  const name = renaming.value
  if (name !== null && await act(() => props.open.rename(name))) {
    renaming.value = null
  }
}

async function backUp() {
  await act(async () => backupDownload.offer(`${safeFileName(props.open.project.name)} backup.zip`, await props.open.backup(new Date())))
}

const switchTab = (id: TabId) => {
  tab.value = id
  message.value = null
  errorMessage.value = null
}

const importDraft = ref<{ text: string; fileName: string | null }>({ text: '', fileName: null })
const storyboardChapterId = ref<string | null>(null)
function openStoryboard(chapterId: string) {
  storyboardChapterId.value = chapterId
  switchTab('storyboard')
}
provide(EDITOR, { open: props.open, project, chapters, scenes, act, preview, previewFrom, importDraft, storyboardChapterId, openStoryboard })
</script>

<template>
  <main class="editor-page">
    <header class="header">
      <button class="link-button" @click="emit('close')">← Projects</button>
      <div class="title-row">
        <form v-if="renaming !== null" class="rename" @submit.prevent="confirmRename">
          <input v-model="renaming" class="text-input" aria-label="Project name" autocomplete="off">
          <button class="button primary small" type="submit">Rename</button>
          <button class="button small" type="button" @click="renaming = null">Cancel</button>
        </form>
        <h1 v-else>
          {{ project.name }}
          <button class="link-button" @click="renaming = project.name">Rename</button>
        </h1>
        <div class="header-actions">
          <button class="button" title="Keyboard shortcuts" @click="isPanelOpen = true">Shortcuts</button>
          <button class="button" @click="backUp">Back up</button>
          <button class="button primary" :disabled="chapters.length === 0" @click="preview(null)">Preview ▶</button>
        </div>
      </div>
      <p v-if="backupDownload.prepared.value !== null" class="backup">
        <a class="download" :href="backupDownload.prepared.value.url" :download="backupDownload.prepared.value.fileName">
          Download {{ backupDownload.prepared.value.fileName }}
        </a>
        <span class="muted"> ({{ formatSize(backupDownload.prepared.value.byteSize) }}): the project folder, to restore here or on another computer.</span>
      </p>
    </header>

    <nav class="tabs" aria-label="Project">
      <button
        v-for="entry in TABS"
        :key="entry.id"
        class="tab"
        :class="{ current: tab === entry.id }"
        :aria-current="tab === entry.id ? 'page' : undefined"
        @click="switchTab(entry.id)"
      >
        {{ entry.label }}
      </button>
    </nav>

    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>

    <ChaptersTab v-if="tab === 'chapters'" @import="switchTab('import')" />
    <StoryboardTab v-else-if="tab === 'storyboard'" />
    <ImportTab v-else-if="tab === 'import'" @imported="tab = 'chapters'" />
    <CastTab v-else-if="tab === 'cast'" />
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
