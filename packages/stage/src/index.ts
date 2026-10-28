// The looks of styled text, shared by every component drawing the story's text: global, as the classes runs carry are.
import './textStyles.css'

export { default as PlayerView } from './components/PlayerView.vue'
export {
  actionForKey,
  actionForMouseButton,
  actionForWheel,
  actionOf,
  DEFAULT_BINDINGS,
  describeInput,
  MOUSE_BUTTON,
  rebind,
  unbind,
  type Bindings,
  type InputBinding,
  type PlayerAction,
} from './input/bindings'
export { AUTOSAVE_SLOT, createStorageSaveStore, MANUAL_SLOTS, PROGRESS_SLOT, type SaveStore } from './saveStore'
export { createTextboxLayout, STAGE_HEIGHT, STAGE_WIDTH, TEXTBOX_FONT_FAMILY, TEXTBOX_FONT_SIZE } from './textboxLayout'
export { default as MapView } from './components/MapView.vue'
export { default as LanguageSelect } from './components/LanguageSelect.vue'
export { createStorageSettingsStore, DEFAULT_PLAYER_SETTINGS, parsePlayerSettings, TEXT_SPEED_RANGE, type PlayerSettings } from './settings/playerSettings'
export {
  isLocale,
  LOCALE_NAMES,
  LOCALES,
  localeOf,
  localeOfChoice,
  provideLocale,
  readLanguageChoice,
  systemLocale,
  useLocale,
  useMessages,
  writeLanguageChoice,
  type LanguageChoice,
  type Locale,
} from './i18n/locale'
