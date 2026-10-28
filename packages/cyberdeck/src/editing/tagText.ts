import {
  ANIMATIONS_BY_DIRECTIVE,
  CONTROL_DIRECTIVE_NAMES,
  importText,
  STAGE_KEYWORDS,
  type ChapterDocument,
  type PageLayout,
  type ProjectDocument,
} from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'
import { problemMessage } from '../importing/problemMessages'
import { tagTextMessages, type TagTextMessages } from '../i18n/tagTextMessages'

/**
 * The text of a page as the editor shows it: plain text where tags (`[enter: Marie]`) are drawn as
 * chips. The text stays the source: these functions find the tags in it, judge them, and suggest
 * what to type in them.
 */

/** A tag, brackets included: `end` is the index after `]`. */
export interface TagRange {
  start: number
  end: number
  content: string
}

export type TagKind = 'stage' | 'character' | 'control' | 'pause'

/** The names a project gives, to suggest them in tags. */
export interface TagVocabulary {
  characters: { name: string; expressions: string[] }[]
  backgrounds: string[]
  music: string[]
  sounds: string[]
  illustrations: string[]
  videos: string[]
  positions: string[]
  decisions: { name: string; values: string[] }[]
  counters: string[]
  endings: string[]
  /** Names of the scenes, for `[play: …]`. */
  scenes: string[]
  /** Names of the declared styles, for `[style: …]`. */
  styles: string[]
  memories: string[]
}

export interface Completion {
  /** The text from `from` to the caret is replaced by the item chosen. */
  from: number
  /** `insert` ends with `]` when the item completes the tag. */
  items: { label: string; insert: string; detail: string }[]
}

const TAG_PATTERN = /\[([^[\]\n]*)\]/g
const MAXIMUM_ITEMS = 8
/** Stage directives about a character, drawn as character tags. */
const CHARACTER_DIRECTIVES = new Set(['enter', 'exit', 'move'])

/** Directives that take nothing after them: they close at once. */
const BARE_DIRECTIVES = new Set(['else', 'end', 'loop', 'break', 'clear'])

export function vocabularyOf(project: ProjectDocument, scenes: readonly ChapterDocument[]): TagVocabulary {
  return {
    characters: project.characters.map(character => ({ name: character.name, expressions: character.expressions.map(expression => expression.name) })),
    backgrounds: project.backgrounds.map(background => background.name),
    music: project.music.map(track => track.name),
    sounds: project.sounds.map(sound => sound.name),
    illustrations: project.illustrations.map(illustration => illustration.name),
    videos: project.videos.map(video => video.name),
    positions: project.positions.map(position => position.name),
    decisions: project.decisions.map(decision => ({ name: decision.name, values: decision.values.map(value => value.name) })),
    counters: project.counters.map(counter => counter.name),
    endings: project.endings.map(ending => ending.name),
    memories: project.memories.map(memory => memory.name),
    scenes: scenes.map(scene => scene.title ?? ''),
    styles: project.styles.map(style => style.name),
  }
}

export function tagsIn(text: string): TagRange[] {
  return [...text.matchAll(TAG_PATTERN)].map(match => ({ start: match.index, end: match.index + match[0].length, content: match[1] ?? '' }))
}

/** The tag just before the caret, which Backspace removes whole. */
export function tagEndingAt(text: string, position: number): TagRange | null {
  return tagsIn(text).find(tag => tag.end === position) ?? null
}

/** The tag just after the caret, which Delete removes whole. */
export function tagStartingAt(text: string, position: number): TagRange | null {
  return tagsIn(text).find(tag => tag.start === position) ?? null
}

export function tagKind(content: string): TagKind {
  const name = directiveName(content)
  if (CONTROL_DIRECTIVE_NAMES.has(name)) {
    return 'control'
  }
  if (name === 'wait') {
    return 'pause'
  }
  return STAGE_KEYWORDS.includes(name) && !CHARACTER_DIRECTIVES.has(name) ? 'stage' : 'character'
}

/**
 * What the import would say about the tag alone, worded for the writer; null when it reads well.
 * Control tags are judged with their lines around them, in the list of problems.
 */
export function tagProblem(content: string, vocabulary: TagVocabulary, layout: PageLayout, locale: Locale = 'en'): string | null {
  if (tagKind(content) === 'control') {
    return null
  }
  // A style marker needs words after it, as in the text it belongs to.
  const isStyleMarker = directiveName(content) === 'style' && !content.includes('=')
  const result = importText(isStyleMarker ? `[${content}]…` : `[${content}]`, {
    layout,
    locale: 'en',
    knownCharacterNames: vocabulary.characters.map(character => character.name),
    knownPositionNames: vocabulary.positions,
  })
  const problem = result.problems[0]
  return problem === undefined ? null : problemMessage(problem, locale)
}

