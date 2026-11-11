import { describe, expect, it } from 'vitest'
import { checkReferences, exportText, importText, playerFormatVersion, stateFromSave, StoryRuntime, toSave } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

describe('a part played as a game', () => {
  const lines = ['Before.', '[game mode]', 'Dealing.', 'Your turn.', '[game mode: off]', 'After.']

  it('is on from [game mode] to [game mode: off], on the stage the player reads', () => {
    const story = storyFromText(lines)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const modes: boolean[] = []
    while (runtime.snapshot.step.type === 'page') {
      modes.push(runtime.snapshot.stage.gameMode)
      runtime.next()
    }
    expect(modes).toEqual([false, true, true, false])
  })

  it('is kept by saves, written back as written, and needs Datajack 3.2', () => {
    const story = storyFromText(lines)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    const save = toSave(story, runtime.exportState(), '2026-11-11T10:00:00.000Z')
    expect(save.stage.game).toBe(true)
    expect(stateFromSave(story, save).stage.gameMode).toBe(true)
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(['[game mode]', '[game mode: off]'].map(tag => written.includes(tag))).toEqual([true, true])
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.2')
  })

  it('takes on, off or nothing', () => {
    const imported = importText(['[game mode: on]', 'One.', '[game mode: maybe]', 'Two.'].join('\n'), { layout: monospaceLayout, locale: 'en' })
    const problems = [...imported.problems, ...checkReferences(imported)].map(problem => `${problem.code} ${problem.line}`)
    expect(problems).toEqual(['invalidStageDirective 3'])
  })
})
