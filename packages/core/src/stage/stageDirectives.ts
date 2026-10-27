import type { AnimationKind, Depth, Facing, FadeColor, FlashColor, ShakeStrength, TintName } from '../format/storyFormat'
import type { Directive } from '../importer/importTypes'
import { CONTROL_DIRECTIVE_NAMES } from '../importer/readControl'
import { normalizeName } from '../importer/storyNodes'

/**
 * A stage directive as the writer meant it, still with names: the import checks it, then the
 * storage resolves the names to registry entries.
 */
export type StageInstruction =
  | { type: 'background'; background: string }
  | { type: 'transition'; name: string; durationMs: number | null }
  | { type: 'music'; track: string | null }
  | { type: 'sound'; sound: string }
  | { type: 'enter'; character: string; position: PositionWord | null; facing: Facing | null; depth: Depth | null; expression: string | null; animation: AnimationWords }
  | { type: 'exit'; character: string; animation: AnimationWords }
  | { type: 'move'; character: string; position: PositionWord | null; depth: Depth | null; animation: AnimationWords }
  | { type: 'expression'; character: string; expression: string }
  | { type: 'wait'; seconds: number }
  | { type: 'shake'; strength: ShakeStrength; durationMs: number | null }
  | { type: 'flash'; color: FlashColor; durationMs: number | null }
  | { type: 'fade'; direction: 'out' | 'in'; color: FadeColor; durationMs: number | null }
  | { type: 'tint'; tint: TintName | null }
  | { type: 'textMode'; mode: 'box' | 'full' }
  | { type: 'illustration'; illustration: string | null }
  | { type: 'clear' }

/** A preset name (`left`, or one the project added) or an exact percentage of the stage width (`35%`). */
export type PositionWord = { type: 'preset'; name: string } | { type: 'exact'; x: number }

/** Null fields are left to the project defaults. */
export interface AnimationWords {
  kind: AnimationKind | null
  durationMs: number | null
  wait: boolean
}

/** What interpreting a directive needs to know about the project. */
export interface StageVocabulary {
  /** Known characters, read whole when their name has several words: `[enter: Old Marie left]`. */
  characterNames: readonly string[]
  /** Position presets of the project. */
  positionNames: readonly string[]
}

export const STAGE_KEYWORDS: readonly string[] = ['bg', 'background', 'transition', 'music', 'sound', 'enter', 'exit', 'move', 'wait', 'shake', 'flash', 'fade out', 'fade in', 'tint', 'text', 'clear', 'illustration', 'cg', 'style']

const SHAKE_STRENGTHS: readonly ShakeStrength[] = ['light', 'strong']
const FLASH_COLORS: readonly FlashColor[] = ['white', 'red', 'black']
const FADE_COLORS: readonly FadeColor[] = ['black', 'white']
const TINTS: readonly TintName[] = ['sepia', 'night', 'grey']

/**
 * The words of an effect: at most one of `names`, at most one duration (`0.4s`, `500ms`, or a
 * number of seconds). Null when a word is anything else.
 */
function readEffectWords<Name extends string>(words: readonly string[], names: readonly Name[]): { name: Name | null; durationMs: number | null } | null {
  const read = { name: null as Name | null, durationMs: null as number | null }
  for (const word of words.map(candidate => candidate.toLowerCase())) {
    const duration = /^(\d+(?:\.\d+)?)(s|ms)?$/.exec(word)
    if (duration !== null && read.durationMs === null) {
      read.durationMs = Number(duration[1]) * (duration[2] === 'ms' ? 1 : 1000)
    } else if ((names as readonly string[]).includes(word) && read.name === null) {
      read.name = word as Name
    } else {
      return null
    }
  }
  return read
}

/** Other spellings of the default presets. */
const POSITION_ALIASES: Readonly<Record<string, string>> = { centre: 'center', middle: 'center' }

