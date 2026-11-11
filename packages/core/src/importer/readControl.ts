import type { AskBound, Condition, CounterValue, Directive, GaugeNode } from './importTypes'
import { DEFAULT_GAUGE_PLACE, GAUGE_COLORS, type GaugeColor, type GaugePlace } from '../format/storyFormat'

/** Directives that shape the story rather than the stage. They must be alone on their line. */
export const CONTROL_DIRECTIVE_NAMES: ReadonlySet<string> = new Set([
  'decision',
  'decision multi',
  'decision lasting',
  'decision multi lasting',
  'counter',
  'counter lasting',
  'add',
  'ask',
  'ask number',
  'gauge',
  'character',
  'list',
  'shuffle',
  'take',
  'timeout',
  'choice',
  'if',
  'else if',
  'else',
  'end',
  'end if',
  'loop',
  'break',
  'play',
  'only if',
  'set',
  'unset',
  'label',
  'jump',
  'ending',
  'remember',
  'forget',
  'shown',
  'shown after an ending',
])

/**
 * What a declaration's directive declares, and how: `decision multi lasting` a decision of several
 * values the profile keeps; null for a directive that declares no decision nor counter.
 */
export function declarationKind(directiveName: string): { kind: 'decision' | 'counter'; multiple: boolean; lasting: boolean } | null {
  const [kind, ...words] = directiveName.split(' ')
  const allowed = kind === 'decision' ? ['multi', 'lasting'] : kind === 'counter' ? ['lasting'] : null
  if (allowed === null || words.some((word, index) => !allowed.includes(word) || words.indexOf(word) !== index)) {
    return null
  }
  return { kind: kind as 'decision' | 'counter', multiple: words.includes('multi'), lasting: words.includes('lasting') }
}

export function isControlDirective(directive: Directive): boolean {
  return CONTROL_DIRECTIVE_NAMES.has(directive.name)
}

/** The text after the colon, as the writer typed it apart from spacing. */
export function argumentText(directive: Directive): string {
  return directive.arguments.join(' ')
}

/** `Confession = Accept | Refuse | Ignore` → name and values; null when either is missing. */
export function readDecisionDeclaration(text: string): { name: string; values: string[] } | null {
  const assignment = readAssignment(text)
  if (assignment === null) {
    return null
  }
  const values = assignment.value.split('|').map(value => value.trim()).filter(value => value !== '')
  return values.length === 0 ? null : { name: assignment.name, values }
}

/** The most decimals a counter may count with: hundredths of a cent would already be past what stories need. */
export const MAXIMUM_COUNTER_DECIMALS = 4

/** A number as written in a tag: `3`, `-1`, `+2`, and with a point for decimals, `0.50`. */
export function readAmount(text: string): number | null {
  const amount = new RegExp(`^[+-]?\\d{1,12}(?:\\.\\d{1,${MAXIMUM_COUNTER_DECIMALS}})?$`).test(text.trim()) ? Number(text.trim()) : Number.NaN
  return Number.isFinite(amount) ? amount : null
}

/** How many decimals a number is written with: `0.50` two, `3` none. */
export function decimalsWritten(text: string): number {
  return /\.(\d+)$/.exec(text.trim())?.[1]?.length ?? 0
}

/** How many decimals a number read from a tag holds, as the shortest writing of it shows them. */
export function decimalsOf(amount: number): number {
  return decimalsWritten(String(amount))
}

/**
 * `random`, `random not in Dealt` → a value of a decision drawn at random, leaving out those another
 * decision holds; null for anything else.
 */
export function readDraw(text: string): { notIn: string | null } | null {
  const draw = /^random(?:\s+not\s+in\s+(.+))?$/i.exec(text.trim())
  return draw === null ? null : { notIn: draw[1]?.trim() ?? null }
}

/** `random 1 6` → the lowest and highest numbers to draw from; null for anything else, or the highest below the lowest. */
export function readRandom(text: string): { minimum: number; maximum: number } | null {
  const random = /^random\s+(\S+)\s+(\S+)$/i.exec(text.trim())
  const minimum = random === null ? null : readAmount(random[1]!)
  const maximum = random === null ? null : readAmount(random[2]!)
  return minimum === null || maximum === null || maximum < minimum ? null : { minimum, maximum }
}

