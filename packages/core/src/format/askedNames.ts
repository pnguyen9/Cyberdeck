import type { MeasureText } from '../pagination/wrapLines'
import type { AskedName, StoredPage } from './storyFormat'

/** Names given by players are cut to this many characters, so that pages written with them still fit. */
export const MAXIMUM_ASKED_NAME_LENGTH = 12

/** `{Hero}` in a text: where the name the player gave goes. */
const PLACEHOLDER = /\{([\p{L}\p{N}_-]+)\}/gu

/** A name as `[ask: …]` takes it: a single word, so that `{Name}` reads at once. */
export function isAskableName(name: string): boolean {
  return /^[\p{L}\p{N}_-]+$/u.test(name)
}

/** The names a text shows with `{…}`, as written. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map(match => match[1]!)
}

/** Measures a text as if each `{Name}` were the widest name a player may give: pages cut so always fit. */
export function measuringAskedNames(measureText: MeasureText): MeasureText {
  const widest = 'M'.repeat(MAXIMUM_ASKED_NAME_LENGTH)
  return text => measureText(text.includes('{') ? text.replace(PLACEHOLDER, widest) : text)
}

/** What a player typed, as the story keeps it: trimmed, cut to the longest name allowed. */
export function givenName(typed: string): string {
  return [...typed.trim().replace(/\s+/g, ' ')].slice(0, MAXIMUM_ASKED_NAME_LENGTH).join('')
}

/** The name shown for each asked name: the one given, its default, or its own name when it has neither. */
export type NameOf = (name: string) => string | undefined

export function nameLookup(askedNames: readonly AskedName[], given: Readonly<Record<string, string>>): NameOf {
  const byName = new Map(askedNames.map(asked => [asked.name.toLowerCase(), asked]))
  return name => {
    const asked = byName.get(name.toLowerCase())
    if (asked === undefined) {
      return undefined
    }
    const value = Object.hasOwn(given, asked.id) ? given[asked.id] : undefined
    return value || asked.defaultName || asked.name
  }
}

/** The text with each `{Name}` the story knows replaced; others are left as written. */
export function withNames(text: string, nameOf: NameOf): string {
  return text.includes('{') ? text.replace(PLACEHOLDER, (placeholder, name: string) => nameOf(name) ?? placeholder) : text
}

/** The page as shown: its names in place, its styles and inline commands moved with the text. */
export function pageWithNames(page: StoredPage, nameOf: NameOf): StoredPage {
  if (!page.text.includes('{')) {
    return page
  }
  // Each replaced placeholder shifts what follows it by the difference in length.
  const shifts: { from: number; to: number; delta: number }[] = []
  let delta = 0
  const text = page.text.replace(PLACEHOLDER, (placeholder, name: string, offset: number) => {
    const shown = nameOf(name) ?? placeholder
    shifts.push({ from: offset, to: offset + placeholder.length, delta })
    delta += shown.length - placeholder.length
    shifts[shifts.length - 1]!.delta = delta
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
        // Inside a placeholder: at the end of the name shown.
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
