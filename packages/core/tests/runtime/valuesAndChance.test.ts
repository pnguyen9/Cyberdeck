import { describe, expect, it } from 'vitest'
import {
  checkReferences,
  exportText,
  importText,
  playerFormatVersion,
  StoryRuntime,
  stateFromSave,
  toSave,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

const problemsOf = (lines: string[]) => {
  const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
  return [...imported.problems, ...checkReferences(imported)].sort((first, second) => first.line - second.line)
    .map(problem => `${problem.line} ${problem.code}${problem.subject === undefined ? '' : ` ${problem.subject}`}`)
}

const shownText = (runtime: StoryRuntime) => {
  const step = runtime.snapshot.step
  return step.type === 'page' ? step.page.text : step.type
}

describe('values in the text', () => {
  it('show counters, decisions and names, whatever their case and spacing, and {{ as a brace', () => {
    const runtime = new StoryRuntime(storyFromText([
      '[counter: Hour = 8]',
      '[decision multi: Found = Key | Letter]',
      '[add: Hour 2]',
      '[set: Found = Letter]',
      '[set: Found = Key]',
      'It is {hour} o\'clock; you found {Found}. {{not a value}',
    ]))
    runtime.start()
    expect(shownText(runtime)).toBe('It is 10 o\'clock; you found Letter, Key. {not a value}')
  })

  it('show nothing for a decision not decided yet', () => {
    const runtime = new StoryRuntime(storyFromText(['[decision: Mood = Calm | Angry]', 'Mood: [{Mood}]'.replace('[', '(').replace(']', ')')]))
    runtime.start()
    expect(shownText(runtime)).toBe('Mood: ()')
  })

  it('are reported when they name nothing the story keeps, and a name asked cannot be a counter\'s', () => {
    expect(problemsOf(['[counter: Hour]', '[ask: Hour]', 'At {Hour}, {Nobody} came.'])).toEqual([
      '2 askedNameTaken Hour',
      '3 unknownValue Nobody',
    ])
  })

  it('cut pages as if each value were as long as it may be', () => {
    // A counter is measured as eight characters, a name as twelve: the same line fits with the first, not the second.
    const line = 'The clock on the wall said {Hour} and still nobody came to the door at all.'
    const pagesWith = (declaration: string) => importText(`${declaration}\n${line}`, { layout: monospaceLayout, locale: 'en', possibleValues: new Map([['hour', ['-0000000']]]) })
      .chapters[0]!.nodes.filter(node => node.type === 'page').length
    expect(pagesWith('[counter: Hour]')).toBe(1)
    expect(importText(`[ask: Hour]\n${line}`, { layout: monospaceLayout, locale: 'en' }).chapters[0]!.nodes.filter(node => node.type === 'page')).toHaveLength(2)
  })

  it('make a game for Datajack 1.4, which an older one would show as written', () => {
    const counted = storyFromText(['[counter: Hour]', 'At {Hour}.'])
    expect(playerFormatVersion(counted.project, counted.chapters)).toBe('1.5')
    const named = storyFromText(['[ask: Hero]', 'Hi {Hero}.'])
    expect(playerFormatVersion(named.project, named.chapters)).toBe('1.4')
    // Datajack 1.3 shows a name only written exactly so.
    const spaced = storyFromText(['[ask: Hero]', 'Hi { Hero }.'])
    expect(playerFormatVersion(spaced.project, spaced.chapters)).toBe('1.5')
  })

  it('are never cut in two by a page break', () => {
    const imported = importText(['[counter: Hour count]', `${'word '.repeat(13)}{Hour count} and the rest of the line goes on and on.`].join('\n'), { layout: monospaceLayout, locale: 'en' })
    const pages = imported.chapters[0]!.nodes.flatMap(node => node.type === 'page' ? [node.text] : [])
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.filter(text => text.includes('{Hour') || text.includes('count}'))).toEqual(pages.filter(text => text.includes('{Hour count}')))
  })

  it('cut pages for the widest value the text itself declares', () => {
    const imported = importText([
      '[decision: Mood = Calm | Absolutely furious and exhausted]',
      'Yes {Mood} now, said the old clock on the wall there, and more.',
    ].join('\n'), { layout: monospaceLayout, locale: 'en' })
    expect(imported.chapters[0]!.nodes.filter(node => node.type === 'page')).toHaveLength(2)
  })

  it('keep on a full screen what they showed when each page came', () => {
    const runtime = new StoryRuntime(storyFromText(['[counter: Hour = 1]', '[text: full]', 'At {Hour}.', '[add: Hour 5]', 'Now {Hour}.']))
    runtime.start()
    runtime.next()
    expect(runtime.screenfulPages().map(page => page.text)).toEqual(['At 1.', 'Now 6.'])
  })

  it('report a counter or a decision named as a name another chapter asks for', () => {
    const imported = importText(['[counter: Hero]', '[add: Hero]', 'Hi {Hero}.'].join('\n'), { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported, { decisions: [], askedNames: ['Hero'] }).map(problem => `${problem.line} ${problem.code}`)).toEqual(['1 nameIsAsked'])
  })
})

describe('chance', () => {
  const DICE = ['[set: Roll = random 1 6]', 'You rolled {Roll}.', '[set: Roll = random 1 6]', 'Then {Roll}.']

  it('draws between the two numbers, and writes back as imported', () => {
    const story = storyFromText(['[counter: Roll]', ...DICE])
    expect(exportText(story.project, story.chapters, { declareDecisions: false })).toContain('[set: Roll = random 1 6]')
    for (let game = 0; game < 30; game++) {
      const runtime = new StoryRuntime(story)
      runtime.start()
      const roll = Number(/\d+/.exec(shownText(runtime))![0])
      expect(roll >= 1 && roll <= 6).toBe(true)
    }
  })

  it('draws again what it drew when the player goes back, and a save keeps the draws', () => {
    const story = storyFromText(['[counter: Roll]', ...DICE])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    const second = shownText(runtime)
    runtime.back()
    runtime.next()
    expect(shownText(runtime)).toBe(second)

    runtime.back()
    const save = toSave(story, runtime.exportState(), '2026-11-04T10:00:00.000Z')
    expect(save.seed).toBeTypeOf('number')
    const resumed = new StoryRuntime(story)
    resumed.restoreState(stateFromSave(story, save))
    resumed.next()
    expect(shownText(resumed)).toBe(second)
  })

  it('needs two whole numbers, the second at least the first, and only for counters', () => {
    expect(problemsOf(['[counter: Roll]', '[set: Roll = random 6 1]', '[if: Roll is random 1 6]', '[end]'])).toEqual([
      '2 counterNeedsNumber Roll: random 6 1',
      '3 counterNeedsNumber Roll: random 1 6',
    ])
  })

  it('leaves no seed in saves of games that never draw', () => {
    const story = storyFromText(['Hello.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(toSave(story, runtime.exportState(), '2026-11-04T10:00:00.000Z')).not.toHaveProperty('seed')
  })
})
