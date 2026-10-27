/** A part of a text, from `start` included to `end` excluded, in string indexes. */
export interface TextRange {
  start: number
  end: number
}

export function wholeTextRange(text: string): TextRange {
  return { start: 0, end: text.length }
}

export function textOfRange(text: string, range: TextRange): string {
  return text.slice(range.start, range.end)
}
