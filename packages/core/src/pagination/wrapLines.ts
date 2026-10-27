import { textOfRange, wholeTextRange, type TextRange } from './textRange'

/** Width of a text as displayed, in the same unit as the line width (pixels in the player). */
export type MeasureText = (text: string) => number

/** French typography puts a space before these marks; the line must not break on that space. */
const SPACED_PUNCTUATION_START = /^[!?:;»]/

/**
 * Splits a range into the smallest pieces a line may break between: words, kept together with
 * French spaced punctuation (`bonjour !`, `« Non`). Each piece keeps its trailing spaces, so the
 * pieces cover the whole range.
 */
export function chunkRanges(text: string, range: TextRange): TextRange[] {
  const chunks: TextRange[] = []
  let chunkStart = range.start

  for (let index = range.start + 1; index < range.end; index++) {
    const startsNewWord = text[index - 1] === ' ' && text[index] !== ' '
    if (startsNewWord && isBreakAllowedBefore(text, chunkStart, index)) {
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

/** Lays a text out the way the textbox will: each line takes as many words as fit in `lineWidth`. */
export function wrapLines(text: string, lineWidth: number, measureText: MeasureText): string[] {
  const words = chunkRanges(text, wholeTextRange(text))
    .map(chunk => textOfRange(text, chunk).trim())
    .filter(word => word !== '')

  const lines: string[] = []
  let currentLine = ''
  for (const word of words) {
    const extendedLine = currentLine === '' ? word : `${currentLine} ${word}`
    if (currentLine !== '' && measureText(extendedLine) > lineWidth) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = extendedLine
    }
  }
  if (currentLine !== '') {
    lines.push(currentLine)
  }

  return lines
}
