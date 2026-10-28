import { describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS } from '../src/input/bindings'
import { createStorageSettingsStore, DEFAULT_PLAYER_SETTINGS, parsePlayerSettings } from '../src/settings/playerSettings'
import { memoryStorage } from './memoryStorage'

describe('player settings', () => {
  it('keeps what was chosen', () => {
    const chosen = { ...DEFAULT_PLAYER_SETTINGS, textSpeed: 0, musicVolume: 0.2, voiceVolume: 0.5, textScale: 1.5 as const, readableFont: true, strongContrast: true, readAloud: true, untimedChoices: true, bindings: { ...DEFAULT_BINDINGS, skip: [{ type: 'key', code: 'Tab' }] } }
    expect(parsePlayerSettings(JSON.parse(JSON.stringify(chosen)))).toEqual(chosen)
  })

  it('takes the default for what is missing or damaged, and for actions newer than the settings', () => {
    const settings = parsePlayerSettings({ textSpeed: 9999, soundVolume: 'loud', bindings: { advance: [{ type: 'key', code: 'KeyX' }, { type: 'mouseButton', button: 42 }, 'Space'] } })
    expect(settings.textSpeed).toBe(DEFAULT_PLAYER_SETTINGS.textSpeed)
    expect(settings.soundVolume).toBe(DEFAULT_PLAYER_SETTINGS.soundVolume)
    // Settings kept before voices and accessibility existed.
    expect(settings.voiceVolume).toBe(DEFAULT_PLAYER_SETTINGS.voiceVolume)
    expect(parsePlayerSettings({ textScale: 3, readAloud: 'yes' })).toMatchObject({ textScale: 1, readAloud: false })
    expect(settings.bindings.advance).toEqual([{ type: 'key', code: 'KeyX' }])
    expect(settings.bindings.hideText).toEqual(DEFAULT_BINDINGS.hideText)
    expect(parsePlayerSettings('nonsense')).toEqual(DEFAULT_PLAYER_SETTINGS)
  })

  it('are kept in a storage, the defaults standing in when it cannot be read', () => {
    const store = createStorageSettingsStore(() => memoryStorage(), 'settings')
    expect(store.read()).toEqual(DEFAULT_PLAYER_SETTINGS)
    const storage = memoryStorage()
    const kept = createStorageSettingsStore(() => storage, 'settings')
    expect(kept.write({ ...DEFAULT_PLAYER_SETTINGS, textSpeed: 90 })).toBe(true)
    expect(kept.read().textSpeed).toBe(90)
    const broken = createStorageSettingsStore(() => { throw new Error('blocked') }, 'settings')
    expect(broken.read()).toEqual(DEFAULT_PLAYER_SETTINGS)
    expect(broken.write(DEFAULT_PLAYER_SETTINGS)).toBe(false)
  })
})
