<script setup lang="ts">
import { emptyProgress, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { AUTOSAVE_SLOT, createStorageSettingsStore, DEFAULT_PLAYER_SETTINGS, MapView, PlayerView, type PlayerSettings } from '@cyberdeck/stage'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { createDesktopLibraryStorage } from './library/desktopLibraryStorage'
import { GameLibrary } from './library/gameLibrary'
import { createIndexedDbLibraryStorage } from './library/indexedDbLibraryStorage'
import GalleryView from './library/GalleryView.vue'
import LibraryView from './library/LibraryView.vue'
import { createDesktopProfileStore } from './profiles/desktopProfileStore'
import { createBrowserProfileStore, type Profile, type ProfileStore } from './profiles/profileStore'
import ProfilesView from './profiles/ProfilesView.vue'

const desktop = window.datajackDesktop
const profileStore: ProfileStore = desktop === undefined
  ? createBrowserProfileStore(() => window.localStorage, () => crypto.randomUUID(), () => new Date().toISOString())
  : createDesktopProfileStore(desktop)
const library = new GameLibrary(desktop === undefined ? createIndexedDbLibraryStorage() : createDesktopLibraryStorage(desktop))
const isLoading = ref(true)
/** Null while the player picks or creates a profile. */
const profile = shallowRef<Profile | null>(null)
const saveStore = computed(() => profile.value === null ? null : profileStore.saveStore(profile.value.id))
/** Each profile has its own settings, kept in the browser (Electron's page too). */
const settingsStore = computed(() => profile.value === null ? null : createStorageSettingsStore(() => window.localStorage, `datajack:settings:${profile.value.id}`))
const settings = shallowRef<PlayerSettings>(DEFAULT_PLAYER_SETTINGS)
watch(settingsStore, store => {
  settings.value = store?.read() ?? DEFAULT_PLAYER_SETTINGS
}, { immediate: true })
watch(settings, value => settingsStore.value?.write(value))
const playing = shallowRef<{ story: PlayableStory; resumeFrom: SaveData | null } | null>(null)
/** The map of a game, and whether closing it returns to the game or to the library. */
const mapShown = shallowRef<{ story: PlayableStory; progress: ProgressData; returnTo: 'game' | 'library' } | null>(null)

async function showMap(story: PlayableStory, returnTo: 'game' | 'library') {
  const progress = await saveStore.value?.readProgress(story.project.id) ?? null
  playing.value = null
  mapShown.value = { story, progress: progress ?? emptyProgress(story), returnTo }
}

/** Back to the game resumes its autosave, where the player left it to look at the map. */
async function closeMap() {
  const shown = mapShown.value
  mapShown.value = null
  if (shown?.returnTo === 'game') {
    playing.value = { story: shown.story, resumeFrom: await saveStore.value?.read(shown.story.project.id, AUTOSAVE_SLOT) ?? null }
  }
}

/** A game's gallery, with what this profile has seen of it. */
const galleryShown = shallowRef<{ story: PlayableStory; progress: ProgressData } | null>(null)

async function showGallery(story: PlayableStory) {
  galleryShown.value = { story, progress: await saveStore.value?.readProgress(story.project.id) ?? emptyProgress(story) }
}

/** Playing from a point of the map starts a new path from there; the autosave follows it. */
function playFrom(save: SaveData) {
  const shown = mapShown.value
  mapShown.value = null
  if (shown !== null) {
    playing.value = { story: shown.story, resumeFrom: save }
  }
}

/** The profile played last opens directly: the player is asked only the first time, or when switching. */
onMounted(async () => {
  try {
    const list = await profileStore.list()
    profile.value = list.profiles.find(candidate => candidate.id === list.lastUsedId) ?? null
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <template v-if="!isLoading">
    <ProfilesView v-if="profile === null || saveStore === null" :store="profileStore" @chosen="chosen => profile = chosen" />
    <MapView
      v-else-if="mapShown !== null"
      :story="mapShown.story"
      :progress="mapShown.progress"
      :close-label="mapShown.returnTo === 'game' ? 'Game' : 'Library'"
      @play="playFrom"
      @close="closeMap"
    />
    <GalleryView v-else-if="galleryShown !== null" :story="galleryShown.story" :progress="galleryShown.progress" @close="galleryShown = null" />
    <PlayerView
      v-else-if="playing !== null"
      :story="playing.story"
      :save-store="saveStore"
      v-model:settings="settings"
      :resume-from="playing.resumeFrom"
      leave-label="Library"
      can-open-map
      @leave="playing = null"
      @map="showMap(playing.story, 'game')"
    />
    <LibraryView
      v-else
      :library="library"
      :save-store="saveStore"
      :profile-name="profile.name"
      @play="(story, resumeFrom) => playing = { story, resumeFrom }"
      @map="story => showMap(story, 'library')"
      @gallery="showGallery"
      @switch-profile="profile = null"
    />
  </template>
</template>
