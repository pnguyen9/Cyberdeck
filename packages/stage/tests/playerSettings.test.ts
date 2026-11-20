import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS } from '../src/input/bindings'
import { setKeyboardLayout } from '../src/input/keyboardLayout'
import { createStorageSettingsStore, defaultPlayerSettings, parsePlayerSettings } from '../src/settings/playerSettings'
import { memoryStorage } from './memoryStorage'

const defaults = defaultPlayerSettings()

describe('player settings', () => {
  afterEach(() => setKeyboardLayout(null))

  it('keeps what was chosen', () => {
    const chosen = { ...defaults, textSpeed: 0, musicVolume: 0.2, voiceVolume: 0.5, textScale: 1.5 as const, readableFont: true, strongContrast: true, readAloud: true, untimedChoices: true, showKeys: true, bindings: { ...DEFAULT_BINDINGS, skip: [{ type: 'key', code: 'Tab' }] } }
    expect(parsePlayerSettings(JSON.parse(JSON.stringify(chosen)))).toEqual(chosen)
  })

  it('takes the default for what is missing or damaged, and for actions newer than the settings', () => {
    const settings = parsePlayerSettings({ textSpeed: 9999, soundVolume: 'loud', bindings: { advance: [{ type: 'key', code: 'KeyX' }, { type: 'mouseButton', button: 42 }, 'Space'] } })
    expect(settings.textSpeed).toBe(defaults.textSpeed)
    expect(settings.soundVolume).toBe(defaults.soundVolume)
    // Settings kept before voices and accessibility existed.
    expect(settings.voiceVolume).toBe(defaults.voiceVolume)
    expect(parsePlayerSettings({ textScale: 3, readAloud: 'yes' })).toMatchObject({ textScale: 1, readAloud: false })
    expect(settings.bindings.advance).toEqual([{ type: 'key', code: 'KeyX' }])
    expect(settings.bindings.hideText).toEqual(DEFAULT_BINDINGS.hideText)
    expect(parsePlayerSettings('nonsense')).toEqual(defaults)
  })

  it('keeps the choice of motion, as the system asks unless chosen', () => {
    expect(parsePlayerSettings({}).motion).toBe('system')
    expect(parsePlayerSettings({ motion: 'less' }).motion).toBe('less')
    expect(parsePlayerSettings({ motion: 'wobbly' }).motion).toBe('system')
  })

  it('are kept in a storage, the defaults standing in when it cannot be read', () => {
    const store = createStorageSettingsStore(() => memoryStorage(), 'settings')
    expect(store.read()).toEqual(defaults)
    const storage = memoryStorage()
    const kept = createStorageSettingsStore(() => storage, 'settings')
    expect(kept.write({ ...defaults, textSpeed: 90 })).toBe(true)
    expect(kept.read().textSpeed).toBe(90)
    const broken = createStorageSettingsStore(() => { throw new Error('blocked') }, 'settings')
    expect(broken.read()).toEqual(defaults)
    expect(broken.write(defaults)).toBe(false)
  })
  it('gives the defaults of the player\'s keyboard to actions on the US defaults, keeping the others', () => {
    // On AZERTY, the key at KeyQ prints A, the key at Semicolon prints M.
    setKeyboardLayout(new Map([['KeyQ', 'a'], ['KeyA', 'q'], ['Semicolon', 'm'], ['KeyM', ','], ['KeyL', 'l']]))
    const settings = parsePlayerSettings({ bindings: { auto: [{ type: 'key', code: 'KeyA' }], skip: [{ type: 'key', code: 'KeyA' }] } })
    expect(settings.bindings.auto).toEqual([{ type: 'key', code: 'KeyQ' }])
    expect(settings.bindings.map).toEqual([{ type: 'key', code: 'Semicolon' }])
    expect(settings.bindings.log).toEqual([{ type: 'key', code: 'KeyL' }])
    expect(settings.bindings.skip).toEqual([{ type: 'key', code: 'KeyA' }])
    expect(parsePlayerSettings({}).showKeys).toBe(false)
  })

  it('moves US defaults once: keys the player put back at their US places stay there', () => {
    setKeyboardLayout(new Map([['KeyQ', 'a'], ['KeyA', 'q']]))
    expect(parsePlayerSettings({ keysOnLayout: true, bindings: { auto: [{ type: 'key', code: 'KeyA' }] } }).bindings.auto).toEqual([{ type: 'key', code: 'KeyA' }])
  })

  it('gives no default input that another action of the player holds', () => {
    // A player who put Hide text on M before Map existed.
    const fromBeforeMap = parsePlayerSettings({ keysOnLayout: true, bindings: { hideText: [{ type: 'key', code: 'KeyM' }] } })
    expect(fromBeforeMap.bindings.map).toEqual([])
    expect(fromBeforeMap.bindings.hideText).toEqual([{ type: 'key', code: 'KeyM' }])
    // On AZERTY, Skip on the key printing A, Auto on the US default: Auto keeps no key rather than share it.
    setKeyboardLayout(new Map([['KeyQ', 'a'], ['KeyA', 'q']]))
    const fromUsKeys = parsePlayerSettings({ bindings: { skip: [{ type: 'key', code: 'KeyQ' }], auto: [{ type: 'key', code: 'KeyA' }] } })
    expect([fromUsKeys.bindings.skip, fromUsKeys.bindings.auto]).toEqual([[{ type: 'key', code: 'KeyQ' }], []])
    // A grid's input is no everyday action's.
    expect(parsePlayerSettings({ keysOnLayout: true, bindings: { fullscreen: [{ type: 'key', code: 'KeyG' }] } }).bindings.markTile).toEqual(DEFAULT_BINDINGS.markTile)
  })
})
