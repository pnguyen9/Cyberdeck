import { textOfRange, wholeTextRange, type TextRange } from './textRange'

/** `M.`, `J.`, `Mr.`, `Mme.`…: a full stop that does not end the sentence. */
const ENDS_WITH_ABBREVIATION = /(?:^|[\s(«"“])(?:\p{Lu}|Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Mme|Mmes|Mlle|Mlles|MM|Me|Pr)\.$/u

/** What follows a quotation inside the same sentence: `» dit-elle.`, `she asked.` */
const CONTINUES_PREVIOUS_SENTENCE = /^[\p{Ll}»”’)\]]/u

const sentenceSegmenters = new Map<string, Intl.Segmenter>()

function sentenceSegmenterFor(locale: string): Intl.Segmenter {
  let segmenter = sentenceSegmenters.get(locale)
  if (segmenter === undefined) {
    segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' })
    sentenceSegmenters.set(locale, segmenter)
  }
  return segmenter
}

/**
 * Splits a range into sentences with the platform's sentence segmenter, then rejoins the pieces it
 * cuts too eagerly: after abbreviations, and before the speech tag following a quotation.
 * Sentences keep their trailing spaces, so they cover the whole range.
 */
export function splitSentences(text: string, locale: string, range: TextRange = wholeTextRange(text)): TextRange[] {
  const sentences: TextRange[] = []

  for (const segment of sentenceSegmenterFor(locale).segment(textOfRange(text, range))) {
    const sentence = { start: range.start + segment.index, end: range.start + segment.index + segment.segment.length }
    const previousSentence = sentences.at(-1)

    if (previousSentence !== undefined && isSameSentence(text, previousSentence, sentence)) {
      previousSentence.end = sentence.end
    } else {
      sentences.push(sentence)
    }
  }

  return sentences
}

function isSameSentence(text: string, previousSentence: TextRange, sentence: TextRange): boolean {
  return ENDS_WITH_ABBREVIATION.test(textOfRange(text, previousSentence).trimEnd())
    || CONTINUES_PREVIOUS_SENTENCE.test(textOfRange(text, sentence).trimStart())
}

/**
 * Splits a range after the punctuation that separates the parts of a sentence: `,` `;` `:` and
 * spaced dashes. Only punctuation followed by a space counts, so `3,50` stays whole.
 */
export function splitClauses(text: string, range: TextRange): TextRange[] {
  const clauses: TextRange[] = []
  let clauseStart = range.start

  for (let index = range.start; index < range.end - 1; index++) {
    if (isClauseEnd(text, index) && text[index + 1] === ' ') {
      let nextClauseStart = index + 1
      while (nextClauseStart < range.end && text[nextClauseStart] === ' ') {
        nextClauseStart++
      }
      if (nextClauseStart < range.end) {
        clauses.push({ start: clauseStart, end: nextClauseStart })
        clauseStart = nextClauseStart
      }
    }
  }
  clauses.push({ start: clauseStart, end: range.end })

  return clauses
}

function isClauseEnd(text: string, index: number): boolean {
  const character = text[index]
  if (character === ',' || character === ';' || character === ':') {
    return true
  }
  return (character === '—' || character === '–') && text[index - 1] === ' '
}
