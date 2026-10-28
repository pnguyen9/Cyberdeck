import { describe, expect, it } from 'vitest'
import {
  checkReferences,
  createProject,
  exportText,
  findPathTo,
  flattenStoredNodes,
  importText,
  parseSave,
  playerFormatVersion,
  projectWithoutStory,
  StoryRuntime,
  stateFromSave,
  toSave,
} from '../../src/index'
import { pageWithNames } from '../../src/format/askedNames'
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

describe('names the player gives', () => {
  it('stop the story to be asked, then stand wherever the text writes them', () => {
    const story = storyFromText(['[ask: Hero = Alex]', '— {Hero}: I am {Hero}.', '> No, {Hero}.'.replace('> ', ''), '[choice: Reply]', '> Fine, {Hero} = Fine'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(runtime.snapshot.step.type).toBe('ask')
    runtime.answer('  Morgan   le   Fay and more  ')
    expect(shownText(runtime)).toBe('I am Morgan le Fa.')
    expect(runtime.withNames(story.project.characters[0]!.name)).toBe('Morgan le Fa')
    runtime.next()
    expect(shownText(runtime)).toBe('No, Morgan le Fa.')
    runtime.next()
    const step = runtime.snapshot.step
    expect(step.type === 'choice' && step.choice.options.map(option => option.text)).toEqual(['Fine, Morgan le Fa'])
  })

  it('keep their default when the player gives none, and go back with the story', () => {
    const runtime = new StoryRuntime(storyFromText(['[ask: Hero = Alex]', 'Hi {Hero}.']))
    runtime.start()
    runtime.answer('   ')
    expect(shownText(runtime)).toBe('Hi Alex.')
    runtime.back()
    expect(runtime.snapshot.step.type).toBe('ask')
    runtime.answer('Sam')
    expect(shownText(runtime)).toBe('Hi Sam.')
  })

  it('move the styles and inline commands of the page with the text', () => {
    const story = storyFromText(['[ask: Hero]', 'Then {Hero} [style: italic]ran[style: none] [wait: 1]away.'])
    const page = flattenStoredNodes(story.chapters[0]!.nodes).find(node => node.type === 'page')!
    const shown = pageWithNames(page, () => 'Jo')
    expect(shown.text).toBe('Then Jo ran away.')
    expect(shown.styles?.map(span => shown.text.slice(span.start, span.end))).toEqual(['ran'])
    expect(shown.inlineCommands.map(command => shown.text.slice(command.offset))).toEqual(['away.'])
  })

  it('are cut into pages as if as long as the longest name allowed', () => {
    // 40 characters a line, 2 lines: with the name as twelve letters, the paragraph needs a second page.
    const text = 'Somebody called {Hero} again, louder this time, from the far end of the street.'
    expect(importText(`[ask: Hero]\n${text}`, { layout: monospaceLayout, locale: 'en' }).chapters[0]!.nodes.filter(node => node.type === 'page')).toHaveLength(2)
  })

  it('are saved by name', () => {
    const story = storyFromText(['[ask: Hero = Alex]', 'Hi {Hero}.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.answer('Sam')
    const save = toSave(story, runtime.exportState(), '2026-10-28T10:00:00.000Z')
    expect(save.names).toEqual({ Hero: 'Sam' })
    expect(parseSave({ ...save, names: { Hero: 3 } })).toBeNull()
    const resumed = new StoryRuntime(story)
    resumed.restoreState(stateFromSave(story, save))
    expect(shownText(resumed)).toBe('Hi Sam.')
  })

  it('are reported when misused', () => {
    expect(problemsOf(['[ask: Two Words]', '[ask: Hero = A name far too long]', 'Hello {Nobody}.'])).toEqual([
      '1 invalidAsk Two Words',
      '2 invalidAsk Hero = A name far too long',
      '3 unknownAskedName Nobody',
    ])
  })

  it('are passed with their default by the path finder', () => {
    const story = storyFromText(['[ask: Hero]', 'Hi {Hero}.', 'Later.'])
    const later = flattenStoredNodes(story.chapters[0]!.nodes).filter(node => node.type === 'page')[1]!
    expect(findPathTo(story, later.id)?.optionIds).toEqual([])
  })
})

describe('timed choices', () => {
  const TIMED = ['[choice: Answer 10s]', '> Yes = Yes', '> No = No', '> … = Silent [timeout]', '[if: Answer is Silent]', 'You said nothing.', '[end]']

  it('keep the option taken when time runs out, which is never shown, and write back as imported', () => {
    const story = storyFromText(TIMED)
    const choice = flattenStoredNodes(story.chapters[0]!.nodes).find(node => node.type === 'choice')!
    expect(choice.timeLimitMs).toBe(10_000)
    expect(choice.options.map(option => option.timeout === true)).toEqual([false, false, true])
    expect(exportText(story.project, story.chapters, { declareDecisions: false })).toContain('[choice: Answer 10s]\n> Yes = Yes\n> No = No\n> … = Silent [timeout]\n')

    const runtime = new StoryRuntime(story)
    runtime.start()
    const timeout = choice.options.find(option => option.timeout === true)!
    runtime.choose(timeout.id)
    expect(shownText(runtime)).toBe('You said nothing.')
  })

  it('are skipped when only the option of the timeout is left', () => {
    const runtime = new StoryRuntime(storyFromText(['[choice: Answer 5s]', '> Yes = Yes [if: Answer is Yes]', '> … = Silent [timeout]', 'After.']))
    runtime.start()
    expect(shownText(runtime)).toBe('After.')
  })

  it('need exactly one option for the timeout', () => {
    expect(problemsOf(['[choice: A 5s]', '> Yes', '[choice: B]', '> Yes', '> No [timeout]', '[choice: C 5s]', '> Yes', '> No [timeout]', '> Maybe [timeout]', '[timeout]'])).toEqual([
      '1 timedChoiceWithoutTimeout A',
      '5 timeoutWithoutTime B',
      '9 severalTimeouts C',
      '10 timeoutOutsideOption',
    ])
  })

  it('make a game for Datajack 1.3 or later, as names asked for do', () => {
    const timed = storyFromText(TIMED)
    expect(playerFormatVersion(timed.project, timed.chapters)).toBe('1.4')
    const named = storyFromText(['[ask: Hero]', 'Hi {Hero}.'])
    expect(playerFormatVersion(named.project, named.chapters)).toBe('1.4')
  })
})

describe('a project made from another for a translation', () => {
  it('keeps what a text cannot hold, and none of the story', () => {
    const story = storyFromText(['[decision: Mood = Calm | Angry]', '[counter: Trust]', '[enter: Marie left]', '— Marie: Hello.', '[ending: Gone]'])
    const source = { ...story.project, chapterOrder: story.chapters.map(chapter => chapter.id), css: '.ghost { color: red }', characters: story.project.characters.map(character => ({ ...character, drawnFacing: 'left' as const })) }
    const copy = projectWithoutStory(source, { name: ' Bonjour ', locale: 'fr' }, { createId: () => 'copy', now: () => '2026-10-28T10:00:00.000Z' })
    expect([copy.id, copy.name, copy.locale, copy.createdAt]).toEqual(['copy', 'Bonjour', 'fr', '2026-10-28T10:00:00.000Z'])
    expect([copy.chapterOrder, copy.sceneOrder, copy.decisions, copy.counters, copy.endings, copy.memories, copy.styles]).toEqual([[], [], [], [], [], [], []])
    expect(copy.characters).toEqual(source.characters)
    expect(copy.css).toBe(source.css)
    expect(copy.positions).toEqual(createProject({ name: 'x', locale: 'en' }).positions)
  })
})
