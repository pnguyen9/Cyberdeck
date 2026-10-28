import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createLanguageChoice, LANGUAGE_KEY } from '../../src/i18n/languageChoice'
import { memoryStorage } from '../memoryStorage'

describe("the player's language", () => {
  it("is the system's until the player picks one", () => {
    expect(createLanguageChoice(memoryStorage).value).toBe('system')
  })

  it('is kept for every profile under one key, and read back at the next start', async () => {
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
})
