import { describe, expect, it } from 'vitest'
import { checkReferences, exportText, importText, isStageLocked, playerFormatVersion, stateFromSave, StoryRuntime, toSave } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

/** Each page's locks, as the stage holds them on it: game mode, then no going back. */
function locksOf(lines: string[]): string[] {
  const runtime = new StoryRuntime(storyFromText(lines))
  runtime.start()
  const locks: string[] = []
  while (runtime.snapshot.step.type === 'page') {
    locks.push(`${runtime.snapshot.stage.gameMode ?? '-'} ${runtime.snapshot.stage.noGoingBack ?? '-'}`)
    runtime.next()
  }
  return locks
}

describe('parts where the player cannot go back', () => {
  it('a game, from [game mode] to [game mode: off]; forward only, from [no going back]; each its own', () => {
    expect(locksOf(['Before.', '[no going back: until an ending]', 'A promise.', '[game mode]', 'Dealing.', '[game mode: off]', 'Still forward.', '[no going back: off]', 'Free again.']))
      .toEqual(['- -', '- untilEnding', 'always untilEnding', '- untilEnding', '- -'])
  })

  it('locks until an ending only while no ending of the game was reached', () => {
    expect([
      isStageLocked({ gameMode: null, noGoingBack: 'always' }, true),
      isStageLocked({ gameMode: null, noGoingBack: 'untilEnding' }, false),
      isStageLocked({ gameMode: null, noGoingBack: 'untilEnding' }, true),
      isStageLocked({ gameMode: 'untilEnding', noGoingBack: 'always' }, true),
      isStageLocked({ gameMode: null, noGoingBack: null }, false),
    ]).toEqual([true, true, false, true, false])
  })

  it('is kept by saves, written back as written, and needs Datajack 3.2', () => {
    const lines = ['[no going back: until an ending]', '[game mode]', 'Dealing.', '[game mode: off]', '[no going back: off]', 'After.']
    const story = storyFromText(lines)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const save = toSave(story, runtime.exportState(), '2026-11-11T10:00:00.000Z')
    expect([save.stage.game, save.stage.locked]).toEqual(['always', 'untilEnding'])
    const restored = stateFromSave(story, save).stage
    expect([restored.gameMode, restored.noGoingBack]).toEqual(['always', 'untilEnding'])
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(['[no going back: until an ending]', '[game mode]', '[game mode: off]', '[no going back: off]'].map(tag => written.includes(tag))).toEqual([true, true, true, true])
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.2')
  })

  it('takes on, off, until an ending, or nothing', () => {
    const imported = importText(['[game mode: on]', 'One.', '[no going back: Until an  ending]', 'Two.', '[game mode: maybe]', 'Three.'].join('\n'), { layout: monospaceLayout, locale: 'en' })
    const problems = [...imported.problems, ...checkReferences(imported)].map(problem => `${problem.code} ${problem.line}`)
    expect(problems).toEqual(['invalidStageDirective 5'])
  })
})
