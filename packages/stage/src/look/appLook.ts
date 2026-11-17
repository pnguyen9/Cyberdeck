/**
 * The look of Cyberdeck's and Datajack's own screens: their colours, borders, background and font.
 * Never a game's: the stage a game plays on keeps its own colours and its author's CSS.
 */
export interface AppLook {
  borderColour: string
  borderKind: BorderKind
  /** One colour, or a gradient from four, one per corner. */
  backgroundKind: BackgroundKind
  backgroundColour: string
  /** Top left, top right, bottom left, bottom right. */
  corners: Corners
  font: FontChoice
  textColour: string
  /** Titles, buttons chosen, links hovered, focus. */
  accentColour: string
  /** A plain box under the text, its colour taken from the background's brightness. */
  readableBox: boolean
}

export const BORDER_KINDS = ['solid', 'dashed', 'dotted', 'double', 'none'] as const
export type BorderKind = (typeof BORDER_KINDS)[number]
export const BACKGROUND_KINDS = ['colour', 'gradient'] as const
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number]
export type Corners = readonly [topLeft: string, topRight: string, bottomLeft: string, bottomRight: string]
export const FONT_CHOICES = ['system', 'readable', 'serif', 'mono'] as const
export type FontChoice = (typeof FONT_CHOICES)[number]

/** Each font as a list the browser picks the first it has of. */
export const FONT_STACKS: Readonly<Record<FontChoice, string>> = {
  system: 'system-ui, sans-serif',
  readable: 'Verdana, "DejaVu Sans", "Bitstream Vera Sans", sans-serif',
  serif: 'Georgia, "DejaVu Serif", "Times New Roman", serif',
  mono: 'ui-monospace, "Cascadia Mono", "DejaVu Sans Mono", Menlo, monospace',
}

export const LOOK_PRESETS = ['cyberpunk', 'graphite', 'paper', 'dusk', 'playground', 'forest', 'ocean', 'contrast'] as const
export type LookPreset = (typeof LOOK_PRESETS)[number]

function flat(colour: string): Pick<AppLook, 'backgroundKind' | 'backgroundColour' | 'corners'> {
  return { backgroundKind: 'colour', backgroundColour: colour, corners: [colour, colour, colour, colour] }
}

export const PRESET_LOOKS: Readonly<Record<LookPreset, AppLook>> = {
  /** The look the apps always had. */
  cyberpunk: { borderColour: '#2c3442', borderKind: 'solid', ...flat('#0b0d12'), font: 'system', textColour: '#e6e9ef', accentColour: '#9eeaff', readableBox: false },
  graphite: { borderColour: '#4a4d55', borderKind: 'solid', ...flat('#1f2023'), font: 'system', textColour: '#ececec', accentColour: '#a8c7fa', readableBox: false },
  paper: { borderColour: '#b9b0a0', borderKind: 'solid', ...flat('#f7f4ec'), font: 'serif', textColour: '#1f2328', accentColour: '#1a5296', readableBox: false },
  dusk: {
    borderColour: '#e3a0c8',
    borderKind: 'dashed',
    backgroundKind: 'gradient',
    backgroundColour: '#3a1c71',
    corners: ['#3a1c71', '#d76d77', '#283c86', '#ffaf7b'],
    font: 'readable',
    textColour: '#f8f4ff',
    accentColour: '#ffd27f',
    readableBox: true,
  },
  /** Bright and sunny, for children: a sky, sun, mint and candy gradient under a white box. */
  playground: {
    borderColour: '#d9480f',
    borderKind: 'dashed',
    backgroundKind: 'gradient',
    backgroundColour: '#7fd3ff',
    corners: ['#7fd3ff', '#ffe066', '#8ef0b5', '#ffa8d0'],
    font: 'readable',
    textColour: '#1d2b64',
    accentColour: '#a1006b',
    readableBox: true,
  },
  forest: { borderColour: '#4f7a5a', borderKind: 'solid', ...flat('#14241a'), font: 'system', textColour: '#eaf4e4', accentColour: '#a7e08a', readableBox: false },
  ocean: {
    borderColour: '#5a8fb8',
    borderKind: 'solid',
    backgroundKind: 'gradient',
    backgroundColour: '#0b2545',
    corners: ['#0b2545', '#13315c', '#0d3b4f', '#134e5e'],
    font: 'system',
    textColour: '#e8f6ff',
    accentColour: '#7fdbff',
    readableBox: false,
  },
  contrast: { borderColour: '#ffffff', borderKind: 'solid', ...flat('#000000'), font: 'readable', textColour: '#ffffff', accentColour: '#ffff00', readableBox: false },
}

