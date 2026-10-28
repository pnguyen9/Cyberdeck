import { readLanguageChoice, writeLanguageChoice, type LanguageChoice } from '@cyberdeck/stage'
import { ref, watch, type Ref } from 'vue'

/** One language for every profile: it applies from the profiles screen on, before anyone is chosen. */
export const LANGUAGE_KEY = 'datajack:language'

/** The player's language, read from the browser's storage and written back on each change. */
export function createLanguageChoice(getStorage: () => Storage): Ref<LanguageChoice> {
  const choice = ref<LanguageChoice>(readLanguageChoice(getStorage, LANGUAGE_KEY))
  watch(choice, value => writeLanguageChoice(getStorage, LANGUAGE_KEY, value))
  return choice
}
