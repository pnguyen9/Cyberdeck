import { describe, expect, it } from 'vitest'
import { checkReferences, importText, type KnownNames } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const problemsOf = (lines: string[], knownNames?: KnownNames) =>
  checkReferences(importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' }), knownNames)

describe('checkReferences', () => {
  it('accepts references to declared decisions and values, ignoring case', () => {
    expect(problemsOf([
      '[decision: Confession = Accept | Refuse]',
      '[if: confession is ACCEPT]',
      'Yes.',
      '[end]',
      '[set: Confession = Refuse]',
    ])).toEqual([])
  })

  it('reports an unknown decision', () => {
    expect(problemsOf(['[if: Mood is Happy]', 'Smile.', '[end]'])).toEqual([
      { severity: 'error', code: 'unknownDecision', line: 1, subject: 'Mood' },
    ])
  })

  it('checks what [unset] takes away: the decision, and the value when one is named', () => {
    expect(problemsOf(['[decision: Confession = Accept | Refuse]', '[unset: Confession]', '[unset: Confession = Maybe]', '[unset: Mood]'])).toEqual([
      { severity: 'error', code: 'unknownDecisionValue', line: 3, subject: 'Confession: Maybe' },
      { severity: 'error', code: 'unknownDecision', line: 4, subject: 'Mood' },
    ])
  })

  it('reports an unknown value of a known decision', () => {
    expect(problemsOf(['[decision: Confession = Accept | Refuse]', '[set: Confession = Maybe]'])).toEqual([
      { severity: 'error', code: 'unknownDecisionValue', line: 2, subject: 'Confession: Maybe' },
    ])
  })

  it('lets a choice declare its decision, with the option values', () => {
    expect(problemsOf(['[choice: Answer]', '> Yes', '> No = Never', '[if: Answer is A or Answer is Never]', 'Ok.', '[end]'])).toEqual([])
    expect(problemsOf(['[choice: Answer]', '> Yes', '> No', '[if: Answer is C]', 'Ok.', '[end]'])).toEqual([
      { severity: 'error', code: 'unknownDecisionValue', line: 4, subject: 'Answer: C' },
    ])
  })

  it('merges the values of several choices on the same undeclared decision', () => {
    expect(problemsOf(['[choice: Path]', '> Left', '[choice: Path]', '> Up = Up', '[if: Path is A or Path is Up]', 'Ok.', '[end]'])).toEqual([])
  })

  it('reports a choice offering a value its declared decision does not have', () => {
    expect(problemsOf(['[decision: Confession = Accept | Refuse]', '[choice: Confession]', '> Maybe = Perhaps'])).toEqual([
      { severity: 'error', code: 'unknownDecisionValue', line: 3, subject: 'Confession: Perhaps' },
    ])
  })

  it('reports a decision declared twice', () => {
    expect(problemsOf(['[decision: Mood = Happy]', '[decision: mood = Sad]'])).toEqual([
      { severity: 'error', code: 'duplicateDecision', line: 2, subject: 'mood' },
    ])
  })

  it('reports unknown scenes, scenes named twice, and scenes that would play themselves', () => {
    expect(problemsOf([
      '[play: Small talk]',
      '[play: Nowhere]',
      '# Scene: Small talk',
      '[play: Echo]',
      '# Scene: Echo',
      '[play: small talk]',
      '# Scene: ECHO',
      'Again.',
    ])).toEqual([
      { severity: 'error', code: 'unknownScene', line: 2, subject: 'Nowhere' },
      { severity: 'error', code: 'sceneCallsItself', line: 4, subject: 'Echo' },
      { severity: 'error', code: 'sceneCallsItself', line: 6, subject: 'small talk' },
      { severity: 'error', code: 'duplicateScene', line: 7, subject: 'ECHO' },
    ])
  })

  it('knows the scenes of the project, and what they play', () => {
    const knownNames: KnownNames = { decisions: [], scenes: [{ name: 'Caught', plays: [] }, { name: 'Loop', plays: ['Back'] }] }
    expect(problemsOf(['[play: caught]'], knownNames)).toEqual([])
    expect(problemsOf(['# Scene: Back', '[play: Loop]'], knownNames)).toEqual([
      { severity: 'error', code: 'sceneCallsItself', line: 2, subject: 'Loop' },
    ])
  })

  it('reports styles used but never declared, and styles declared twice; a property alone needs no declaration', () => {
    expect(problemsOf(['[style: Whisper = italic, grey]', '[style: whisper = bold]', '[style: whisper]Psst. [style: bold]Loud. [style: Yell]Louder.'])).toEqual([
      { severity: 'error', code: 'duplicateStyle', line: 2, subject: 'whisper' },
      { severity: 'error', code: 'unknownStyle', line: 3, subject: 'Yell' },
    ])
    expect(problemsOf(['[style: Whisper]Psst.'], { decisions: [], styles: ['whisper'] })).toEqual([])
  })

  it('checks the conditions of options too', () => {
    expect(problemsOf(['[choice: Where]', '> Home [if: Mood is Happy]', '> Out'])).toEqual([
      { severity: 'error', code: 'unknownDecision', line: 2, subject: 'Mood' },
    ])
  })

  it('checks references inside every branch', () => {
    expect(problemsOf(['[decision: Mood = Happy]', '[if: Mood is Happy]', '[else]', '[if: Weather is Rain]', 'Wet.', '[end]', '[end]'])).toEqual([
      { severity: 'error', code: 'unknownDecision', line: 4, subject: 'Weather' },
    ])
  })

  it('accepts names the project already has', () => {
    const knownNames: KnownNames = { decisions: [{ name: 'Confession', values: ['Accept', 'Refuse'] }] }
    expect(problemsOf(['[if: Confession is Refuse]', 'Sad.', '[end]'], knownNames)).toEqual([])
  })

  it('leaves invalid conditions to the import, which already reported them', () => {
    expect(problemsOf(['[if: nonsense]', '[end]'])).toEqual([])
  })
})

describe('memories and endings', () => {
  const check = (lines: string[], knownNames?: Parameters<typeof checkReferences>[1]) =>
    checkReferences(importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' }), knownNames).map(problem => `${problem.code} ${problem.subject}`)

  it('may be tested before the place that names them', () => {
    expect(check(['[if: remembered Secret or seen ending Gone]', 'Hm.', '[end]', '[remember: Secret]', '[ending: Gone]'])).toEqual([])
  })

  it('named nowhere are typos', () => {
    expect(check(['[if: remembered Secrte]', 'Hm.', '[end]', '[remember: Secret]'])).toEqual(['unknownMemory Secrte'])
    expect(check(['[if: not seen ending Gnoe]', 'Hm.', '[end]'])).toEqual(['unknownEnding Gnoe'])
  })

  it('may be named in chapters already in the project', () => {
    expect(check(['[if: remembered Secret and seen ending Gone]', 'Hm.', '[end]'], { decisions: [], memories: ['secret'], endings: ['Gone'] })).toEqual([])
  })
})