/**
 * `Trust = 2` → name and initial value; `Trust` alone starts at 0. `Money = 1000.00` counts in
 * hundredths: the decimals written with the first number are those the counter keeps. Null without
 * a name, or with a value that is no number.
 */
export function readCounterDeclaration(text: string): { name: string; initial: number; decimals: number } | null {
  if (!text.includes('=')) {
    return text.trim() === '' ? null : { name: text.trim(), initial: 0, decimals: 0 }
  }
  const assignment = readAssignment(text)
  const initial = assignment === null ? null : readAmount(assignment.value)
  return assignment === null || initial === null ? null : { name: assignment.name, initial, decimals: decimalsWritten(assignment.value) }
}

/** `{Bet}`, `-{Bet}`, `{Bet} * 1.5` → another counter's value times a factor; null for anything else. */
export function readCounterValue(text: string): CounterValue | null {
  const value = /^([+-])?\s*\{([^{}]+)\}\s*(?:\*\s*([+-]?\d+(?:\.\d+)?))?$/.exec(text.trim())
  if (value === null) {
    return null
  }
  const factor = (value[1] === '-' ? -1 : 1) * (value[3] === undefined ? 1 : Number(value[3]))
  return Number.isFinite(factor) ? { counter: value[2]!.trim(), factor } : null
}

/** `Trust 2`, `Trust -1` → name and amount; `Trust` alone adds 1; `Money -{Bet}` another counter's value. Null without a name. */
export function readAddition(text: string): { name: string; amount: number; from?: CounterValue } | null {
  const withValue = /^(.*\S)\s+([+-]?\s*\{[^{}]+\}(?:\s*\*\s*[+-]?\d+(?:\.\d+)?)?)$/.exec(text.trim())
  const from = withValue === null ? null : readCounterValue(withValue[2]!)
  if (withValue !== null && from !== null) {
    return { name: withValue[1]!.trim(), amount: 0, from }
  }
  const withAmount = /^(.*\S)\s+([+-]?\d+(?:\.\d+)?)$/.exec(text.trim())
  const amount = withAmount === null ? 1 : readAmount(withAmount[2]!)
  const name = withAmount === null ? text.trim() : withAmount[1]!
  return name === '' || amount === null ? null : { name, amount }
}

/**
 * `Bet = 10, from 1 to {Money}` → the counter, the number proposed with the decimals it is written with, and the bounds, each a number or
 * `{Counter}`; either bound may go, or both. Null for anything else.
 */
/** A number, or a counter in braces, `{Money}`: what an asked number or a gauge is bounded by. Null when it is neither. */
function boundWritten(written: string): AskBound | null {
  if (written.startsWith('{')) {
    return { type: 'counter', counter: written.slice(1, -1).trim() }
  }
  const amount = readAmount(written)
  return amount === null ? null : { type: 'amount', amount }
}

export function readAskNumber(text: string): { counter: string; defaultAmount: number; decimals: number; minimum: AskBound | null; maximum: AskBound | null } | null {
  const bound = String.raw`([+-]?\d+(?:\.\d+)?|\{[^{}]+\})`
  const parts = new RegExp(String.raw`^(.+?)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:,\s*(?:from\s+${bound})?\s*(?:to\s+${bound})?)?$`, 'i').exec(text.trim())
  if (parts === null || parts[1]!.trim() === '' || (text.includes(',') && parts[3] === undefined && parts[4] === undefined)) {
    return null
  }
  const readBound = (written: string | undefined): AskBound | null | undefined => written === undefined ? null : boundWritten(written) ?? undefined
  const defaultAmount = readAmount(parts[2]!)
  const minimum = readBound(parts[3])
  const maximum = readBound(parts[4])
  if (defaultAmount === null || minimum === undefined || maximum === undefined) {
    return null
  }
  return { counter: parts[1]!.trim(), defaultAmount, decimals: decimalsWritten(parts[2]!), minimum, maximum }
}

