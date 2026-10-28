import { describe, expect, it } from 'vitest'
import {
  applyImport,
  checkReferences,
  createProject,
  exportText,
  findPathTo,
  flattenStoredNodes,
  importText,
  indexNames,
  nameWarnings,
  parseSave,
  playerFormatVersion,
  previewImport,
  StoryRuntime,
  stateFromSave,
  storyFlow,
  toSave,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

/** Plays to the end, picking the first option offered at each choice unless told which; returns the pages shown. */
function pagesShown(lines: string[], optionTexts: string[] = []): string[] {
  const runtime = new StoryRuntime(storyFromText(lines))
  const remaining = [...optionTexts]
  const shown: string[] = []
  runtime.start()
  for (let step = runtime.snapshot.step; step.type !== 'end'; step = runtime.snapshot.step) {
    if (step.type === 'page') {
      shown.push(step.page.text)
      runtime.next()
    } else {
      const wanted = remaining.shift()
      const option = step.choice.options.find(candidate => wanted === undefined || candidate.text === wanted)!
      shown.push(`> ${option.text}`)
      runtime.choose(option.id)
    }
  }
  return shown
}

const problemsOf = (lines: string[]) => {
  const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
  return [...imported.problems, ...checkReferences(imported)].sort((first, second) => first.line - second.line).map(problem => `${problem.line} ${problem.code}${problem.subject === undefined ? '' : ` ${problem.subject}`}`)
}

describe('counters', () => {
  it('count up from their initial value, each [add] adding its amount, one by default', () => {
    expect(pagesShown([
      '[counter: Trust = 2]',
      '[add: Trust]',
      '[add: Trust 3]',
      '[add: Trust -1]',
      '[if: Trust is 5]',
      'Five.',
      '[end]',
      '[if: Trust >= 6]',
      'Six or more.',
      '[else if: Trust > 4 and Trust < 6 and Trust <= 5]',
      'Between.',
      '[end]',
    ])).toEqual(['Five.', 'Between.'])
  })

  it('start at 0 when an [add] makes them, and take a value from [set]', () => {
    expect(pagesShown([
      '[if: Coins is 0]',
      'Broke.',
      '[end]',
      '[add: Coins 10]',
      '[set: Coins = 3]',
      '[if: Coins is not 10 and Coins is 3]',
      'Three coins.',
      '[end]',
    ])).toEqual(['Broke.', 'Three coins.'])
  })

  it('end a loop once they reach a number, and decide which options are offered', () => {
    expect(pagesShown([
      '[loop]',
      '[add: Rounds]',
      'Round.',
      '[if: Rounds >= 3]',
      '[break]',
      '[end]',
      '[end]',
      '[choice: Next]',
      '> Rest [if: Rounds < 3]',
      '> Fight on [if: Rounds >= 3]',
    ])).toEqual(['Round.', 'Round.', 'Round.', '> Fight on'])
  })

  it('are counted per option: going back past a choice undoes what it added', () => {
    const runtime = new StoryRuntime(storyFromText([
      '[choice: Gift]',
      '> Flowers = Flowers',
      '> Nothing = Nothing',
      '[if: Gift is Flowers]',
      '[add: Affection 2]',
      '[end]',
      '[if: Affection >= 2]',
      'She smiles.',
      '[else]',
      'She shrugs.',
      '[end]',
    ]))
    runtime.start()
    const choice = runtime.snapshot.step.type === 'choice' ? runtime.snapshot.step.choice : null
    runtime.choose(choice!.options[0]!.id)
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('She smiles.')
    runtime.back()
    runtime.choose(choice!.options[1]!.id)
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('She shrugs.')
  })

  it('are saved by name, and read back into the same values', () => {
    const story = storyFromText(['[counter: Trust = 1]', '[add: Trust 4]', 'Saved here.', '[if: Trust is 5]', 'Kept.', '[end]'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    const save = toSave(story, runtime.exportState(), '2026-10-28T10:00:00.000Z')
    expect(save.counters).toEqual({ Trust: 5 })
    expect(parseSave(JSON.parse(JSON.stringify(save)))).not.toBeNull()
    expect(parseSave({ ...save, counters: { Trust: 'five' } })).toBeNull()

    const resumed = new StoryRuntime(story)
    resumed.restoreState(stateFromSave(story, save))
    resumed.next()
    expect(resumed.snapshot.step.type === 'page' && resumed.snapshot.step.page.text).toBe('Kept.')
  })

  it('leave saves of stories without counters as they were', () => {
    const story = storyFromText(['Hello.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(toSave(story, runtime.exportState(), '2026-10-28T10:00:00.000Z')).not.toHaveProperty('counters')
  })

  it('are reached through by the path finder, which tells counts apart', () => {
    const story = storyFromText([
      '[loop]',
      '[choice: Act]',
      '> Train = Train',
      '> Leave = Leave',
      '[if: Act is Train]',
      '[add: Strength]',
      '[else]',
      '[break]',
      '[end]',
      '[end]',
      '[if: Strength >= 2]',
      'Strong enough.',
      '[end]',
    ])
    const strong = flattenStoredNodes(story.chapters[0]!.nodes).find(node => node.type === 'page')!
    expect(findPathTo(story, strong.id)?.optionIds.length).toBe(3)
  })

  it('are reported when misused', () => {
    expect(problemsOf([
      '[counter: Trust = high]',
      '[counter: Fear]',
      '[counter: Fear = 1]',
      '[add:]',
      '[if: Courage > 2]',
      '[end]',
      '[set: Fear = a lot]',
      '[if: Fear is many]',
      '[end]',
      '[unset: Fear]',
      '[decision: Mood = Calm | Angry]',
      '[add: Mood]',
    ])).toEqual([
      '1 invalidCounter Trust = high',
      '3 duplicateCounter Fear',
      '4 invalidAdd',
      '5 unknownCounter Courage',
      '7 counterNeedsNumber Fear: a lot',
      '8 counterNeedsNumber Fear: many',
      '10 unsetCounter Fear',
      '11 counterNamedLikeDecision Mood',
    ])
  })

  it('are written back as they are imported', () => {
    const text = [
      '[import: story]',
      '[counter: Trust = 2]',
      '#',
      '[add: Trust 1]',
      '[add: Fear -2]',
      '[set: Trust = 7]',
      '[if: Trust >= 3 and Fear is not 0 or Trust is 2]',
      'Hm.',
      '[end]',
      '',
    ].join('\n')
    const project = createProject({ name: 'Game', locale: 'en' })
    const preview = previewImport(text, project, monospaceLayout)
    expect(preview.problems).toEqual([])
    const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null })
    expect(applied.project.counters.map(counter => [counter.name, counter.initial, counter.implicit === true])).toEqual([['Trust', 2, false], ['Fear', 0, true]])
    expect(exportText(applied.project, applied.chapters, { declareDecisions: true })).toBe(text)
  })

  it('make a game for Datajack 1.2 or later, which older players tell to update', () => {
    expect(playerFormatVersion(storyFromText(['Hello.']).project)).toBe('1.1')
    expect(playerFormatVersion(storyFromText(['[add: Trust]', 'Hello.']).project)).toBe('1.3')
  })

  it('are listed in the index, with what looks forgotten', () => {
    const story = storyFromText(['[counter: Unused]', '[counter: Fixed = 3]', '[if: Fixed > 1]', 'Hm.', '[end]', '[add: Coins]'])
    const index = indexNames(story.project, story.chapters)
    const counters = index.filter(name => name.kind === 'counter')
    expect(counters.map(name => [name.name, name.uses.map(entry => entry.role)])).toEqual([
      ['Unused', ['declared']],
      ['Fixed', ['declared', 'tested']],
      ['Coins', ['changed']],
    ])
    expect(nameWarnings(index, story.project, storyFlow(story.chapters, [])).map(warning => `${warning.name.name} ${warning.code}`)).toEqual([
      'Unused declaredNeverUsed',
      'Fixed counterTestedNeverChanged',
      'Coins counterChangedNeverTested',
    ])
  })
})
