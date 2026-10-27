import type { Directive, ImportProblem, InlineDirective } from './importTypes'

/** A problem found on a line, before the importer adds the line number. */
export type LineProblem = Omit<ImportProblem, 'line'>

export interface ParsedLine {
  kind: 'narration' | 'dialogue'
  speaker: string | null
  /** Displayed text: directives removed, spaces collapsed. Empty for a line made of directives only. */
  text: string
  directivesBefore: Directive[]
  inlineDirectives: InlineDirective[]
  problems: LineProblem[]
}

const DIRECTIVE_PATTERN = /\[([^[\]]*)\]/g

/**
 * A dash or a bullet followed by a space opens dialogue, with the speaker's name: `— Marie: …`.
 * Word turns a typed `- ` into `•` and a tab.
 */
const DIALOGUE_DASH = /^[-‐‑‒–—―•]\s+/u

/**
 * One to three words each starting with a capital, then a colon: `Marie:`, `Old Marie:`,
 * `MARIE :` (French spacing); or question marks, the name of a voice nobody knows yet: `???:`.
 * Lower-case words (`Note to self:`, `Il dit :`) are never a name.
 */
const SPEAKER_PREFIX = /^(\p{Lu}[\p{L}\p{M}'’.-]*(?: \p{Lu}[\p{L}\p{M}'’.-]*){0,2}|\?{2,})[   ]?:(?:[   ]+|$)/u

type Token =
  | { type: 'text'; value: string }
  | { type: 'directive'; directive: Directive }

/**
 * Reads one paragraph: who speaks, what is displayed, and which directives apply before the page
 * appears (written before any text) or while its text is typed (written after some text).
 */
export function parseLine(line: string): ParsedLine {
  const problems: LineProblem[] = []
  const parsedLine: ParsedLine = {
    kind: 'narration',
    speaker: null,
    text: '',
    directivesBefore: [],
    inlineDirectives: [],
    problems,
  }

  let isSpeakerRead = false
  for (const token of tokenize(line, problems)) {
    if (token.type === 'directive') {
      if (parsedLine.text === '') {
        parsedLine.directivesBefore.push(token.directive)
      } else {
        parsedLine.inlineDirectives.push({ offset: parsedLine.text.length, ...token.directive })
      }
      continue
    }

    let value = token.value
    if (!isSpeakerRead && value.trim() !== '') {
      isSpeakerRead = true
      const opening = readOpening(value.trimStart())
      parsedLine.kind = opening.kind
      parsedLine.speaker = opening.speaker
      value = opening.remainder
      if (opening.problem !== null) {
        problems.push(opening.problem)
      }
    }
    parsedLine.text = appendCollapsingSpaces(parsedLine.text, value)
  }

  parsedLine.text = parsedLine.text.replace(/ +$/, '')
  for (const inlineDirective of parsedLine.inlineDirectives) {
    inlineDirective.offset = Math.min(inlineDirective.offset, parsedLine.text.length)
  }

  if (parsedLine.kind === 'dialogue' && parsedLine.text === '') {
    problems.push(parsedLine.speaker === null
      ? { severity: 'warning', code: 'emptyDialogue' }
      : { severity: 'warning', code: 'emptyDialogue', subject: parsedLine.speaker })
  }

  return parsedLine
}

function tokenize(line: string, problems: LineProblem[]): Token[] {
  const tokens: Token[] = []
  let textStart = 0

  for (const match of line.matchAll(DIRECTIVE_PATTERN)) {
    tokens.push({ type: 'text', value: line.slice(textStart, match.index) })
    textStart = match.index + match[0].length

    const directive = readDirective(match[1] ?? '')
    if (directive === null) {
      problems.push({ severity: 'warning', code: 'emptyDirective' })
    } else {
      tokens.push({ type: 'directive', directive })
    }
  }
  tokens.push({ type: 'text', value: line.slice(textStart) })

  if (tokens.some(token => token.type === 'text' && token.value.includes('['))) {
    problems.push({ severity: 'warning', code: 'unclosedBracket' })
  }

  return tokens
}

/** `enter: marie left smile` → name `enter`, arguments `marie`, `left`, `smile`. Null when the name is missing. */
function readDirective(content: string): Directive | null {
  const colonIndex = content.indexOf(':')
  const namePart = colonIndex === -1 ? content : content.slice(0, colonIndex)
  const argumentsPart = colonIndex === -1 ? '' : content.slice(colonIndex + 1)

  const name = namePart.trim().replace(/\s+/g, ' ').toLowerCase()
  if (name === '') {
    return null
  }

  return { name, arguments: argumentsPart.split(/[\s,]+/).filter(argument => argument !== '') }
}

/**
 * Dialogue is a dash and a name, nothing less, so that prose is never taken for it. Either alone
 * is narration, kept as written (a dash followed by one space whatever Word put there) and
 * reported: the writer may have meant dialogue.
 */
function readOpening(text: string): { kind: 'narration' | 'dialogue'; speaker: string | null; remainder: string; problem: LineProblem | null } {
  const dash = DIALOGUE_DASH.exec(text)
  const afterDash = dash === null ? text : text.slice(dash[0].length)
  const speakerPrefix = SPEAKER_PREFIX.exec(afterDash)

  if (dash !== null && speakerPrefix !== null) {
    return { kind: 'dialogue', speaker: speakerPrefix[1] ?? null, remainder: afterDash.slice(speakerPrefix[0].length), problem: null }
  }
  if (dash !== null) {
    return { kind: 'narration', speaker: null, remainder: `${dash[0].trim()} ${afterDash}`, problem: { severity: 'warning', code: 'dashWithoutSpeaker' } }
  }
  if (speakerPrefix !== null) {
    return { kind: 'narration', speaker: null, remainder: text, problem: { severity: 'warning', code: 'speakerWithoutDash', subject: speakerPrefix[1] ?? '' } }
  }
  return { kind: 'narration', speaker: null, remainder: text, problem: null }
}

/** Removing a directive leaves the spaces around it side by side: only one is kept. */
function appendCollapsingSpaces(text: string, addition: string): string {
  let result = text
  for (const character of addition) {
    if (character === ' ' && (result === '' || result.endsWith(' '))) {
      continue
    }
    result += character
  }
  return result
}