/** A gauge as written, or what is wrong with it: the maximum, a word not understood, or anything else. */
export type GaugeReading =
  | { gauge: Omit<GaugeNode, 'type' | 'sourceLine'> }
  | { problem: 'gaugeMaximum' | 'gaugeWord' | 'invalidGauge'; subject: string }

/**
 * `HP / {MaxHP} top right red numbers = {Name}`: a counter shown as a bar, out of a number or of what
 * another counter holds, in a corner of the stage (top left unless told), in a colour of its own or
 * in those of health, with its numbers or not, named by the label after `=` or by the counter's own
 * name. `HP none` takes the counter's bar away, `none` every bar.
 */
export function readGauge(text: string): GaugeReading {
  const trimmed = text.trim()
  if (/^none$/i.test(trimmed)) {
    return { gauge: { counter: null, shown: null } }
  }
  const hidden = trimmed.includes('=') || trimmed.includes('/') ? null : /^(.+?)\s+none$/i.exec(trimmed)
  if (hidden !== null) {
    return { gauge: { counter: hidden[1]!.trim(), shown: null } }
  }
  const equalsIndex = trimmed.indexOf('=')
  const label = equalsIndex === -1 ? null : trimmed.slice(equalsIndex + 1).trim()
  const written = equalsIndex === -1 ? trimmed : trimmed.slice(0, equalsIndex).trim()
  if (label === '' || written === '') {
    return { problem: 'invalidGauge', subject: text.trim() }
  }
  const slashIndex = written.indexOf('/')
  const counter = slashIndex === -1 ? written.split(/\s+/)[0]! : written.slice(0, slashIndex).trim()
  const parts = /^(\{[^{}]+\}|\d+(?:\.\d+)?)(?:\s+(.*))?$/.exec(slashIndex === -1 ? '' : written.slice(slashIndex + 1).trim())
  if (counter === '') {
    return { problem: 'invalidGauge', subject: text.trim() }
  }
  const maximum = parts === null ? null : boundWritten(parts[1]!)
  if (parts === null || maximum === null || (maximum.type === 'amount' && maximum.amount <= 0)) {
    return { problem: 'gaugeMaximum', subject: counter }
  }
  let vertical: 'top' | 'bottom' | null = null
  let horizontal: 'left' | 'right' | null = null
  let color: GaugeColor | null = null
  let numbers = false
  for (const word of (parts[2] ?? '').split(/\s+/).filter(candidate => candidate !== '')) {
    const lowerCaseWord = word.toLowerCase()
    if ((lowerCaseWord === 'top' || lowerCaseWord === 'bottom') && vertical === null) {
      vertical = lowerCaseWord
    } else if ((lowerCaseWord === 'left' || lowerCaseWord === 'right') && horizontal === null) {
      horizontal = lowerCaseWord
    } else if ((GAUGE_COLORS as readonly string[]).includes(lowerCaseWord) && color === null) {
      color = lowerCaseWord as GaugeColor
    } else if (lowerCaseWord === 'numbers' && !numbers) {
      numbers = true
    } else {
      return { problem: 'gaugeWord', subject: word }
    }
  }
  const [defaultVertical, defaultHorizontal] = DEFAULT_GAUGE_PLACE.split(' ')
  const place = `${vertical ?? defaultVertical} ${horizontal ?? defaultHorizontal}` as GaugePlace
  return { gauge: { counter, shown: { maximum, place, color, numbers, label } } }
}

/**
 * `Answer 10s below` → the decision, the time to pick, in milliseconds, and whether the options sit
 * side by side along the bottom of the stage rather than in a column over its middle; the time and
 * `below` may come in either order, and each may be left out. A decision whose own name ends in
 * `below`, as `isDecision` knows it, keeps it.
 */
