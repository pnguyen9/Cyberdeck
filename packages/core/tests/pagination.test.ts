import { describe, expect, it } from 'vitest'
import { paginate, splitClauses, splitSentences, wrapLines } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const characterCount = (text: string) => [...text].length

/** Pieces as strings, to read expectations more easily than offsets. */
const piecesOf = (text: string, ranges: { start: number; end: number }[]) =>
  ranges.map(range => text.slice(range.start, range.end))

describe('wrapLines', () => {
  it('fills each line greedily', () => {
    expect(wrapLines('one two three four', 9, characterCount)).toEqual(['one two', 'three', 'four'])
  })

  it('never starts a line with French spaced punctuation', () => {
    expect(wrapLines('Il dit bonjour !', 14, characterCount)).toEqual(['Il dit', 'bonjour !'])
    expect(wrapLines('Quoi ? Vraiment ?', 6, characterCount)).toEqual(['Quoi ?', 'Vraiment ?'])
  })

  it('never ends a line with an opening guillemet', () => {
    expect(wrapLines('Elle cria « Non', 11, characterCount)).toEqual(['Elle cria', '« Non'])
  })

  it('keeps a word longer than the line on its own line', () => {
    expect(wrapLines('a extraordinarily b', 5, characterCount)).toEqual(['a', 'extraordinarily', 'b'])
  })

  it('treats non-breaking spaces as part of the word', () => {
    expect(wrapLines('Il dit bonjour !', 14, characterCount)).toEqual(['Il dit', 'bonjour !'])
  })
})

describe('splitSentences', () => {
  it('covers the whole text, spaces included', () => {
    const text = 'One. Two? Three!'
    expect(piecesOf(text, splitSentences(text, 'en'))).toEqual(['One. ', 'Two? ', 'Three!'])
  })

  it('handles French spaced punctuation', () => {
    const text = 'Bonjour ! Ça va ? Oui.'
    expect(piecesOf(text, splitSentences(text, 'fr'))).toEqual(['Bonjour ! ', 'Ça va ? ', 'Oui.'])
  })

  it('does not split after an abbreviation or an initial', () => {
    const text = 'M. Dupont arriva. Mr. Smith left. J. K. wrote.'
    expect(piecesOf(text, splitSentences(text, 'en'))).toEqual(['M. Dupont arriva. ', 'Mr. Smith left. ', 'J. K. wrote.'])
  })

  it('keeps the speech tag that follows a quotation in the same sentence', () => {
    const french = '« Viens ici ! » dit-elle. Il obéit.'
    expect(piecesOf(french, splitSentences(french, 'fr'))).toEqual(['« Viens ici ! » dit-elle. ', 'Il obéit.'])

    const english = '"Really?" she asked. Yes.'
    expect(piecesOf(english, splitSentences(english, 'en'))).toEqual(['"Really?" she asked. ', 'Yes.'])
  })

  it('works on a range of a larger text', () => {
    const text = 'Ignored. Kept one. Kept two.'
    expect(piecesOf(text, splitSentences(text, 'en', { start: 9, end: text.length }))).toEqual(['Kept one. ', 'Kept two.'])
  })
})

describe('splitClauses', () => {
  it('splits after commas, semicolons, colons and dashes', () => {
    const text = 'First, second; third: fourth — fifth'
    expect(piecesOf(text, splitClauses(text, { start: 0, end: text.length }))).toEqual(
      ['First, ', 'second; ', 'third: ', 'fourth — ', 'fifth'],
    )
  })

  it('does not split on a comma inside a number', () => {
    const text = 'It cost 3,50 euros, too much.'
    expect(piecesOf(text, splitClauses(text, { start: 0, end: text.length }))).toEqual(['It cost 3,50 euros, ', 'too much.'])
  })
})

describe('paginate', () => {
  it('keeps a text that fits on a single page', () => {
    const text = 'Short enough.'
    expect(piecesOf(text, paginate(text, monospaceLayout, 'en'))).toEqual(['Short enough.'])
  })

  it('returns ranges that cover the whole text without gaps', () => {
    const text = 'The rain had not stopped for three days. Every street in the district was flooded. Nobody remembered when the sun had last shown itself.'
    const ranges = paginate(text, monospaceLayout, 'en')

    expect(ranges[0]?.start).toBe(0)
    expect(ranges.at(-1)?.end).toBe(text.length)
    for (let index = 1; index < ranges.length; index++) {
      expect(ranges[index]?.start).toBe(ranges[index - 1]?.end)
    }
  })

  it('does not break after an abbreviation even when the page is full', () => {
    // Splitting after 'M.' would fit 'Then she saw M.' on the first page and start the second with 'Dupont'.
    const text = 'The station was almost empty at night. Then she saw M. Dupont waiting there for the last train.'
    expect(piecesOf(text, paginate(text, monospaceLayout, 'fr')).map(piece => piece.trim())).toEqual(
      ['The station was almost empty at night.', 'Then she saw M. Dupont waiting there for the last train.'],
    )
  })
})
