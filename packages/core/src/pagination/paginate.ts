import { splitClauses, splitSentences } from './splitText'
import { textOfRange, wholeTextRange, type TextRange } from './textRange'
import { chunkRanges, wrapLines, type MeasureText } from './wrapLines'

/** The textbox a page must fit in. */
export interface PageLayout {
  lineWidth: number
  maxLines: number
  measureText: MeasureText
}

/**
 * Cuts a paragraph into pages that each fit in the textbox.
 *
 * Pages break between sentences when possible. A sentence too long for one page breaks between
 * its clauses, and a clause too long for one page between its words. Pages are filled greedily
 * and cover the whole text, spaces included: callers trim them.
 */
export function paginate(text: string, layout: PageLayout, locale: string): TextRange[] {
  const fitsOnOnePage = (range: TextRange) =>
    wrapLines(textOfRange(text, range).trim(), layout.lineWidth, layout.measureText).length <= layout.maxLines

  const wholeText = wholeTextRange(text)
  if (fitsOnOnePage(wholeText)) {
    return [wholeText]
  }

  const pieces: TextRange[] = []
  for (const sentence of splitSentences(text, locale)) {
    if (fitsOnOnePage(sentence)) {
      pieces.push(sentence)
      continue
    }
    for (const clause of splitClauses(text, sentence)) {
      pieces.push(...(fitsOnOnePage(clause) ? [clause] : chunkRanges(text, clause)))
    }
  }

  const pages: TextRange[] = []
  let currentPage: TextRange | null = null
  for (const piece of pieces) {
    if (currentPage === null) {
      currentPage = { ...piece }
      continue
    }
    const extendedPage: TextRange = { start: currentPage.start, end: piece.end }
    if (fitsOnOnePage(extendedPage)) {
      currentPage = extendedPage
    } else {
      pages.push(currentPage)
      currentPage = { ...piece }
    }
  }
  if (currentPage !== null) {
    pages.push(currentPage)
  }

  return pages
}
