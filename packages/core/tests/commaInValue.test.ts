import { describe, expect, it } from 'vitest'
import { importText } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const importLines = (lines: string[]) => importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })

describe('a comma in a decision value', () => {
  it('is read as a space, and the import says so once per value', () => {
    const imported = importLines([
      '[decision multi lasting: Foe = The Lost Property, Again | Auntie Ember | Sir Rattlebones, the Undefeated]',
      '[set: Foe = The Lost Property, Again]',
      'Text.',
    ])
    expect(imported.decisions[0]!.values).toEqual(['The Lost Property Again', 'Auntie Ember', 'Sir Rattlebones the Undefeated'])
    expect(imported.problems).toEqual([
      { severity: 'warning', code: 'commaInValue', line: 1, subject: 'The Lost Property, Again', suggestion: 'The Lost Property Again' },
      { severity: 'warning', code: 'commaInValue', line: 1, subject: 'Sir Rattlebones, the Undefeated', suggestion: 'Sir Rattlebones the Undefeated' },
    ])
  })

  it('says nothing for values without one', () => {
    expect(importLines(['[decision: Mood = calm | angry]', 'Text.']).problems).toEqual([])
  })

  it('says nothing for a value of commas alone, which tags do not read at all', () => {
    expect(importLines(['[decision: Mood = calm | , | angry]', 'Text.']).problems).toEqual([])
  })
})
