import { writtenAmount } from './counterNumbers'
import type { MeasureText } from '../pagination/wrapLines'
import { normalizeName } from '../importer/storyNodes'
import type { ProjectDocument, StoredPage } from './storyFormat'

/** Names given by players are cut to this many characters, so that pages written with them still fit. */
export const MAXIMUM_ASKED_NAME_LENGTH = 12

/** A counter is measured as this many digits, a sign included: far beyond what stories count. */
const COUNTER_WIDTH = '-0000000'

/**
 * `{Hour}` in a text: where a value the story keeps goes, a name the player gave, a counter or a
 * decision; `{{` writes a brace itself.
 */
const PLACEHOLDER = /\{\{|\{([^{}\n]+)\}/gu

/** Where each `{…}` of a text starts and ends, `{{` left out: a page never breaks inside one. */
export function placeholderSpans(text: string): { start: number; end: number }[] {
  return [...text.matchAll(PLACEHOLDER)].flatMap(match => match[1] === undefined ? [] : [{ start: match.index, end: match.index + match[0].length }])
}

/** A name as `[ask: …]` takes it: a single word, so that `{Name}` reads at once. */
export function isAskableName(name: string): boolean {
  return /^[\p{L}\p{N}_-]+$/u.test(name)
}

/** The names a text shows with `{…}`, spaces around them left out; `{{` names nothing. */
export function placeholdersIn(text: string): string[] {
  return placeholdersAsWritten(text).map(name => name.trim())
}

/** What each `{…}` of a text holds, spaces included. */
export function placeholdersAsWritten(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].flatMap(match => match[1] === undefined ? [] : [match[1]])
}

/** The texts each value may show, by name normalised: pages are cut for the widest of them. */
export type PossibleValues = ReadonlyMap<string, readonly string[]>

/** What each value of the project may show: a counter's numbers, a decision's values, a name given. */
export function possibleValues(project: ProjectDocument): Map<string, string[]> {
  const possible = new Map<string, string[]>()
  for (const counter of project.counters) {
    possible.set(normalizeName(counter.name), counterTexts(writtenAmount(counter.initial, counter), counter.decimals ?? 0))
  }
  for (const decision of project.decisions) {
    const names = decision.values.map(value => value.name)
    possible.set(normalizeName(decision.name), decision.multiple ? [names.join(', ')] : names)
  }
  for (const asked of project.askedNames) {
    possible.set(normalizeName(asked.name), [WIDEST_NAME])
  }
  return possible
}

/**
 * What a counter may show: its first number, or one far beyond what stories count, a sign included;
 * with decimals, written as languages write them, a thousands separator in.
 */
export function counterTexts(initial: string, decimals = 0): string[] {
  return [decimals === 0 ? COUNTER_WIDTH : `-0,000,000.${'0'.repeat(decimals)}`, initial]
}

/** Adds what a value may also show to `possible`, keeping what it had. */
export function addPossibleValue(possible: Map<string, string[]>, name: string, text: string) {
  const key = normalizeName(name)
  possible.set(key, [...possible.get(key) ?? [], text])
}

const WIDEST_NAME = 'M'.repeat(MAXIMUM_ASKED_NAME_LENGTH)

/**
 * Measures a text as if each `{…}` showed the widest it may, measured: the widest name a player may
 * give, a counter's longest number, a decision's widest value. A value nothing says anything of is
 * taken as wide as a name. Pages cut so always fit.
 */
export function measuringValues(measureText: MeasureText, possible: PossibleValues = new Map()): MeasureText {
  const widest = new Map([...possible].map(([name, texts]) => [name, texts.reduce((wider, candidate) => measureText(candidate) > measureText(wider) ? candidate : wider, '')]))
  return text => measureText(text.includes('{')
    ? text.replace(PLACEHOLDER, (placeholder, name: string | undefined) => name === undefined ? '{' : widest.get(normalizeName(name)) ?? WIDEST_NAME)
    : text)
}

/** What a player typed, as the story keeps it: trimmed, cut to the longest name allowed. */
export function givenName(typed: string): string {
  return [...typed.trim().replace(/\s+/g, ' ')].slice(0, MAXIMUM_ASKED_NAME_LENGTH).join('')
}

/** What `{name}` shows, or undefined for a name the story does not know, which is left as written. */
export type ValueOf = (name: string) => string | undefined

/** The text with each `{…}` the story knows replaced by its value, and `{{` by a brace. */
export function withValues(text: string, valueOf: ValueOf): string {
  return text.includes('{') ? text.replace(PLACEHOLDER, (placeholder, name: string | undefined) => name === undefined ? '{' : valueOf(name.trim()) ?? placeholder) : text
}

/** The page as shown: its values in place, its styles and inline commands moved with the text. */
export function pageWithValues(page: StoredPage, valueOf: ValueOf): StoredPage {
  if (!page.text.includes('{')) {
    return page
  }
  // Each replaced placeholder shifts what follows it by the difference in length.
  const shifts: { from: number; to: number; delta: number }[] = []
  let delta = 0
  const text = page.text.replace(PLACEHOLDER, (placeholder, name: string | undefined, offset: number) => {
    const shown = name === undefined ? '{' : valueOf(name.trim()) ?? placeholder
    delta += shown.length - placeholder.length
    shifts.push({ from: offset, to: offset + placeholder.length, delta })
    return shown
  })
  if (shifts.length === 0) {
    return page
  }
  const moved = (offset: number) => {
    let shift = 0
    for (const placeholder of shifts) {
      if (offset >= placeholder.to) {
        shift = placeholder.delta
      } else if (offset > placeholder.from) {
        // Inside a placeholder: at the end of the value shown.
        return placeholder.to + placeholder.delta
      }
    }
    return offset + shift
  }
  return {
    ...page,
    text,
    inlineCommands: page.inlineCommands.map(command => ({ ...command, offset: moved(command.offset) })),
    ...(page.styles === undefined ? {} : { styles: page.styles.map(span => ({ ...span, start: moved(span.start), end: moved(span.end) })) }),
  }
}