export const ANIMATIONS_BY_DIRECTIVE: Readonly<Record<'enter' | 'exit' | 'move', readonly AnimationKind[]>> = {
  enter: ['instant', 'fade', 'slide-from-left', 'slide-from-right'],
  exit: ['instant', 'fade', 'slide-to-left', 'slide-to-right'],
  move: ['instant'],
}
const ALL_ANIMATIONS = new Set<string>([...ANIMATIONS_BY_DIRECTIVE.enter, ...ANIMATIONS_BY_DIRECTIVE.exit])

const DEFAULT_WAIT_SECONDS = 0.5

/** A word after the character name, sorted into what it sets; `other` words are expressions or mistakes. */
type ArgumentWord =
  | { type: 'position'; position: PositionWord }
  | { type: 'facing'; facing: Facing }
  | { type: 'depth'; depth: Depth }
  | { type: 'animation'; kind: AnimationKind }
  | { type: 'duration'; durationMs: number }
  | { type: 'wait' }
  | { type: 'invalid' }
  | { type: 'other'; word: string }

function classifyWord(word: string, vocabulary: StageVocabulary): ArgumentWord {
  const lowerCaseWord = word.toLowerCase()
  const presetName = POSITION_ALIASES[lowerCaseWord] ?? lowerCaseWord
  const preset = vocabulary.positionNames.find(name => normalizeName(name) === presetName)
  if (preset !== undefined) {
    return { type: 'position', position: { type: 'preset', name: preset } }
  }
  const percentage = /^(\d+(?:\.\d+)?)%$/.exec(lowerCaseWord)
  if (percentage !== null) {
    const x = Number(percentage[1])
    return x <= 100 ? { type: 'position', position: { type: 'exact', x } } : { type: 'invalid' }
  }
  if (lowerCaseWord === 'near' || lowerCaseWord === 'middle' || lowerCaseWord === 'far') {
    return { type: 'depth', depth: lowerCaseWord }
  }
  if (lowerCaseWord === 'facing-left' || lowerCaseWord === 'facing-right') {
    return { type: 'facing', facing: lowerCaseWord === 'facing-left' ? 'left' : 'right' }
  }
  if (ALL_ANIMATIONS.has(lowerCaseWord)) {
    return { type: 'animation', kind: lowerCaseWord as AnimationKind }
  }
  const duration = /^(\d+(?:\.\d+)?)(s|ms)$/.exec(lowerCaseWord)
  if (duration !== null) {
    return { type: 'duration', durationMs: Number(duration[1]) * (duration[2] === 's' ? 1000 : 1) }
  }
  return lowerCaseWord === 'wait' ? { type: 'wait' } : { type: 'other', word }
}

/**
 * Sorts the words after the character name. Null when a word is out of place: a second
 * position, an animation this directive cannot play, or an unknown word where none is allowed.
 */
function readArgumentWords(words: readonly string[], directive: 'enter' | 'exit' | 'move', vocabulary: StageVocabulary) {
  const read = { position: null as PositionWord | null, facing: null as Facing | null, depth: null as Depth | null, expression: null as string | null, animation: { kind: null, durationMs: null, wait: false } as AnimationWords }
  for (const word of words) {
    const classified = classifyWord(word, vocabulary)
    switch (classified.type) {
      case 'position':
        if (read.position !== null || directive === 'exit') {
          return null
        }
        read.position = classified.position
        break
      case 'facing':
        if (read.facing !== null || directive !== 'enter') {
          return null
        }
        read.facing = classified.facing
        break
      case 'depth':
        if (read.depth !== null || directive === 'exit') {
          return null
        }
        read.depth = classified.depth
        break
      case 'animation':
        if (read.animation.kind !== null || !ANIMATIONS_BY_DIRECTIVE[directive].includes(classified.kind)) {
          return null
        }
        read.animation.kind = classified.kind
        break
      case 'duration':
        if (read.animation.durationMs !== null) {
          return null
        }
        read.animation.durationMs = classified.durationMs
        break
      case 'wait':
        read.animation.wait = true
        break
      case 'invalid':
        return null
      case 'other':
        if (read.expression !== null || directive !== 'enter') {
          return null
        }
        read.expression = classified.word
        break
    }
  }
  return read
}