export const DEFAULT_APP_LOOK: AppLook = PRESET_LOOKS.cyberpunk

/** The preset a look is, unchanged; null once anything was changed in depth. */
export function presetOf(look: AppLook): LookPreset | null {
  return LOOK_PRESETS.find(preset => sameLook(PRESET_LOOKS[preset], look)) ?? null
}

function sameLook(a: AppLook, b: AppLook): boolean {
  return JSON.stringify(normalised(a)) === JSON.stringify(normalised(b))
}

/** The fields in one order, colours in lower case. */
function normalised(look: AppLook): AppLook {
  return {
    borderColour: look.borderColour.toLowerCase(),
    borderKind: look.borderKind,
    backgroundKind: look.backgroundKind,
    backgroundColour: look.backgroundColour.toLowerCase(),
    corners: look.corners.map(corner => corner.toLowerCase()) as unknown as Corners,
    font: look.font,
    textColour: look.textColour.toLowerCase(),
    accentColour: look.accentColour.toLowerCase(),
    readableBox: look.readableBox,
  }
}

/** A look read back from storage: what is missing or damaged takes the default's. */
export function parseAppLook(value: unknown): AppLook {
  const fields = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const colour = (field: unknown, fallback: string) => isHexColour(field) ? field.toLowerCase() : fallback
  const oneOf = <T extends string>(choices: readonly T[], field: unknown, fallback: T): T => (choices as readonly unknown[]).includes(field) ? field as T : fallback
  const savedCorners = Array.isArray(fields.corners) && fields.corners.length === 4 ? fields.corners : []
  const fallback = DEFAULT_APP_LOOK
  return {
    borderColour: colour(fields.borderColour, fallback.borderColour),
    borderKind: oneOf(BORDER_KINDS, fields.borderKind, fallback.borderKind),
    backgroundKind: oneOf(BACKGROUND_KINDS, fields.backgroundKind, fallback.backgroundKind),
    backgroundColour: colour(fields.backgroundColour, fallback.backgroundColour),
    corners: fallback.corners.map((corner, index) => colour(savedCorners[index], corner)) as unknown as Corners,
    font: oneOf(FONT_CHOICES, fields.font, fallback.font),
    textColour: colour(fields.textColour, fallback.textColour),
    accentColour: colour(fields.accentColour, fallback.accentColour),
    readableBox: fields.readableBox === true,
  }
}

export function isHexColour(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

type Rgb = readonly [number, number, number]

function rgbOf(hex: string): Rgb {
  return [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16)) as unknown as Rgb
}

function hexOf(rgb: Rgb): string {
  return `#${rgb.map(channel => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('')}`
}

/** `amount` of the way from `from` to `to`, in sRGB as CSS mixes by default. */
export function mixColours(from: string, to: string, amount: number): string {
  const [a, b] = [rgbOf(from), rgbOf(to)]
  return hexOf(a.map((channel, index) => channel + (b[index]! - channel) * amount) as unknown as Rgb)
}

/** The average of colours, as the eye takes a gradient in at a glance. */
export function averageColour(colours: readonly string[]): string {
  const rgbs = colours.map(rgbOf)
  return hexOf([0, 1, 2].map(index => rgbs.reduce((sum, rgb) => sum + rgb[index]!, 0) / rgbs.length) as unknown as Rgb)
}

