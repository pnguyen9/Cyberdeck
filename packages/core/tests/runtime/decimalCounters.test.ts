import { describe, expect, it } from 'vitest'
import {
  checkReferences,
  exportText,
  importText,
  playerFormatVersion,
  projectIn,
  readTypedNumber,
  stateFromSave,
  StoryRuntime,
  toSave,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

const STORY = [
  '[counter: Money = 1000.00]',
  '[add: Money -0.50]',
  '[add: Money 0.1]',
  '[add: Money 0.2]',
  '[if: Money >= 999.80]',
  'You have {Money} dollars.',
  '[else]',
  'Short.',
  '[end]',
]

const shownText = (runtime: StoryRuntime) => {
  const step = runtime.snapshot.step
  return step.type === 'page' ? step.page.text : step.type
}

describe('a counter with decimals', () => {
  it('counts exactly with the decimals it is declared with, and shows them as the game’s language writes numbers', () => {
    const story = storyFromText(STORY)
    expect(story.project.counters[0]).toMatchObject({ name: 'Money', initial: 100000, decimals: 2 })
    const runtime = new StoryRuntime(story)
    runtime.start()
    // 1000 − 0.50 + 0.1 + 0.2 is exactly 999.80, never 999.8000000000001.
    expect(shownText(runtime)).toBe('You have 999.80 dollars.')
    const french = new StoryRuntime({ ...story, project: projectIn(story.project, 'fr') })
    french.start()
    expect(shownText(french)).toBe('You have 999,80 dollars.')
  })

  it('keeps its number in saves as it reads, and back', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const save = toSave(story, runtime.exportState(), '2026-11-10T10:00:00.000Z')
    expect(save.counters).toEqual({ Money: 999.8 })
    expect(stateFromSave(story, save).counters).toEqual(runtime.exportState().counters)
  })

  it('writes back as written, and needs Datajack 2.1', () => {
    const story = storyFromText(STORY)
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(written).toContain('[counter: Money = 1000.00]')
    expect(written).toContain('[add: Money -0.50]')
    expect(written).toContain('[add: Money 0.10]')
    expect(written).toContain('[if: Money >= 999.80]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })

  it('reports a number with more decimals than its counter keeps', () => {
    const problems = (lines: string[]) => {
      const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
      return checkReferences(imported).map(problem => `${problem.code} ${problem.subject} ${problem.suggestion ?? ''}`.trim())
    }
    expect(problems(['[counter: Coins = 0]', '[add: Coins 0.5]', 'Hi.'])).toEqual(['counterTooPrecise Coins: 0.5 0'])
    expect(problems(['[counter: Money = 0.0]', '[set: Money = 2.25]', '[if: Money > 1.05]', 'Hi.', '[end]'])).toEqual([
      'counterTooPrecise Money: 2.25 1',
      'counterTooPrecise Money: 1.05 1',
    ])
    expect(problems(['[counter: Money = 0.00]', '[set: Money = random 0.01 9.99]', 'Hi.'])).toEqual([])
  })
})

describe('a number typed by the player', () => {
  const hundredths = { decimals: 2 }
  it('takes a comma or a point as the decimal sign whatever the language, spaces ignored', () => {
    expect(['13,37', '13.37', '1 000 000,05', ' 1000000.05 ', '-0,5', '7', ',5', '5,'].map(typed => readTypedNumber(typed, hundredths, null, null)))
      .toEqual([{ units: 1337 }, { units: 1337 }, { units: 100000005 }, { units: 100000005 }, { units: -50 }, { units: 700 }, { units: 50 }, { units: 500 }])
  })

  it('refuses what is no number, has more decimals than kept, or lies out of bounds', () => {
    expect(['', '1,000.50', '1.2.3', 'ten', '0.505'].map(typed => readTypedNumber(typed, hundredths, null, null)))
      .toEqual([{ problem: 'empty' }, { problem: 'notANumber' }, { problem: 'notANumber' }, { problem: 'notANumber' }, { problem: 'tooPrecise' }])
    expect(readTypedNumber('1,000', {}, null, null)).toEqual({ problem: 'tooPrecise' })
    expect(['-5', '0', '1', '250', '251'].map(typed => readTypedNumber(typed, {}, 1, 250)))
      .toEqual([{ problem: 'belowMinimum' }, { problem: 'belowMinimum' }, { units: 1 }, { units: 250 }, { problem: 'aboveMaximum' }])
  })
})

describe('a number asked for', () => {
  const BET = [
    '[counter: Money = 100.00]',
    '[ask number: Bet = 10.00, from 0.50 to {Money}]',
    '[add: Money -{Bet}]'.replace('-{Bet}', '-1'),
    'You bet {Bet}.',
  ]

  it('is kept within its bounds, a counter bound read as it is asked, and writes back as written', () => {
    const story = storyFromText(BET)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const step = runtime.snapshot.step
    expect(step.type === 'askNumber' ? [step.minimum, step.maximum, step.proposed] : step.type).toEqual([50, 10000, 1000])
    runtime.answerNumber(2550)
    expect(shownText(runtime)).toBe('You bet 25.50.')
    const proposed = new StoryRuntime(story)
    proposed.start()
    proposed.answerNumber(null)
    expect(shownText(proposed)).toBe('You bet 10.00.')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[ask number: Bet = 10.00, from 0.50 to {Money}]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })

  it('reports a bound naming no counter', () => {
    const imported = importText(['[ask number: Bet = 1, from 1 to {Mony}]', 'Hi.'].join('\n'), { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported).map(problem => `${problem.code} ${problem.subject}`)).toEqual(['unknownCounter Mony'])
  })
})

describe('a counter counting with another', () => {
  const BET = [
    '[counter: Money = 100.00]',
    '[counter: Bet = 10]',
    '[counter: Hand = 0]',
    '[add: Money -{Bet}]',
    'Bet placed: {Money} left.',
    '[if: Money >= {Bet}]',
    'You could bet again.',
    '[end]',
    '[add: Money {Bet} * 2.5]',
    '[set: Hand = {Bet}]',
    'Paid 3 to 2: {Money}, hand {Hand}.',
  ]

  it('adds, takes and sets what another holds, times a factor, whatever decimals each keeps, and compares with it', () => {
    const story = storyFromText(BET)
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(shownText(runtime)).toBe('Bet placed: 90.00 left.')
    runtime.next()
    expect(shownText(runtime)).toBe('You could bet again.')
    runtime.next()
    expect(shownText(runtime)).toBe('Paid 3 to 2: 115.00, hand 10.')
  })

  it('writes back as written, reports a value naming no counter, and needs Datajack 2.1', () => {
    const story = storyFromText(BET)
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(['[add: Money -{Bet}]', '[if: Money >= {Bet}]', '[add: Money {Bet} * 2.5]', '[set: Hand = {Bet}]'].map(line => written.includes(line))).toEqual([true, true, true, true])
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
    const imported = importText(['[counter: Money = 0]', '[add: Money {Bt}]', '[if: Money > {Bt}]', 'Hi.', '[end]'].join('\n'), { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported).map(problem => `${problem.code} ${problem.subject}`)).toEqual(['unknownCounter Bt', 'unknownCounter Bt'])
  })
})
