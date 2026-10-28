<script setup lang="ts">
import type { PlayableStory, SaveData } from '@cyberdeck/core'
import { createStorageSaveStore, createStorageSettingsStore, localeOfChoice, PlayerView, provideLocale, type PlayerSettings } from '@cyberdeck/stage'
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
const previewing = shallowRef<{ story: PlayableStory; resumeFrom: SaveData | null } | null>(null)
const { shortcuts, isPanelOpen } = useShortcuts()

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
    <ProjectView v-show="previewing === null" :store="store" :project-id="openProjectId" @close="openProjectId = null" @preview="(story, resumeFrom) => previewing = { story, resumeFrom }" />
    <PlayerView
      v-if="previewing !== null"
      v-model:settings="previewSettings"
      :story="previewing.story"
      :save-store="previewSaves"
      :resume-from="previewing.resumeFrom"
      :leave-label="text.leaveLabel"
      @leave="previewing = null"
    />
  </template>
  <ProjectsView v-else :store="store" @open="projectId => openProjectId = projectId" />
  <ShortcutsPanel v-if="isPanelOpen" />
</template>
