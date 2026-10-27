import { describe, expect, it } from 'vitest'
import { importText } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const problemsOf = (lines: string[], knownCharacterNames: string[] = []) =>
  importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en', knownCharacterNames }).problems

describe('stage directive problems', () => {
  it('reports a stage directive missing what it needs, on the line where it is written', () => {
    expect(problemsOf(['[move: marie]', 'Text. [wait: soon]'])).toEqual([
      { severity: 'error', code: 'invalidStageDirective', line: 1, subject: 'move' },
      { severity: 'error', code: 'invalidStageDirective', line: 2, subject: 'wait' },
    ])
  })

  it('warns about a directive that looks like a misspelled keyword rather than a character', () => {
    expect(problemsOf(['[backgound: rooftop]', 'Text.'])).toEqual([
      { severity: 'warning', code: 'looksLikeStageKeyword', line: 1, subject: 'backgound', suggestion: 'background' },
    ])
  })

  it('does not suspect a typo for characters it knows: speakers, entrances, or the project', () => {
    expect(problemsOf(['[entre: smile]', '— Entre: Hello.'])).toEqual([])
    expect(problemsOf(['[enter: entre]', '[entre: smile]', 'Hello.'])).toEqual([])
    expect(problemsOf(['[entre: smile]', 'Bye.'], ['Entre'])).toEqual([])
  })

  it('reads several-word character names it knows', () => {
    expect(problemsOf(['— Old Marie: Hello.', '[move: Old Marie left]', 'Bye.'])).toEqual([])
  })
})