/**
 * Reads a stage directive. A name that is not a keyword is a character changing expression:
 * `[marie: surprised]`. Returns null when the directive lacks what it needs.
 *
 * In `enter`, `exit` and `move`, the words after the character name may come in any order: a
 * position, `facing-left` or `facing-right`, an animation, a duration (`1.2s`, `500ms`), `wait`,
 * and for `enter` one expression.
 */
export function interpretStageDirective(directive: Directive, vocabulary: StageVocabulary): StageInstruction | null {
  const directiveArguments = directive.arguments
  const argumentText = directiveArguments.join(' ')

  switch (directive.name) {
    case 'bg':
    case 'background':
      return argumentText === '' ? null : { type: 'background', background: argumentText }
    case 'transition': {
      // Any name: players treat those they do not know as a cut, so that newer ones stay readable.
      const [name, ...rest] = directiveArguments
      const durationWords = rest.length === 0 ? null : readEffectWords(rest, [])
      return name === undefined || durationWords === null && rest.length > 0
        ? null
        : { type: 'transition', name: name.toLowerCase(), durationMs: durationWords?.durationMs ?? null }
    }
    case 'shake': {
      const read = readEffectWords(directiveArguments, SHAKE_STRENGTHS)
      return read === null ? null : { type: 'shake', strength: read.name ?? 'light', durationMs: read.durationMs }
    }
    case 'flash': {
      const read = readEffectWords(directiveArguments, FLASH_COLORS)
      return read === null ? null : { type: 'flash', color: read.name ?? 'white', durationMs: read.durationMs }
    }
    case 'fade out':
    case 'fade in': {
      // Fading in clears whatever colour the screen faded out to.
      const read = readEffectWords(directiveArguments, directive.name === 'fade out' ? FADE_COLORS : [])
      return read === null ? null : { type: 'fade', direction: directive.name === 'fade out' ? 'out' : 'in', color: read.name ?? 'black', durationMs: read.durationMs }
    }
    case 'text': {
      const mode = argumentText.toLowerCase()
      return mode === 'full' || mode === 'box' ? { type: 'textMode', mode } : null
    }
    case 'clear':
      return argumentText === '' ? { type: 'clear' } : null
    case 'illustration':
    case 'cg':
      return argumentText === '' ? null : { type: 'illustration', illustration: argumentText.toLowerCase() === 'none' ? null : argumentText }
    case 'tint': {
      const tint = argumentText.toLowerCase()
      return tint === 'none' ? { type: 'tint', tint: null } : (TINTS as readonly string[]).includes(tint) ? { type: 'tint', tint: tint as TintName } : null
    }
    case 'music':
      if (argumentText === '') {
        return null
      }
      return { type: 'music', track: argumentText.toLowerCase() === 'stop' ? null : argumentText }
    case 'sound':
      return argumentText === '' ? null : { type: 'sound', sound: argumentText }
    case 'enter': {
      const characterWordCount = leadingCharacterWordCount(directiveArguments, vocabulary)
      const read = readArgumentWords(directiveArguments.slice(characterWordCount), 'enter', vocabulary)
      if (characterWordCount === 0 || read === null) {
        return null
      }
      return {
        type: 'enter',
        character: directiveArguments.slice(0, characterWordCount).join(' '),
        position: read.position,
        facing: read.facing,
        depth: read.depth,
        expression: read.expression,
        animation: read.animation,
      }
    }
    case 'exit':
    case 'move': {
      const nameWordCount = wordsBeforeFirstKeyword(directiveArguments, vocabulary)
      const read = readArgumentWords(directiveArguments.slice(nameWordCount), directive.name, vocabulary)
      const character = directiveArguments.slice(0, nameWordCount).join(' ')
      if (character === '' || read === null) {
        return null
      }
      if (directive.name === 'exit') {
        return { type: 'exit', character, animation: read.animation }
      }
      return read.position === null && read.depth === null ? null : { type: 'move', character, position: read.position, depth: read.depth, animation: read.animation }
    }
    case 'wait': {
      if (argumentText === '') {
        return { type: 'wait', seconds: DEFAULT_WAIT_SECONDS }
      }
      const seconds = Number(argumentText)
      return Number.isFinite(seconds) && seconds >= 0 ? { type: 'wait', seconds } : null
    }
    default:
      return argumentText === '' ? null : { type: 'expression', character: directive.name, expression: argumentText }
  }
}

