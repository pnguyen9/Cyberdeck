// The looks of styled text, shared by every component drawing the story's text: global, as the classes runs carry are.
import './textStyles.css'

export { default as PlayerView } from './components/PlayerView.vue'
export { describeInput } from './input/bindings'
export { AUTOSAVE_SLOT, createStorageSaveStore, PROGRESS_SLOT, slotsErased, type ErasedData, type SaveStore } from './saveStore'
export { createTextboxLayout, TEXTBOX_FONT_FAMILY, TEXTBOX_FONT_SIZE } from './textboxLayout'
export { default as MapView } from './components/MapView.vue'
export { default as StagePicture } from './components/StagePicture.vue'
export { default as SettingsScreen } from './components/SettingsScreen.vue'
export { default as LanguageSelect } from './components/LanguageSelect.vue'
export { default as AboutApp } from './components/AboutApp.vue'
export { default as NewVersionBar } from './components/NewVersionBar.vue'
export { default as SampleNotLoadedNote } from './components/SampleNotLoadedNote.vue'
export { provideApp, useAboutApp } from './app/aboutApp'
export { useBackdropClose } from './app/backdropClose'
export { loadSample, sampleGameId, type SampleIndexEntry } from './app/samples'
export { default as SampleCard } from './components/SampleCard.vue'
export { isHosted } from './app/howItRuns'
export { TOUCH_SCREEN_QUERY, useMediaQuery } from './app/mediaQuery'
export { createStorageSettingsStore, DEFAULT_PLAYER_SETTINGS, type PlayerSettings } from './settings/playerSettings'
export { default as AppLookButton } from './look/AppLookButton.vue'
export { LESS_MOTION, useSystemLessMotion, wantsLessMotion } from './settings/lessMotion'
export {
  localeOfChoice,
  provideLocale,
  readLanguageChoice,
  useLocale,
  useMessages,
  writeLanguageChoice,
  type LanguageChoice,
  type Locale,
} from './i18n/locale'