/** Suggestions for what is being typed inside an open tag, the caret being at `caret`, described in `locale`. */
export function completionAt(text: string, caret: number, vocabulary: TagVocabulary, locale: Locale = 'en'): Completion | null {
  const messages = tagTextMessages[locale]
  const details = messages.details
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  const open = text.lastIndexOf('[', caret - 1)
  if (open < lineStart || text.slice(open, caret).includes(']')) {
    return null
  }
  const inside = text.slice(open + 1, caret)
  const colon = inside.indexOf(':')

  if (colon === -1) {
    const query = inside.trimStart()
    const from = caret - query.length
    const directives = [
      ...Object.entries(messages.stageDirectives).map(([name, detail]) => ({ label: name, insert: `${name}: `, detail })),
      ...Object.entries(messages.controlDirectives).map(([name, detail]) => ({ label: name, insert: BARE_DIRECTIVES.has(name) ? `${name}]` : `${name}: `, detail })),
      ...vocabulary.characters.map(character => ({ label: character.name, insert: `${character.name}: `, detail: details.characterExpression })),
    ]
    return completion(from, directives.filter(item => startsWith(item.label, query)))
  }

  const name = inside.slice(0, colon).trim().toLowerCase()
  const argumentText = inside.slice(colon + 1)
  const wholeArgument = argumentText.trimStart()
  const wholeFrom = caret - wholeArgument.length
  const lastWord = /\S*$/.exec(argumentText)?.[0] ?? ''
  const wordFrom = caret - lastWord.length
  const previousWords = argumentText.slice(0, argumentText.length - lastWord.length).trim().split(/\s+/).filter(word => word !== '')
  const words = (candidates: readonly string[], detail: string) => candidates.map(candidate => ({ label: candidate, insert: candidate, detail }))
  /** Names that are all the directive takes: choosing one closes the tag. */
  const closing = (candidates: readonly string[], detail: string) => candidates.map(candidate => ({ label: candidate, insert: `${candidate}]`, detail }))
  const characterNames = vocabulary.characters.map(character => character.name)

  switch (name) {
    case 'bg':
    case 'background':
      return completion(wholeFrom, closing(vocabulary.backgrounds, details.background).filter(item => startsWith(item.label, wholeArgument)))
    case 'music':
      return completion(wholeFrom, closing([...vocabulary.music, 'stop'], details.music).filter(item => startsWith(item.label, wholeArgument)))
    case 'video':
      return completion(wholeFrom, closing(vocabulary.videos, details.video).filter(item => startsWith(item.label, wholeArgument)))
    case 'sound':
    case 'voice':
      return completion(wholeFrom, closing(vocabulary.sounds, details.sound).filter(item => startsWith(item.label, wholeArgument)))
    case 'transition':
      return completion(wordFrom, words(['fade', 'black', 'white'], details.transition).filter(item => startsWith(item.label, lastWord)))
    case 'shake':
      return completion(wordFrom, words(['strong'], details.shake).filter(item => startsWith(item.label, lastWord)))
    case 'flash':
      return completion(wordFrom, words(['white', 'red', 'black'], details.colour).filter(item => startsWith(item.label, lastWord)))
    case 'fade out':
      return completion(wordFrom, words(['black', 'white'], details.colour).filter(item => startsWith(item.label, lastWord)))
    case 'illustration':
    case 'cg':
      return completion(wholeFrom, closing([...vocabulary.illustrations, 'none'], details.illustration).filter(item => startsWith(item.label, wholeArgument)))
    case 'text':
      return completion(wholeFrom, closing(['full', 'box'], details.text).filter(item => startsWith(item.label, wholeArgument)))
    case 'style':
      return completion(wholeFrom, closing([...vocabulary.styles, 'none', 'italic', 'bold'], details.style).filter(item => startsWith(item.label, wholeArgument)))
    case 'tint':
      return completion(wholeFrom, closing(['sepia', 'night', 'grey', 'none'], details.tint).filter(item => startsWith(item.label, wholeArgument)))
    case 'ending':
      return completion(wholeFrom, closing(vocabulary.endings, details.ending).filter(item => startsWith(item.label, wholeArgument)))
    case 'play':
      return completion(wholeFrom, closing(vocabulary.scenes, details.scene).filter(item => startsWith(item.label, wholeArgument)))
    case 'remember':
      return completion(wholeFrom, closing(vocabulary.memories, details.memory).filter(item => startsWith(item.label, wholeArgument)))
    case 'choice':
      return completion(wholeFrom, closing(vocabulary.decisions.map(decision => decision.name), details.decision).filter(item => startsWith(item.label, wholeArgument)))
    case 'add':
      return completion(wholeFrom, words(vocabulary.counters, details.counter).filter(item => startsWith(item.label, wholeArgument)))
    case 'set':
    case 'unset': {
      const equals = argumentText.indexOf('=')
      if (equals === -1) {
        const counters = name === 'set' ? words(vocabulary.counters, details.counter) : []
        return completion(wholeFrom, [...words(vocabulary.decisions.map(decision => decision.name), details.decision), ...counters].filter(item => startsWith(item.label, wholeArgument)))
      }
      const decision = vocabulary.decisions.find(candidate => sameName(candidate.name, argumentText.slice(0, equals).trim()))
      return completion(wordFrom, closing(decision?.values ?? [], details.value).filter(item => startsWith(item.label, lastWord)))
    }
    case 'if':
    case 'else if':
    case 'only if':
      return completion(wordFrom, conditionWords(previousWords, vocabulary, details).filter(item => startsWith(item.label, lastWord)))
    case 'enter':
    case 'exit':
    case 'move': {
      if (previousWords.length === 0) {
        return completion(wordFrom, words(characterNames, details.character).filter(item => startsWith(item.label, lastWord)))
      }
      const character = vocabulary.characters.find(candidate => sameName(candidate.name, previousWords.join(' ')) || sameName(candidate.name, previousWords[0] ?? ''))
      const candidates = [
        ...(name === 'exit' ? [] : words(vocabulary.positions, details.position)),
        ...(name === 'enter' ? words(['facing-left', 'facing-right'], details.facing) : []),
        ...(name === 'exit' ? [] : words(['near', 'far'], details.depth)),
        ...(name === 'enter' ? words(character?.expressions ?? [], details.expression) : []),
        ...words(ANIMATIONS_BY_DIRECTIVE[name], details.animation),
        ...words(['wait'], details.textWaits),
      ]
      return completion(wordFrom, candidates.filter(item => startsWith(item.label, lastWord)))
    }
    default: {
      const character = vocabulary.characters.find(candidate => sameName(candidate.name, name))
      return completion(wholeFrom, closing(character?.expressions ?? [], details.expression).filter(item => startsWith(item.label, wholeArgument)))
    }
  }
}

