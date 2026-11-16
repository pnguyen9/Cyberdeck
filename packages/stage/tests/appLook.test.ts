import { describe, expect, it } from 'vitest'
import {
  applyAppLook,
  contrastRatio,
  createAppLookStore,
  DEFAULT_APP_LOOK,
  isBright,
  LOOK_PRESETS,
  lookVariables,
  parseAppLook,
  presetOf,
  PRESET_LOOKS,
  READABLE_CONTRAST,
  VISIBLE_CONTRAST,
  readableBoxColour,
  readableOver,
  worstContrast,
  type AppLook,
} from '../src/look/appLook'
import { memoryStorage } from './memoryStorage'

describe('the apps’ own look', () => {
  it('is cyberpunk by default, to the shade it always had', () => {
    expect(presetOf(DEFAULT_APP_LOOK)).toBe('cyberpunk')
    expect(lookVariables(DEFAULT_APP_LOOK)).toMatchObject({
      '--look-background': '#0b0d12',
      '--look-box': 'transparent',
      '--look-text': '#e6e9ef',
      '--look-accent': '#9eeaff',
      '--look-surface': '#11151d',
      '--look-muted': '#7b8597',
      '--look-soft': '#a3acbb',
      '--look-accent-fill': '#0e2a36',
      '--look-border-colour': '#2c3442',
      '--look-border-style': 'solid',
      '--look-border-width': '1px',
      '--look-error': '#f28b82',
      '--look-amber': '#fbbf24',
      '--look-scheme': 'dark',
    })
  })

  it('keeps what was chosen, and takes the default for what is missing or damaged', () => {
    const chosen: AppLook = { ...PRESET_LOOKS.dusk, borderKind: 'double', font: 'mono' }
    expect(parseAppLook(JSON.parse(JSON.stringify(chosen)))).toEqual(chosen)
    expect(parseAppLook({ borderKind: 'wavy', textColour: 'red', accentColour: '#ABCDEF', corners: ['#000000', 'x'] })).toEqual({ ...DEFAULT_APP_LOOK, accentColour: '#abcdef' })
    expect(parseAppLook({ corners: ['#111111', 'blue', '#333333', '#444444'] }).corners).toEqual(['#111111', '#0b0d12', '#333333', '#444444'])
    expect(parseAppLook('nonsense')).toEqual(DEFAULT_APP_LOOK)
    expect(parseAppLook(null)).toEqual(DEFAULT_APP_LOOK)
  })

  it('knows a preset as long as nothing was changed', () => {
    expect(presetOf({ ...PRESET_LOOKS.paper })).toBe('paper')
    expect(presetOf({ ...PRESET_LOOKS.paper, textColour: '#1F2328' })).toBe('paper')
    expect(presetOf({ ...PRESET_LOOKS.paper, borderKind: 'dotted' })).toBeNull()
  })

  it('makes the readable box dark on a dark background, light on a bright one', () => {
    const night: AppLook = { ...DEFAULT_APP_LOOK, backgroundKind: 'gradient', corners: ['#000033', '#330000', '#003300', '#222222'], readableBox: true }
    const day: AppLook = { ...night, corners: ['#ffeeaa', '#aaddff', '#ffffff', '#ccffcc'] }
    expect(isBright(readableBoxColour(night))).toBe(false)
    expect(isBright(readableBoxColour(day))).toBe(true)
    // Calmer than the background: further from the middle grey.
    expect(contrastRatio(readableBoxColour(day), '#000000')).toBeGreaterThan(contrastRatio('#bbddcc', '#000000'))
    expect(lookVariables(day)['--look-box']).toBe(readableBoxColour(day))
    expect(lookVariables(day)['--look-scheme']).toBe('light')
  })

  it('judges the text by the worst corner, or by the box when there is one', () => {
    const half: AppLook = { ...DEFAULT_APP_LOOK, backgroundKind: 'gradient', corners: ['#000000', '#000000', '#000000', '#ffffff'], textColour: '#ffffff' }
    expect(worstContrast('#ffffff', half)).toBeCloseTo(1)
    expect(worstContrast('#ffffff', { ...half, readableBox: true })).toBeGreaterThan(READABLE_CONTRAST)
  })

  it('darkens or lightens the colours it works out until they read', () => {
    expect(readableOver('#f28b82', '#0b0d12')).toBe('#f28b82')
    const onPaper = readableOver('#fbbf24', '#ffffff')
    expect(contrastRatio(onPaper, '#ffffff')).toBeGreaterThanOrEqual(READABLE_CONTRAST)
    const paper = lookVariables(PRESET_LOOKS.paper)
    for (const name of ['--look-muted', '--look-soft', '--look-error', '--look-warning', '--look-success', '--look-amber', '--look-violet', '--look-teal']) {
      expect(contrastRatio(paper[name]!, paper['--look-ground']!), name).toBeGreaterThanOrEqual(READABLE_CONTRAST)
    }
  })

  it('offers presets whose text and titles all read', () => {
    for (const preset of LOOK_PRESETS) {
      const look = PRESET_LOOKS[preset]
      expect(worstContrast(look.textColour, look), preset).toBeGreaterThanOrEqual(7)
      expect(worstContrast(look.accentColour, look), preset).toBeGreaterThanOrEqual(READABLE_CONTRAST)
    }
  })

  it('draws a double border wide enough to show as two lines', () => {
    expect(lookVariables({ ...DEFAULT_APP_LOOK, borderKind: 'double' })['--look-border-width']).toBe('3px')
    expect(lookVariables({ ...DEFAULT_APP_LOOK, borderKind: 'none' })['--look-border-style']).toBe('none')
  })

  it('spreads one colour to the four corners', () => {
    const look: AppLook = { ...DEFAULT_APP_LOOK, backgroundColour: '#123456', corners: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'] }
    const variables = lookVariables(look)
    expect([variables['--look-corner-top-left'], variables['--look-corner-bottom-right']]).toEqual(['#123456', '#123456'])
    expect(lookVariables({ ...look, backgroundKind: 'gradient' })['--look-corner-top-right']).toBe('#00ff00')
  })

  it('is given to the page as custom properties', () => {
    const properties = new Map<string, string>()
    const element = { style: { setProperty: (name: string, value: string) => properties.set(name, value) }, dataset: {} as Record<string, string> }
    applyAppLook(PRESET_LOOKS.contrast, element as unknown as HTMLElement)
    expect(properties.get('--look-accent')).toBe('#ffff00')
    expect(element.dataset.look).toBe('contrast')
    applyAppLook({ ...PRESET_LOOKS.contrast, font: 'serif' }, element as unknown as HTMLElement)
    expect(element.dataset.look).toBe('custom')
  })

  it('is kept in a storage, the default standing in when it cannot be read', () => {
    const storage = memoryStorage()
    const store = createAppLookStore(() => storage, 'app:look')
    expect(store.read()).toEqual({ look: DEFAULT_APP_LOOK, custom: null })
    expect(store.write({ look: PRESET_LOOKS.graphite, custom: null })).toBe(true)
    expect(store.read()).toEqual({ look: PRESET_LOOKS.graphite, custom: null })
    storage.setItem('app:look', '{broken')
    expect(store.read()).toEqual({ look: DEFAULT_APP_LOOK, custom: null })
    const refusing = createAppLookStore(() => {
      throw new Error('denied')
    }, 'app:look')
    expect(refusing.read()).toEqual({ look: DEFAULT_APP_LOOK, custom: null })
    expect(refusing.write({ look: DEFAULT_APP_LOOK, custom: null })).toBe(false)
  })

  it('keeps the last custom look beside a preset taken, to come back to', () => {
    const storage = memoryStorage()
    const store = createAppLookStore(() => storage, 'app:look')
    const own: AppLook = { ...PRESET_LOOKS.paper, borderKind: 'dotted' }
    store.write({ look: PRESET_LOOKS.dusk, custom: own })
    expect(store.read()).toEqual({ look: PRESET_LOOKS.dusk, custom: own })
  })

  it('keeps a faint edge on controls when the look has no border, and a visible focus ring', () => {
    const bare = lookVariables({ ...DEFAULT_APP_LOOK, borderKind: 'none' })
    const edge = /^1px solid (#[0-9a-f]{6})$/.exec(bare['--look-control-border']!)?.[1]
    expect(contrastRatio(edge!, bare['--look-ground']!)).toBeGreaterThanOrEqual(VISIBLE_CONTRAST)
    expect(lookVariables(DEFAULT_APP_LOOK)['--look-control-border']).toBe('1px solid #2c3442')
    expect(lookVariables(DEFAULT_APP_LOOK)['--look-focus']).toBe('#9eeaff')
    expect(lookVariables({ ...PRESET_LOOKS.paper, accentColour: '#eeeeee' })['--look-focus']).toBe(PRESET_LOOKS.paper.textColour)
  })
})
