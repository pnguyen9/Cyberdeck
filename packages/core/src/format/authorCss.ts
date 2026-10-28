/**
 * The CSS an author writes for the project's styles, checked before any page uses it: a downloaded
 * game is never trusted. Only rules on class names and `@keyframes` are read, with properties that
 * change how text looks, never where it goes or what it loads; what is left out is reported. The
 * classes are renamed `author-<name>`, so that they apply to the story's text and nothing else: the
 * player's own buttons and panels keep their looks.
 *
 * A style is named like its class, spaces as hyphens: `[style: ghost]` is `.ghost`, the style
 * `chapter title` is `.chapter-title`.
 */

export interface CheckedCss {
  /** What the player adds to the page. */
  css: string
  /** The class names the CSS defines, as written: each is a style the text may use. */
  classes: string[]
  /** Each part left out, and why: in English, and as a code with what it depends on, for an editor's own words. */
  dropped: LeftOut[]
  /** How much wider than normal the text of a class is drawn, from its `font-size`: pages are cut to fit. */
  widthScales: Map<string, number>
  /** The font each class names first, unquoted: a font of the project draws wider or narrower than the box's. */
  fontFamilies: Map<string, string>
}

const CLASS_NAME = /^\.(-?[A-Za-z_][\w-]*)$/
const KEYFRAMES_NAME = /^[A-Za-z_][\w-]*$/
const KEYFRAME_SELECTOR = /^(from|to|\d{1,3}(\.\d+)?%)(\s*,\s*(from|to|\d{1,3}(\.\d+)?%))*$/

/** Properties of how text looks; families allowed by their prefix. */
const ALLOWED_PROPERTIES = new Set([
  'color', 'opacity', 'background', 'background-color', 'background-image', 'background-clip', '-webkit-background-clip',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch',
  'letter-spacing', 'word-spacing', 'text-shadow', 'text-transform', 'text-underline-offset',
  '-webkit-text-fill-color', 'box-shadow', 'transform', 'transform-origin', 'filter', 'mix-blend-mode', 'display',
])
const ALLOWED_PREFIXES = ['border', 'outline', 'padding', 'animation', 'transition', 'text-decoration', '-webkit-text-stroke']