/** Relative luminance, as WCAG defines it: 0 for black, 1 for white. */
export function luminance(colour: string): number {
  const [red, green, blue] = rgbOf(colour).map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as unknown as Rgb
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG's contrast ratio, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/** What WCAG asks of ordinary text (AA). */
export const READABLE_CONTRAST = 4.5

/** What WCAG asks of what shows a control or the focus: its edge, its outline (AA, 1.4.11). */
export const VISIBLE_CONTRAST = 3

/**
 * Whether a colour is bright: above this luminance, black text stands out more than white does
 * (both contrasts are equal there).
 */
export function isBright(colour: string): boolean {
  return luminance(colour) > 0.179
}

/** The readable box's colour: the background's, darkened when it is dark, lightened when it is bright. */
export function readableBoxColour(look: AppLook): string {
  const background = backgroundOf(look)
  return isBright(background) ? mixColours(background, '#ffffff', 0.82) : mixColours(background, '#000000', 0.72)
}

/** The background as one colour: the colour itself, or the gradient's average. */
export function backgroundOf(look: AppLook): string {
  return look.backgroundKind === 'colour' ? look.backgroundColour : averageColour(look.corners)
}

/** What the text lies on: the readable box, or the background. */
export function groundOf(look: AppLook): string {
  return look.readableBox ? readableBoxColour(look) : backgroundOf(look)
}

/**
 * The worst contrast of a colour over what it lies on: the readable box, or each corner of the
 * gradient (its middle is a mix of them, so never worse).
 */
export function worstContrast(colour: string, look: AppLook): number {
  if (look.readableBox || look.backgroundKind === 'colour') {
    return contrastRatio(colour, groundOf(look))
  }
  return Math.min(...look.corners.map(corner => contrastRatio(colour, corner)))
}

/** The colour, darkened or lightened just enough to read over the ground. */
export function readableOver(colour: string, ground: string, ratio = READABLE_CONTRAST): string {
  const towards = isBright(ground) ? '#000000' : '#ffffff'
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = mixColours(colour, towards, amount)
    if (contrastRatio(candidate, ground) >= ratio) {
      return candidate
    }
  }
  return towards
}

/** The colours the screens give meaning to: errors, warnings, what went well, and the kinds of the storyboard's chips. */
const SIGNAL_COLOURS = {
  error: '#f28b82',
  warning: '#f6c177',
  success: '#a3e4b0',
  amber: '#fbbf24',
  gold: '#f5c451',
  violet: '#c4b5fd',
  teal: '#5eead4',
  blue: '#93c5fd',
  rose: '#fda4af',
  pink: '#f9a8d4',
  lime: '#bef264',
} as const

/** The look as it always was, to the shade: what the presets do not say is worked out for the others. */
const CYBERPUNK_SHADES: Readonly<Record<string, string>> = {
  '--look-surface': '#11151d',
  '--look-soft': '#a3acbb',
  '--look-text-soft': '#c7cdd8',
  '--look-muted': '#7b8597',
  '--look-line': '#5d6b80',
  '--look-faint': '#3a4252',
  '--look-accent-fill': '#0e2a36',
  '--look-amber-fill': '#2a2010',
}

/**
 * The edge of a control (a button, a field): the border, or, when the look has none, a faint line
 * still telling where the control is, as WCAG asks.
 */
function controlBorderOf(look: AppLook, ground: string): string {
  if (look.borderKind !== 'none') {
    return `${look.borderKind === 'double' ? '3px' : '1px'} ${look.borderKind} ${look.borderColour}`
  }
  return `1px solid ${readableOver(mixColours(look.textColour, ground, 0.6), ground, VISIBLE_CONTRAST)}`
}

/** The focus ring: the accent, or the text's colour when the accent stands out too little. */
export function focusColourOf(look: AppLook): string {
  return worstContrast(look.accentColour, look) >= VISIBLE_CONTRAST ? look.accentColour : look.textColour
}