export function readChoiceHeading(text: string, isDecision: (name: string) => boolean = () => false): { decision: string; timeLimitMs: number | null; below: boolean } {
  const withoutBelow = (written: string) => /^(.*\S)\s+below$/i.exec(written)?.[1] ?? null
  const withoutTime = (written: string) => {
    const timed = /^(.*\S)\s+(\d+(?:\.\d+)?)\s*s$/i.exec(written)
    const seconds = timed === null ? 0 : Number(timed[2])
    return timed === null || seconds <= 0 || seconds > 600 ? null : { rest: timed[1]!, timeLimitMs: Math.round(seconds * 1000) }
  }
  const trimmed = text.trim()
  const belowLast = withoutBelow(trimmed)
  const timed = withoutTime(belowLast ?? trimmed)
  const name = timed?.rest ?? belowLast ?? trimmed
  const belowFirst = belowLast === null && timed !== null ? withoutBelow(name) : null
  const decision = belowFirst ?? name
  const below = belowLast !== null || belowFirst !== null
  // `[choice: Look below]` for a decision named so: a `below` right after the name is the name's, not the layout's.
  const wholeName = timed === null ? trimmed : belowFirst !== null ? name : null
  if (below && wholeName !== null && isDecision(wholeName)) {
    return { decision: wholeName, timeLimitMs: timed?.timeLimitMs ?? null, below: false }
  }
  return { decision, timeLimitMs: timed?.timeLimitMs ?? null, below }
}

/** `Clues = Letter` → decision and value; null when either is missing. */
export function readAssignment(text: string): { name: string; value: string } | null {
  const equalsIndex = text.indexOf('=')
  if (equalsIndex === -1) {
    return null
  }
  const name = text.slice(0, equalsIndex).trim()
  const value = text.slice(equalsIndex + 1).trim()
  return name === '' || value === '' ? null : { name, value }
}

/**
 * `Answer is not B and Mood is Happy or Mood is Sad`: `and` binds tighter than `or`, as in
 * speech; there are no parentheses. Besides `X is Y`, a part may be `[not] remembered X`,
 * `[not] seen ending X`, or a counter compared with a number, `Trust >= 3`. Returns an invalid condition when a part is none of these.
 */
export function readCondition(text: string): Condition {
  const alternatives: Condition[] = []
  for (const alternativeText of text.split(/\s+or\s+/i)) {
    const requirements: Condition[] = []
    for (const requirementText of alternativeText.split(/\s+and\s+/i)) {
      const comparison = readComparison(requirementText)
      if (comparison === null) {
        return { type: 'invalid', text }
      }
      requirements.push(comparison)
    }
    alternatives.push(requirements.length === 1 ? requirements[0]! : { type: 'and', conditions: requirements })
  }
  return alternatives.length === 1 ? alternatives[0]! : { type: 'or', conditions: alternatives }
}

function readComparison(text: string): Condition | null {
  const flag = /^(not\s+)?(remembered|seen\s+ending)\s+(.+)$/i.exec(text.trim())
  if (flag !== null) {
    const name = (flag[3] ?? '').trim()
    const negated = flag[1] !== undefined
    return /^remembered$/i.test(flag[2] ?? '') ? { type: 'remembered', memory: name, negated } : { type: 'endingSeen', ending: name, negated }
  }
  const versus = /^(.+?)\s*(<=|>=|<|>)\s*\{([^{}]+)\}$/.exec(text.trim())
  if (versus !== null) {
    return { type: 'compare', counter: versus[1]!.trim(), operator: versus[2] as '<' | '<=' | '>' | '>=', amount: 0, other: versus[3]!.trim() }
  }
  const counter = /^(.+?)\s*(<=|>=|<|>)\s*([+-]?\d+(?:\.\d+)?)$/.exec(text.trim())
  if (counter !== null) {
    const amount = readAmount(counter[3]!)
    return amount === null ? null : { type: 'compare', counter: counter[1]!.trim(), operator: counter[2] as '<' | '<=' | '>' | '>=', amount }
  }
  const comparison = /^(.+?)\s+is\s+(not\s+)?(.+)$/i.exec(text.trim())
  if (comparison === null) {
    return null
  }
  return { type: 'is', decision: comparison[1] ?? '', value: (comparison[3] ?? '').trim(), negated: comparison[2] !== undefined }
}
