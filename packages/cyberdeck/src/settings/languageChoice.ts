import { readLanguageChoice, writeLanguageChoice, type LanguageChoice } from '@cyberdeck/stage'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'cyberdeck:language'

/** The language the author chose for Cyberdeck, or the system's; kept in the browser. */
const choice = ref<LanguageChoice>(readLanguageChoice(() => window.localStorage, STORAGE_KEY))
watch(choice, value => writeLanguageChoice(() => window.localStorage, STORAGE_KEY, value))

export function useLanguageChoice() {
  return choice
}
