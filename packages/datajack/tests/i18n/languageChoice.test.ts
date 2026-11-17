import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createLanguageChoice, LANGUAGE_KEY, profileLanguageKey } from '../../src/i18n/languageChoice'
import { memoryStorage } from '../memoryStorage'

describe("the player's language", () => {
  it("is the system's until the player picks one", () => {
    expect(createLanguageChoice(memoryStorage).value).toBe('system')
  })

  it('is kept under the device\'s key without a profile, and read back at the next start', async () => {
    const storage = memoryStorage()
    const choice = createLanguageChoice(() => storage)
    choice.value = 'fr'
    await nextTick()

    expect(storage.getItem(LANGUAGE_KEY)).toBe('fr')
    expect(LANGUAGE_KEY).toBe('datajack:language')
    expect(createLanguageChoice(() => storage).value).toBe('fr')
  })

  it("falls back to the system's when what is stored is no language we speak, or cannot be read", () => {
    const storage = memoryStorage()
    storage.setItem(LANGUAGE_KEY, 'de')
    expect(createLanguageChoice(() => storage).value).toBe('system')
    expect(createLanguageChoice(() => {
      throw new Error('Blocked')
    }).value).toBe('system')
  })

  it("is each profile's own, one that never chose taking the device's, the profiles screen speaking the last profile's", async () => {
    const storage = memoryStorage()
    storage.setItem(LANGUAGE_KEY, 'fr')
    const profileId = ref<string | null>(null)
    const choice = createLanguageChoice(() => storage, () => profileId.value)
    expect(choice.value).toBe('fr')

    profileId.value = 'ana'
    await nextTick()
    expect(choice.value).toBe('fr')
    expect(storage.getItem(profileLanguageKey('ana'))).toBe('fr')
    choice.value = 'en'
    await nextTick()
    expect([storage.getItem(profileLanguageKey('ana')), storage.getItem(LANGUAGE_KEY)]).toEqual(['en', 'en'])

    profileId.value = 'ben'
    await nextTick()
    expect(choice.value).toBe('en')
    choice.value = 'fr'
    await nextTick()

    profileId.value = 'ana'
    await nextTick()
    expect(choice.value).toBe('en')
    profileId.value = null
    await nextTick()
    expect(choice.value).toBe('en')

    // On the profiles screen, a choice is the device's only.
    choice.value = 'fr'
    await nextTick()
    expect([storage.getItem(profileLanguageKey('ana')), storage.getItem(profileLanguageKey('ben')), storage.getItem(LANGUAGE_KEY)]).toEqual(['en', 'fr', 'fr'])
  })
})
