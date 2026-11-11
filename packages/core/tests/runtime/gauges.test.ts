import { describe, expect, it } from 'vitest'
import { checkReferences, exportText, importText, indexNames, parseSave, playerFormatVersion, stateFromSave, StoryRuntime, toSave } from '../../src/index'
import { storyFromText } from './storyFromText'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

const STORY = [
  '[counter: HP = 30]', '[counter: MaxHP = 30]', '[counter: Gold = 0]', '[ask: Hero = Alex]',
  '[gauge: HP / {MaxHP} top right numbers = {Hero}]', '[gauge: Gold / 100 gold]',
  'Ready.',
  '[add: HP -12]', '[add: Gold 250]',
  'Hit.',
  '[gauge: Gold none]',
  'Gold put away.',
  '[gauge: none]',
  'Nothing shown.',
]

function playedTo(runtime: StoryRuntime, text: string) {
  for (let guard = 0; guard < 50; guard++) {
    const step = runtime.snapshot.step
    if (step.type === 'page' && step.page.text === text) {
      return
    }
    if (step.type === 'ask') {
      runtime.answer('Sam')
    } else {
      runtime.next()
    }
  }
  throw new Error(`Never reached ${text}`)
}

describe('gauges', () => {
  it('show a counter out of a number or another counter, follow it, and are taken away one by one or all at once', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start(0)
    playedTo(runtime, 'Ready.')
    expect(runtime.gaugesShown().map(({ label, share, numbers, place, color }) => ({ label, share, numbers, place, color }))).toEqual([
      { label: 'Sam', share: 1, numbers: { held: '30', maximum: '30' }, place: 'top right', color: null },
      { label: 'Gold', share: 0, numbers: null, place: 'top left', color: 'gold' },
    ])
    playedTo(runtime, 'Hit.')
    // A gauge is never fuller than full.
    expect(runtime.gaugesShown().map(gauge => [gauge.share, gauge.numbers?.held ?? null])).toEqual([[18 / 30, '18'], [1, null]])
    playedTo(runtime, 'Gold put away.')
    expect(runtime.gaugesShown().map(gauge => gauge.label)).toEqual(['Sam'])

    // A save keeps the gauges by name, and gives them back.
    const save = parseSave(JSON.parse(JSON.stringify(toSave(story, runtime.exportState(), '2026-11-11T00:00:00.000Z'))))
    expect(save?.stage.gauges).toEqual([{ counter: 'HP', of: { counter: 'MaxHP' }, place: 'top right', numbers: true, label: '{Hero}' }])
    const resumed = new StoryRuntime(story)
    resumed.restoreState(stateFromSave(story, save!))
    expect(resumed.gaugesShown().map(gauge => [gauge.label, gauge.share])).toEqual([['Sam', 18 / 30]])

    playedTo(runtime, 'Nothing shown.')
    expect(runtime.gaugesShown()).toEqual([])
  })

  it('counts the names in its label as shown, and its counters as read, in the Index', () => {
    const story = storyFromText(['[counter: HP = 3]', '[decision: Trainer = Rei | Aiko]', '[gauge: HP / 10 = {Trainer}\'s pet]', 'Text.'])
    const roles = (name: string) => indexNames(story.project, story.chapters).find(indexed => indexed.name === name)?.uses.map(use => use.role)
    expect(roles('Trainer')).toContain('shown')
    expect(roles('HP')).toContain('shown')
  })

  it('is written back as it was typed, needs Datajack 3.3, and is checked like any tag naming counters', () => {
    const story = storyFromText(STORY)
    const exported = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(exported).toContain('[gauge: HP / {MaxHP} top right numbers = {Hero}]')
    expect(exported).toContain('[gauge: Gold / 100 gold]')
    expect(exported).toContain('[gauge: Gold none]')
    expect(exported).toContain('[gauge: none]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.3')

    const problems = (lines: string[]) => {
      const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
      return [...imported.problems, ...checkReferences(imported)].filter(problem => problem.severity === 'error').map(problem => [problem.code, problem.subject])
    }
    expect(problems(['[counter: HP = 3]', '[gauge: Health / 10]', '[gauge: HP / {Most}]', 'Text.'])).toEqual([['unknownCounter', 'Health'], ['unknownCounter', 'Most']])
    // Each mistake is told apart: the maximum, a word not understood, a name left empty.
    expect(problems(['[counter: HP = 3]', '[gauge: HP]', '[gauge: HP / MaxHP]', '[gauge: HP / 10 middle]', '[gauge: HP / 0]', '[gauge: HP / 10 =]', 'Text.']))
      .toEqual([['gaugeMaximum', 'HP'], ['gaugeMaximum', 'HP'], ['gaugeWord', 'middle'], ['gaugeMaximum', 'HP'], ['invalidGauge', 'HP / 10 =']])
    // A gauge named none is a gauge, not one taken away.
    expect(problems(['[counter: HP = 3]', '[gauge: HP / 10 = none]', 'Text.'])).toEqual([])
    expect(problems(['[counter: HP = 3]', '[gauge: HP / 10 = {Nobody}]', 'Text.'])).toEqual([['unknownValue', 'Nobody']])
  })
})
