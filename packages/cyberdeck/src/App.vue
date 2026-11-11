<script setup lang="ts">
import { emptyProgress, exploreStory, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { AUTOSAVE_SLOT, createStorageSaveStore, createStorageSettingsStore, localeOfChoice, MapView, PlayerView, provideLocale, type PlayerSettings } from '@cyberdeck/stage'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { appMessages } from './i18n/appMessages'
import { createDesktopProjectStore } from './projects/desktopProjectStore'
import { createIndexedDbProjectStore } from './projects/indexedDbProjectStore'
import ProjectsView from './projects/ProjectsView.vue'
import ProjectView from './projects/ProjectView.vue'
import { useLanguageChoice } from './settings/languageChoice'
import { useShortcuts } from './shortcuts/shortcutStore'
import { actionFor } from './shortcuts/shortcuts'
import ShortcutsPanel from './shortcuts/ShortcutsPanel.vue'

const desktop = window.cyberdeckDesktop
const store = desktop === undefined ? createIndexedDbProjectStore() : createDesktopProjectStore(desktop)
/** Previews save in the browser, apart from the profiles of Datajack. */
const previewSaves = createStorageSaveStore(() => window.localStorage, 'cyberdeck:preview:')
/** The author's player settings for previews: text speed, volumes, keys. */
const previewSettingsStore = createStorageSettingsStore(() => window.localStorage, 'cyberdeck:preview-settings')
const previewSettings = shallowRef<PlayerSettings>(previewSettingsStore.read())
watch(previewSettings, value => previewSettingsStore.write(value))
const openProjectId = ref<string | null>(null)
const previewing = shallowRef<{ story: PlayableStory; resumeFrom: SaveData | null; fromMap?: true } | null>(null)
const { shortcuts, isPanelOpen } = useShortcuts()

/** The map of the story previewed: the routes the previews explored, as Datajack shows players theirs. */
const previewMap = shallowRef<{ story: PlayableStory; progress: ProgressData; everyPath: { progress: ProgressData; isWhole: boolean } | null } | null>(null)

/** Between the paths the previews played and every path, explored from the story once asked for. */
const isExploring = ref(false)
/** Each story previewed is explored once: switching back and forth shows the same map. */
const explored = new WeakMap<PlayableStory, ReturnType<typeof exploreStory>>()
function switchPreviewMap() {
  const shown = previewMap.value
  if (shown === null || isExploring.value) {
    return
  }
  if (shown.everyPath !== null) {
    previewMap.value = { ...shown, everyPath: null }
    return
  }
  const known = explored.get(shown.story)
  if (known !== undefined) {
    previewMap.value = { ...shown, everyPath: known }
    return
  }
  // A large story takes a moment to explore: the button says so before the work begins.
  isExploring.value = true
  setTimeout(() => {
    const everyPath = exploreStory(shown.story)
    explored.set(shown.story, everyPath)
    previewMap.value = { ...shown, everyPath }
    isExploring.value = false
  }, 30)
}

async function showPreviewMap(story: PlayableStory) {
  const progress = await previewSaves.readProgress(story.project.id) ?? emptyProgress(story)
  previewing.value = null
  previewMap.value = { story, progress, everyPath: null }
  // Nothing played yet: the map of every path is what there is to see.
  if (progress.points.length === 0) {
    switchPreviewMap()
  }
}

/** Back to the preview, where it was left to look at the map: its autosave. */
async function closePreviewMap() {
  const shown = previewMap.value
  previewMap.value = null
  if (shown !== null) {
    previewing.value = { story: shown.story, resumeFrom: await previewSaves.read(shown.story.project.id, AUTOSAVE_SLOT) }
  }
}

/** Previewing from a point of the map starts there, its state as it was reached. */
function previewFromPoint(save: SaveData) {
  const shown = previewMap.value
  previewMap.value = null
  if (shown !== null) {
    previewing.value = { story: shown.story, resumeFrom: save, fromMap: true }
  }
}

/** Every screen below speaks it, the preview's player included. */
const languageChoice = useLanguageChoice()
const locale = computed(() => localeOfChoice(languageChoice.value))
provideLocale(locale)
watchEffect(() => {
  document.documentElement.lang = locale.value
})
const text = computed(() => appMessages[locale.value])

/** The shortcuts open from anywhere but a field being typed in, and not over the preview, which has its own keys. */
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const isTyping = target !== null && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  if (!isTyping && previewing.value === null && !isPanelOpen.value && actionFor(shortcuts.value, event, 'Everywhere') === 'showShortcuts') {
    event.preventDefault()
    isPanelOpen.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <template v-if="openProjectId !== null">
    <!-- Kept while previewing, so that the author comes back to the same tab and draft. -->
    <ProjectView v-show="previewing === null && previewMap === null" :store="store" :project-id="openProjectId" @close="openProjectId = null" @preview="(story, resumeFrom) => previewing = { story, resumeFrom }" />
    <PlayerView
      v-if="previewing !== null"
      v-model:settings="previewSettings"
      :story="previewing.story"
      :save-store="previewSaves"
      :resume-from="previewing.resumeFrom"
      :resumes-from-map="previewing.fromMap === true"
      :leave-label="text.leaveLabel"
      can-inspect
      can-open-map
      ignores-locks
      skips-unread
      @leave="previewing = null"
      @map="showPreviewMap(previewing.story)"
    />
    <MapView
      v-if="previewMap !== null"
      :story="previewMap.story"
      :progress="previewMap.everyPath?.progress ?? previewMap.progress"
      :close-label="text.previewLabel"
      :every-path="previewMap.everyPath"
      :switch-label="isExploring ? text.exploring : previewMap.everyPath === null ? text.showEveryPath : text.showPlayed"
      ignores-locks
      @switch="switchPreviewMap"
      @play="previewFromPoint"
      @close="closePreviewMap"
    />
  </template>
  <ProjectsView v-else :store="store" :preview-saves="previewSaves" @open="projectId => openProjectId = projectId" />
  <ShortcutsPanel v-if="isPanelOpen" />
</template>