/**
 * The number of leading words naming the character entering: a known character's name, else the
 * first word, since the words after it may be an expression. None when the first word is a keyword.
 */
function leadingCharacterWordCount(words: readonly string[], vocabulary: StageVocabulary): number {
  const knownNames = new Set(vocabulary.characterNames.map(normalizeName))
  for (let wordCount = words.length; wordCount > 1; wordCount--) {
    if (knownNames.has(normalizeName(words.slice(0, wordCount).join(' ')))) {
      return wordCount
    }
  }
  const firstWord = words[0]
  return firstWord === undefined || classifyWord(firstWord, vocabulary).type !== 'other' ? 0 : 1
}

/** For `exit` and `move`, which take no expression: the name is every word before the first keyword. */
function wordsBeforeFirstKeyword(words: readonly string[], vocabulary: StageVocabulary): number {
  const firstKeywordIndex = words.findIndex(word => classifyWord(word, vocabulary).type !== 'other')
  return firstKeywordIndex === -1 ? words.length : firstKeywordIndex
}

/**
 * Keywords a misspelled directive may have been meant as. Those under four letters (`bg`, `if`,
 * `end`, `set`) are too close to ordinary names (`Seth`) to be suggested.
 */
const SUGGESTED_KEYWORDS = [...STAGE_KEYWORDS, ...CONTROL_DIRECTIVE_NAMES]
  .filter(keyword => keyword.length >= 4 && !keyword.includes(' '))

/**
 * The keyword a directive name is probably a misspelling of, or null. Short keywords accept one
 * mistake and longer ones two, so that real names (`Muse`, `Wade`) are not taken for typos.
 */
export function closestStageKeyword(name: string): string | null {
  const normalizedName = name.toLowerCase()
  if (STAGE_KEYWORDS.includes(normalizedName) || CONTROL_DIRECTIVE_NAMES.has(normalizedName)) {
    return null
  }
  let closestKeyword: string | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const keyword of SUGGESTED_KEYWORDS) {
    const distance = editDistance(normalizedName, keyword)
    const tolerance = keyword.length >= 5 ? 2 : 1
    if (distance <= tolerance && distance < closestDistance) {
      closestKeyword = keyword
      closestDistance = distance
    }
  }
  return closestKeyword
}

/**
 * The fewest insertions, deletions, substitutions and swaps of two neighbouring letters turning
 * one text into the other (optimal string alignment): `lopp` is one mistake away from `loop`.
 */
function editDistance(first: string, second: string): number {
  const distances: number[][] = [Array.from({ length: second.length + 1 }, (_, index) => index)]
  const distanceAt = (firstIndex: number, secondIndex: number) => distances[firstIndex]?.[secondIndex] ?? 0

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    const row = [firstIndex]
    distances.push(row)
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1
      let distance = Math.min(
        distanceAt(firstIndex - 1, secondIndex) + 1,
        distanceAt(firstIndex, secondIndex - 1) + 1,
        distanceAt(firstIndex - 1, secondIndex - 1) + substitutionCost,
      )
      const isSwap = firstIndex > 1 && secondIndex > 1
        && first[firstIndex - 1] === second[secondIndex - 2] && first[firstIndex - 2] === second[secondIndex - 1]
      if (isSwap) {
        distance = Math.min(distance, distanceAt(firstIndex - 2, secondIndex - 2) + 1)
      }
      row.push(distance)
    }
  }
  return distanceAt(first.length, second.length)
}
