<script setup lang="ts">
import { emptyProgress, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import {
  AUTOSAVE_SLOT,
  createStorageSettingsStore,
  DEFAULT_PLAYER_SETTINGS,
  LESS_MOTION,
  localeOfChoice,
  MapView,
  PlayerView,
  provideLocale,
  SettingsScreen,
  useSystemLessMotion,
  wantsLessMotion,
  type PlayerSettings,
} from '@cyberdeck/stage'
import { computed, onMounted, provide, ref, shallowRef, watch, watchEffect } from 'vue'
import { appMessages } from './i18n/appMessages'
import { createLanguageChoice } from './i18n/languageChoice'
import { createDesktopLibraryStorage } from './library/desktopLibraryStorage'
import { GameLibrary } from './library/gameLibrary'
import { createIndexedDbLibraryStorage } from './library/indexedDbLibraryStorage'
import GalleryView from './library/GalleryView.vue'
import LibraryView from './library/LibraryView.vue'
import { createDesktopProfileStore } from './profiles/desktopProfileStore'
import { createBrowserProfileStore, type Profile, type ProfileStore } from './profiles/profileStore'
import ProfilesView from './profiles/ProfilesView.vue'

const desktop = window.datajackDesktop
/** Every screen below speaks the player's language, the game's settings included. */
const languageChoice = createLanguageChoice(() => window.localStorage)
const locale = computed(() => localeOfChoice(languageChoice.value))
provideLocale(locale)
watchEffect(() => {
  document.documentElement.lang = locale.value
})
const text = computed(() => appMessages[locale.value])
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

/** A game's own settings, when the player gave it some, kept beside the profile's. */
function gameSettingsStore(gameId: string) {
  return profile.value === null ? null : createStorageSettingsStore(() => window.localStorage, `datajack:settings:${profile.value.id}:game:${gameId}`)
}
/** The game played or whose settings are open, and its own settings: null while it uses the profile's. */
const gameSettingsOf = shallowRef<{ gameId: string; gameName: string; own: PlayerSettings | null } | null>(null)
function loadGameSettings(gameId: string, gameName: string) {
  const store = gameSettingsStore(gameId)
  gameSettingsOf.value = { gameId, gameName, own: store?.has() === true ? store.read() : null }
}
/** What the game plays with: its own settings, or the profile's. */
const gameSettings = computed(() => gameSettingsOf.value?.own ?? settings.value)
function changeGameSettings(value: PlayerSettings) {
  const shown = gameSettingsOf.value
  if (shown?.own != null) {
    gameSettingsOf.value = { ...shown, own: value }
    gameSettingsStore(shown.gameId)?.write(value)
  } else {
    settings.value = value
  }
}
/** A game given its own settings starts from the profile's; going back to the profile's forgets them. */
function chooseOwnSettings(isOwn: boolean) {
  const shown = gameSettingsOf.value
  const store = shown === null ? null : gameSettingsStore(shown.gameId)
  if (shown === null || store === null) {
    return
  }
  if (isOwn) {
    store.write(settings.value)
  } else {
    store.remove()
  }
  gameSettingsOf.value = { ...shown, own: isOwn ? settings.value : null }
}
/** The settings of one game, opened from its card. */
const gameSettingsShown = ref(false)
function showGameSettings(gameId: string, gameName: string) {
  loadGameSettings(gameId, gameName)
  gameSettingsShown.value = true
}
const playing = shallowRef<{ story: PlayableStory; resumeFrom: SaveData | null } | null>(null)
watch(playing, current => {
  if (current !== null) {
    loadGameSettings(current.story.project.id, current.story.project.name)
  }
})
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

/** The player's settings, opened from the library, outside any game. */
const settingsShown = ref(false)

/** A game's gallery, with what this profile has seen of it, and its motion as the game plays it. */
const galleryShown = shallowRef<{ story: PlayableStory; progress: ProgressData; settings: PlayerSettings } | null>(null)

async function showGallery(story: PlayableStory) {
  const ownStore = gameSettingsStore(story.project.id)
  const gameOwn = ownStore?.has() === true ? ownStore.read() : null
  galleryShown.value = { story, progress: await saveStore.value?.readProgress(story.project.id) ?? emptyProgress(story), settings: gameOwn ?? settings.value }
}
/** Animated pictures outside a game, in its gallery, move as the player chose for it. */
const systemLessMotion = useSystemLessMotion()
provide(LESS_MOTION, computed(() => wantsLessMotion((galleryShown.value?.settings ?? settings.value).motion, systemLessMotion.value)))

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
    <ProfilesView v-if="profile === null || saveStore === null" v-model:language-choice="languageChoice" :store="profileStore" @chosen="chosen => profile = chosen" />
    <MapView
      v-else-if="mapShown !== null"
      :story="mapShown.story"
      :progress="mapShown.progress"
      :close-label="mapShown.returnTo === 'game' ? text.game : text.library"
      @play="playFrom"
      @close="closeMap"
    />
    <SettingsScreen v-else-if="settingsShown" v-model="settings" v-model:language-choice="languageChoice" @close="settingsShown = false" />
    <SettingsScreen
      v-else-if="gameSettingsShown && gameSettingsOf !== null"
      :model-value="gameSettings"
      v-model:language-choice="languageChoice"
      :scope="{ gameName: gameSettingsOf.gameName, isOwn: gameSettingsOf.own !== null }"
      @update:model-value="changeGameSettings"
      @scope="chooseOwnSettings"
      @close="gameSettingsShown = false"
    />
    <GalleryView v-else-if="galleryShown !== null" :story="galleryShown.story" :progress="galleryShown.progress" @close="galleryShown = null" />
    <PlayerView
      v-else-if="playing !== null"
      :story="playing.story"
      :save-store="saveStore"
      :settings="gameSettings"
      v-model:language-choice="languageChoice"
      :resume-from="playing.resumeFrom"
      :has-own-settings="gameSettingsOf?.own != null"
      @update:settings="changeGameSettings"
      @own-settings="chooseOwnSettings"
      :leave-label="text.library"
      can-open-map
      @leave="playing = null"
      @map="showMap(playing.story, 'game')"
    />
    <LibraryView
      v-else
      v-model:language-choice="languageChoice"
      :library="library"
      :save-store="saveStore"
      :profile-name="profile.name"
      @play="(story, resumeFrom) => playing = { story, resumeFrom }"
      @map="story => showMap(story, 'library')"
      @gallery="showGallery"
      @settings="settingsShown = true"
      @game-settings="showGameSettings"
      @switch-profile="profile = null"
    />
  </template>
</template>
