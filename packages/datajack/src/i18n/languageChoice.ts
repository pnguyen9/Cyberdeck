import { readLanguageChoice, writeLanguageChoice, type LanguageChoice } from '@cyberdeck/stage'
import { ref, watch, type Ref } from 'vue'
import { LANGUAGE_KEY, profileLanguageKey } from '../profiles/profileKeys'

function hasKey(getStorage: () => Storage, key: string): boolean {
  try {
    return getStorage().getItem(key) !== null
  } catch {
    return false
  }
}

/**
 * The player's language, read from the browser's storage and written back on each change. Each
 * profile has its own; one that never chose takes the device's (the last chosen, before profiles had
 * their own). The language of the profile chosen last is also the device's, which the profiles screen speaks.
 */
export function createLanguageChoice(getStorage: () => Storage, profileId: () => string | null = () => null): Ref<LanguageChoice> {
  const keyOf = (id: string | null) => id !== null && hasKey(getStorage, profileLanguageKey(id)) ? profileLanguageKey(id) : LANGUAGE_KEY
  const choice = ref<LanguageChoice>(readLanguageChoice(getStorage, keyOf(profileId())))
  const write = (value: LanguageChoice) => {
    const id = profileId()
    if (id !== null) {
      writeLanguageChoice(getStorage, profileLanguageKey(id), value)
    }
    writeLanguageChoice(getStorage, LANGUAGE_KEY, value)
  }
  // A profile chosen keeps its language (the device's, if it had none) and makes it the device's.
  watch(profileId, id => {
    choice.value = readLanguageChoice(getStorage, keyOf(id))
    write(choice.value)
  })
  watch(choice, write)
  return choice
}