/** The CSS custom properties the apps' styles are written with, for a look; `preset`, when it is known already. */
export function lookVariables(look: AppLook, preset: LookPreset | null = presetOf(look)): Record<string, string> {
  const background = backgroundOf(look)
  const ground = groundOf(look)
  const text = look.textColour
  const [topLeft, topRight, bottomLeft, bottomRight] = look.backgroundKind === 'colour' ? flat(look.backgroundColour).corners : look.corners
  const variables: Record<string, string> = {
    '--look-corner-top-left': topLeft,
    '--look-corner-top-right': topRight,
    '--look-corner-bottom-left': bottomLeft,
    '--look-corner-bottom-right': bottomRight,
    '--look-background': background,
    '--look-box': look.readableBox ? ground : 'transparent',
    /** What the text lies on, for what floats over the page (dialogs, menus). */
    '--look-ground': ground,
    '--look-scheme': isBright(ground) ? 'light' : 'dark',
    '--look-font': FONT_STACKS[look.font],
    '--look-text': text,
    '--look-text-soft': mixColours(text, ground, 0.12),
    '--look-soft': readableOver(mixColours(text, ground, 0.25), ground),
    '--look-muted': readableOver(mixColours(text, ground, 0.42), ground),
    '--look-line': mixColours(text, ground, 0.55),
    '--look-faint': mixColours(text, ground, 0.75),
    '--look-surface': mixColours(ground, text, 0.05),
    '--look-accent': look.accentColour,
    '--look-accent-fill': mixColours(ground, look.accentColour, 0.16),
    '--look-amber-fill': mixColours(ground, SIGNAL_COLOURS.amber, 0.12),
    '--look-border-colour': look.borderColour,
    '--look-border-style': look.borderKind,
    // A double line needs three pixels to show as two.
    '--look-border-width': look.borderKind === 'double' ? '3px' : '1px',
    '--look-control-border': controlBorderOf(look, ground),
    '--look-focus': focusColourOf(look),
  }
  for (const [name, colour] of Object.entries(SIGNAL_COLOURS)) {
    variables[`--look-${name}`] = readableOver(colour, ground)
  }
  return preset === 'cyberpunk' ? { ...variables, ...CYBERPUNK_SHADES } : variables
}

/**
 * Gives an element, the page's root, the look's custom properties, and its document's `theme-color`
 * the background's colour, for the browser's bar and the installed application's window. Returns
 * the preset the look is, if any.
 */
export function applyAppLook(look: AppLook, element: Pick<HTMLElement, 'style' | 'dataset'> & { ownerDocument?: Document | null }): LookPreset | null {
  const preset = presetOf(look)
  for (const [name, value] of Object.entries(lookVariables(look, preset))) {
    element.style.setProperty(name, value)
  }
  element.dataset.look = preset ?? 'custom'
  const document = element.ownerDocument
  if (document != null) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta === null) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.append(meta)
    }
    meta.content = backgroundOf(look)
  }
  return preset
}

/** The look chosen, and the last look the person made their own, to come back to after trying a preset. */
export interface KeptLook {
  look: AppLook
  custom: AppLook | null
}

/**
 * A look kept in a `Storage` (`localStorage`) under one key, the last custom look with it;
 * unreadable or unwritable storage keeps the default.
 */
export function createAppLookStore(storage: () => Storage, key: string) {
  return {
    read(): KeptLook {
      try {
        const stored: unknown = JSON.parse(storage().getItem(key) ?? 'null')
        const custom = typeof stored === 'object' && stored !== null && 'custom' in stored && typeof stored.custom === 'object' && stored.custom !== null ? parseAppLook(stored.custom) : null
        return { look: parseAppLook(stored), custom }
      } catch {
        return { look: DEFAULT_APP_LOOK, custom: null }
      }
    },
    write({ look, custom }: KeptLook): boolean {
      try {
        storage().setItem(key, JSON.stringify(custom === null ? look : { ...look, custom }))
        return true
      } catch {
        return false
      }
    },
  }
}
