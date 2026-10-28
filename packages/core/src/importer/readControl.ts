import type { Condition, Directive } from './importTypes'

/** Directives that shape the story rather than the stage. They must be alone on their line. */
export const CONTROL_DIRECTIVE_NAMES: ReadonlySet<string> = new Set([
  'decision',
  'decision multi',
  'counter',
  'add',
  'ask',
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
])

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

/** A whole number as written in a tag: `3`, `-1`, `+2`. */
export function readAmount(text: string): number | null {
  const amount = /^[+-]?\d{1,15}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN
  return Number.isSafeInteger(amount) ? amount : null
}

/** `Trust = 2` → name and initial value; `Trust` alone starts at 0. Null without a name, or with a value that is no whole number. */
export function readCounterDeclaration(text: string): { name: string; initial: number } | null {
  if (!text.includes('=')) {
    return text.trim() === '' ? null : { name: text.trim(), initial: 0 }
  }
  const assignment = readAssignment(text)
  const initial = assignment === null ? null : readAmount(assignment.value)
  return assignment === null || initial === null ? null : { name: assignment.name, initial }
}

/** `Trust 2`, `Trust -1` → name and amount; `Trust` alone adds 1. Null without a name. */
export function readAddition(text: string): { name: string; amount: number } | null {
  const withAmount = /^(.*\S)\s+([+-]?\d+)$/.exec(text.trim())
  const amount = withAmount === null ? 1 : readAmount(withAmount[2]!)
  const name = withAmount === null ? text.trim() : withAmount[1]!
  return name === '' || amount === null ? null : { name, amount }
}

/** `Answer 10s` → the decision and the time to pick, in milliseconds; the decision alone when no time ends the text. */
export function readChoiceHeading(text: string): { decision: string; timeLimitMs: number | null } {
  const timed = /^(.*\S)\s+(\d+(?:\.\d+)?)\s*s$/i.exec(text.trim())
  const seconds = timed === null ? 0 : Number(timed[2])
  return timed === null || seconds <= 0 || seconds > 600 ? { decision: text.trim(), timeLimitMs: null } : { decision: timed[1]!, timeLimitMs: Math.round(seconds * 1000) }
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
  const counter = /^(.+?)\s*(<=|>=|<|>)\s*([+-]?\d+)$/.exec(text.trim())
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