/** Anything that could load, run or escape: refused wherever it appears in a value. */
const FORBIDDEN_IN_VALUES = /url\s*\(|image(-set)?\s*\(|cross-fade\s*\(|element\s*\(|expression\s*\(|attr\s*\(|var\s*\(|javascript:|[\\<>@]/i

/** Larger text would no longer fit the two lines of the text box, even cut shorter. */
const MAXIMUM_FONT_SCALE = 1.5

/** The class a style is drawn with: its name in lower case, spaces as hyphens, other signs left out. */
export function styleClassName(styleName: string): string {
  return styleName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
}

export type LeftOutReason =
  | { code: 'keyframesName' }
  | { code: 'keyframeStep' }
  | { code: 'classNamesOnly' }
  | { code: 'notARule' }
  | { code: 'braceNotClosed' }
  | { code: 'nameAndValue' }
  | { code: 'notHowTextLooks' }
  | { code: 'loadsOrComputes' }
  | { code: 'inlineOnly' }
  | { code: 'fontSize'; maximum: number }
  | { code: 'spacingUnit'; property: string }
  | { code: 'edgeSize'; edge: 'borders' | 'padding'; maximum: number }

export interface LeftOut {
  text: string
  reason: string
  why: LeftOutReason
}

/** The English of each reason. */
function reasonText(why: LeftOutReason): string {
  switch (why.code) {
    case 'keyframesName':
      return 'a keyframes name is letters, digits, hyphens and underscores'
    case 'keyframeStep':
      return 'a keyframe is from, to or a percentage'
    case 'classNamesOnly':
      return 'only class names are styled here: .ghost, or .ghost, .whisper'
    case 'notARule':
      return 'not a rule: a class name, then its properties in braces'
    case 'braceNotClosed':
      return 'a brace is never closed'
    case 'nameAndValue':
      return 'a property is written name: value'
    case 'notHowTextLooks':
      return 'not a property of how text looks'
    case 'loadsOrComputes':
      return 'nothing may be loaded or computed: no url(), var(), attr(), @, \\ or quotes but around font names'
    case 'inlineOnly':
      return 'text stays in its line: display is inline or inline-block'
    case 'fontSize':
      return `font-size in em or %, at most ${why.maximum}em, for the text to fit the box`
    case 'spacingUnit':
      return `${why.property} in em or px, for the pages to be cut to fit`
    case 'edgeSize':
      return `${why.edge} in em or px, at most ${why.maximum}em, for the text to fit its line`
  }
}

function leftOut(text: string, why: LeftOutReason): LeftOut {
  return { text, reason: reasonText(why), why }
}

/** The last CSS checked, and its result: the same CSS is checked again on every key typed elsewhere. */
let lastChecked: { source: string; result: CheckedCss } | null = null

export function checkAuthorCss(source: string): CheckedCss {
  if (lastChecked?.source !== source) {
    lastChecked = { source, result: check(source) }
  }
  return lastChecked.result
}

function check(source: string): CheckedCss {
  const dropped: CheckedCss['dropped'] = []
  const classes: string[] = []
  /** The properties each class ends up with, rules on the same class added up, the last one winning. */
  const propertiesByClass = new Map<string, Map<string, string>>()
  const rules: string[] = []
  const blocks = readBlocks(source.replace(/\/\*[\s\S]*?\*\//g, ''), dropped)
  const keyframeNames = new Set(blocks.flatMap(block => {
    const match = /^@keyframes\s+(\S+)$/i.exec(block.prelude)
    return match !== null && KEYFRAMES_NAME.test(match[1]!) ? [match[1]!] : []
  }))

  for (const block of blocks) {
    const keyframes = /^@keyframes\s+(\S+)$/i.exec(block.prelude)
    if (keyframes !== null) {
      if (!KEYFRAMES_NAME.test(keyframes[1]!)) {
        dropped.push(leftOut(block.prelude, { code: 'keyframesName' }))
        continue
      }
      const steps = readBlocks(block.body, dropped).flatMap(step => {
        if (!KEYFRAME_SELECTOR.test(step.prelude)) {
          dropped.push(leftOut(step.prelude, { code: 'keyframeStep' }))
          return []
        }
        const declarations = checkDeclarations(step.body, keyframeNames, dropped)
        return declarations.length === 0 ? [] : [`${step.prelude} { ${declarations.map(([property, value]) => `${property}: ${value};`).join(' ')} }`]
      })
      rules.push(`@keyframes author-${keyframes[1]} { ${steps.join(' ')} }`)
      continue
    }
    const selectors = block.prelude.split(',').map(selector => selector.trim())
    const written = selectors.map(selector => CLASS_NAME.exec(selector)?.[1] ?? null)
    if (block.prelude.startsWith('@') || written.some(name => name === null)) {
      dropped.push(leftOut(block.prelude, { code: 'classNamesOnly' }))
      continue
    }
    const declarations = checkDeclarations(block.body, keyframeNames, dropped)
    if (declarations.length === 0) {
      continue
    }
    // Named as the styles are: `.Ghost` is the class of the style ghost.
    const names = [...new Set((written as string[]).map(styleClassName))]
    for (const name of names) {
      if (!classes.includes(name)) {
        classes.push(name)
      }
      const properties = propertiesByClass.get(name) ?? new Map<string, string>()
      declarations.forEach(([property, value]) => properties.set(property, value))
      propertiesByClass.set(name, properties)
    }
    rules.push(`${names.map(name => `.author-${name}`).join(', ')} { ${declarations.map(([property, value]) => `${property}: ${value};`).join(' ')} }`)
  }
  const widthScales = new Map([...propertiesByClass].flatMap(([name, properties]) => {
    const scale = widthScaleOf(properties)
    return scale === 1 ? [] : [[name, scale] as const]
  }))
  const fontFamilies = new Map([...propertiesByClass].flatMap(([name, properties]) => {
    const family = properties.get('font-family')?.split(',')[0]?.trim().replace(/^["']|["']$/g, '')
    return family === undefined || family === '' ? [] : [[name, family] as const]
  }))
  return { css: rules.join('\n'), classes, dropped, widthScales, fontFamilies }
}
/** Top-level `prelude { body }` blocks, braces nested once (keyframes); what is not a block is reported. */
function readBlocks(source: string, dropped: CheckedCss['dropped']): { prelude: string; body: string }[] {
  const blocks: { prelude: string; body: string }[] = []
  let index = 0
  while (index < source.length) {
    const open = source.indexOf('{', index)
    if (open === -1) {
      const rest = source.slice(index).trim()
      if (rest !== '') {
        dropped.push(leftOut(rest, { code: 'notARule' }))
      }
      break
    }
    let depth = 1
    let close = open + 1
    while (close < source.length && depth > 0) {
      depth += source[close] === '{' ? 1 : source[close] === '}' ? -1 : 0
      close++
    }
    const prelude = source.slice(index, open).trim()
    if (depth > 0) {
      dropped.push(leftOut(prelude, { code: 'braceNotClosed' }))
      break
    }
    blocks.push({ prelude, body: source.slice(open + 1, close - 1) })
    index = close
  }
  return blocks
}

/** Properties that make a text's line wider by their lengths, which must be small and measurable. */
const WIDENING_PROPERTIES = /^(padding|border)/
/** At most this, on each side: the margin left at the end of each line absorbs it. */
const MAXIMUM_EDGE_EM = 0.25
/** A length of the text, `0.1em`, `.1em` or `4px` (pixels of the text box's font, 44 pixels to the em). */
const LENGTH = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(em|px)$/i
const TEXT_FONT_PIXELS = 44

function emOf(length: string): number | null {
  if (length === '0') {
    return 0
  }
  const match = LENGTH.exec(length)
  return match === null ? null : Number(match[1]) / (match[2]!.toLowerCase() === 'px' ? TEXT_FONT_PIXELS : 1)
}

/** The declarations kept, each property and value, keyframe names renamed as the rules are. */
function checkDeclarations(body: string, keyframeNames: ReadonlySet<string>, dropped: CheckedCss['dropped']): [string, string][] {
  const kept: [string, string][] = []
  for (const declaration of body.split(';').map(part => part.trim()).filter(part => part !== '')) {
    const colon = declaration.indexOf(':')
    const property = colon === -1 ? '' : declaration.slice(0, colon).trim().toLowerCase()
    let value = colon === -1 ? '' : declaration.slice(colon + 1).replace(/!\s*important\s*$/i, '').trim()
    const why = reasonToLeaveOut(property, value)
    if (why !== null) {
      dropped.push(leftOut(declaration, why))
      continue
    }
    if (property.startsWith('animation')) {
      value = value.replace(/[A-Za-z_][\w-]*/g, word => keyframeNames.has(word) ? `author-${word}` : word)
    }
    kept.push([property, value])
  }
  return kept
}

function reasonToLeaveOut(property: string, value: string): LeftOutReason | null {
  if (property === '' || value === '') {
    return { code: 'nameAndValue' }
  }
  if (!ALLOWED_PROPERTIES.has(property) && !ALLOWED_PREFIXES.some(prefix => property === prefix || property.startsWith(`${prefix}-`))) {
    return { code: 'notHowTextLooks' }
  }
  // Font names alone may be quoted, "Times New Roman"; a quote anywhere else could hide the end of a value.
  const quotes = value.match(/["']/g)?.length ?? 0
  if (FORBIDDEN_IN_VALUES.test(value) || /[{}]|\/\*|src\s*\(/i.test(value) || (quotes > 0 && (property !== 'font-family' || quotes % 2 !== 0))) {
    return { code: 'loadsOrComputes' }
  }
  if (property === 'display' && !/^(inline|inline-block)$/i.test(value)) {
    return { code: 'inlineOnly' }
  }
  if (property === 'font-size' && fontScale(value) === null) {
    return { code: 'fontSize', maximum: MAXIMUM_FONT_SCALE }
  }
  if ((property === 'letter-spacing' || property === 'word-spacing') && value !== 'normal' && emOf(value) === null) {
    return { code: 'spacingUnit', property }
  }
  if (WIDENING_PROPERTIES.test(property)) {
    const lengths = value.split(/\s+/).filter(part => /^-?[\d.]/.test(part))
    if (lengths.some(length => { const em = emOf(length); return em === null || Math.abs(em) > MAXIMUM_EDGE_EM })) {
      return { code: 'edgeSize', edge: property.startsWith('border') ? 'borders' : 'padding', maximum: MAXIMUM_EDGE_EM }
    }
  }
  return null
}

/**
 * How much wider a class draws text, when it does: its font size, its letter spacing over glyphs
 * about half an em wide, its word spacing over words of about five letters.
 */
function widthScaleOf(properties: ReadonlyMap<string, string>): number {
  const fontSize = fontScale(properties.get('font-size') ?? '1em') ?? 1
  const letterSpacing = Math.max(0, emOf(properties.get('letter-spacing') ?? '0') ?? 0)
  const wordSpacing = Math.max(0, emOf(properties.get('word-spacing') ?? '0') ?? 0)
  return fontSize * (1 + letterSpacing * 2) * (1 + wordSpacing / 2.75)
}

/** A font size relative to the text's, as a factor, when within bounds: `1.2em`, `120%`, `smaller`. */
function fontScale(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(em|%)$/i.exec(value.trim())
  const scale = value.trim() === 'smaller' ? 0.83 : match === null ? null : Number(match[1]) / (match[2] === '%' ? 100 : 1)
  return scale !== null && scale > 0 && scale <= MAXIMUM_FONT_SCALE ? scale : null
}