/** What may follow in a condition: a decision, then `is`, then one of its values; a counter, then a comparison; or a memory or ending. */
function conditionWords(previousWords: readonly string[], vocabulary: TagVocabulary, details: TagTextMessages['details']): Completion['items'] {
  const words = (candidates: readonly string[], detail: string) => candidates.map(candidate => ({ label: candidate, insert: candidate, detail }))
  const last = previousWords.at(-1)?.toLowerCase()
  if (last === 'is' || (last === 'not' && previousWords.at(-2)?.toLowerCase() === 'is')) {
    const isIndex = previousWords.map(word => word.toLowerCase()).lastIndexOf('is')
    const connective = Math.max(previousWords.map(word => word.toLowerCase()).lastIndexOf('and', isIndex), previousWords.map(word => word.toLowerCase()).lastIndexOf('or', isIndex))
    const decisionName = previousWords.slice(connective + 1, isIndex).join(' ')
    const decision = vocabulary.decisions.find(candidate => sameName(candidate.name, decisionName))
    return [...(last === 'is' ? words(['not'], details.negation) : []), ...words(decision?.values ?? [], details.value)]
  }
  if (last === 'remembered') {
    return words(vocabulary.memories, details.memory)
  }
  if (last === 'ending') {
    return words(vocabulary.endings, details.ending)
  }
  if (last === 'seen') {
    return words(['ending'], '')
  }
  if (last === undefined || last === 'and' || last === 'or' || last === 'not') {
    return [
      ...words(vocabulary.decisions.map(decision => decision.name), details.decision),
      ...(last === 'not' ? [] : words(vocabulary.counters, details.counter)),
      ...words(['remembered', 'seen ending'], details.memoryOrEnding),
      ...(last === 'not' ? [] : words(['not'], details.negation)),
    ]
  }
  const connective = Math.max(previousWords.map(word => word.toLowerCase()).lastIndexOf('and'), previousWords.map(word => word.toLowerCase()).lastIndexOf('or'))
  if (vocabulary.counters.some(counter => sameName(counter, previousWords.slice(connective + 1).join(' ')))) {
    return words(['>=', '<=', '>', '<', 'is'], details.comparison)
  }
  return words(['is', 'and', 'or'], '')
}

function completion(from: number, items: Completion['items']): Completion | null {
  return items.length === 0 ? null : { from, items: items.slice(0, MAXIMUM_ITEMS) }
}

function directiveName(content: string): string {
  const colon = content.indexOf(':')
  return (colon === -1 ? content : content.slice(0, colon)).trim().replace(/\s+/g, ' ').toLowerCase()
}

function startsWith(candidate: string, query: string): boolean {
  return candidate.toLowerCase().startsWith(query.toLowerCase())
}

function sameName(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase()
}

