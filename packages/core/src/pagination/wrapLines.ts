import { placeholderSpans } from '../format/textValues'
import { textOfRange, wholeTextRange, type TextRange } from './textRange'

/** Width of a text as displayed, in the same unit as the line width (pixels in the player). */
export type MeasureText = (text: string) => number

/** French typography puts a space before these marks; the line must not break on that space. */
const SPACED_PUNCTUATION_START = /^[!?:;»]/

/** Languages written without spaces between words: their lines also break between the words the browser finds. */
const WITHOUT_SPACES = new Set(['ja', 'zh', 'th', 'lo', 'km', 'my'])

/** In those languages, marks that never start a line, and marks that never end one. */
const NEVER_STARTS_A_LINE = /[、。，．・：；？！ー…‥」』）〕］｝〉》】〙〗’”%）!),.:;?\]}]/
const NEVER_ENDS_A_LINE = /[「『（〔［｛〈《【〘〖‘“(\[{]/

const wordSegmenters = new Map<string, Intl.Segmenter>()
function wordSegmenterFor(locale: string): Intl.Segmenter {
  let segmenter = wordSegmenters.get(locale)
  if (segmenter === undefined) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
    wordSegmenters.set(locale, segmenter)
  }
  return segmenter
}

/** Whether a language is written without spaces between words: its lines also break between them. */
export function isWrittenWithoutSpaces(locale: string): boolean {
  return WITHOUT_SPACES.has(locale.split('-')[0]!.toLowerCase())
}

/**
 * Splits a range into the smallest pieces a line may break between: words, kept together with
 * French spaced punctuation (`bonjour !`, `« Non`) and with the rest of a `{…}` value they are in.
 * In a language written without spaces, words as the browser finds them, closing marks kept with
 * the word before them and opening ones with the word after. Each piece keeps its trailing spaces,
 * so the pieces cover the whole range.
 */
export function chunkRanges(text: string, range: TextRange, locale = 'en'): TextRange[] {
  const chunks: TextRange[] = []
  let chunkStart = range.start
  const values = text.includes('{') ? placeholderSpans(text) : []
  const isInsideValue = (index: number) => values.some(value => index > value.start && index < value.end)
  const wordStarts = isWrittenWithoutSpaces(locale)
    ? new Set([...wordSegmenterFor(locale).segment(textOfRange(text, range))].map(segment => range.start + segment.index))
    : null

  for (let index = range.start + 1; index < range.end; index++) {
    const startsNewWord = text[index - 1] === ' ' && text[index] !== ' '
    const startsWordWithoutSpace = wordStarts !== null && wordStarts.has(index) && text[index] !== ' ' && text[index - 1] !== ' '
      && !NEVER_STARTS_A_LINE.test(text[index]!) && !NEVER_ENDS_A_LINE.test(text[index - 1]!)
    if ((startsNewWord || startsWordWithoutSpace) && !isInsideValue(index) && isBreakAllowedBefore(text, chunkStart, index)) {
      chunks.push({ start: chunkStart, end: index })
      chunkStart = index
    }
  }
  chunks.push({ start: chunkStart, end: range.end })

  return chunks
}

function isBreakAllowedBefore(text: string, chunkStart: number, index: number): boolean {
  const followingText = text.slice(index, index + 1)
  const precedingChunk = text.slice(chunkStart, index).trimEnd()

  return !SPACED_PUNCTUATION_START.test(followingText) && !precedingChunk.endsWith('«')
}

/**
 * Lays a text out the way the textbox will: each line takes as many words as fit in `lineWidth`,
 * measured as written between them, a space where the text has one and none where it has none.
 */
export function wrapLines(text: string, lineWidth: number, measureText: MeasureText, locale = 'en'): string[] {
  const chunks = chunkRanges(text, wholeTextRange(text), locale)
  const lines: string[] = []
  let lineStart: number | null = null
  let lineEnd = 0
  for (const chunk of chunks) {
    if (textOfRange(text, chunk).trim() === '') {
      continue
    }
    if (lineStart === null) {
      lineStart = chunk.start
    } else if (measureText(text.slice(lineStart, chunk.end).trim()) > lineWidth) {
      lines.push(text.slice(lineStart, lineEnd).trim())
      lineStart = chunk.start
    }
    lineEnd = chunk.end
  }
  if (lineStart !== null) {
    lines.push(text.slice(lineStart, lineEnd).trim())
  }

  return lines
}
