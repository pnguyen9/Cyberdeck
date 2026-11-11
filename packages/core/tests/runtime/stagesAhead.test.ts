import { describe, expect, it } from 'vitest'
import { stagesAhead, StoryRuntime } from '../../src/index'
import { storyFromText } from './storyFromText'

describe('stages ahead', () => {
  it('follows the next stops, every option of a choice, nearest first, as far as it is asked', () => {
    const story = storyFromText([
      '[bg: hall]', 'In the hall.', '[enter: marie]', 'Marie comes in.',
      '[choice: Way]', '> Park = Park', '> Street = Street',
      '[if: Way is Park]', '[bg: park]', 'Trees.', '[else]', '[bg: street]', 'Cars.', '[end]',
      '[bg: home]', 'Home.',
    ])
    const backgroundName = (backgroundId: string | null) => story.project.backgrounds.find(background => background.id === backgroundId)?.name ?? null
    const runtime = new StoryRuntime(story)
    runtime.start(0)
    const memory = { memoryIds: [], endingIds: [] }

    const stages = stagesAhead(story, runtime.exportState(), memory)
    expect(stages.map(stage => [backgroundName(stage.backgroundId), stage.characters.length])).toEqual([
      ['hall', 1],
      ['hall', 1],
      ['park', 1],
      ['street', 1],
      // Each path after the choice goes home, then to the end.
      ['home', 1],
      ['home', 1],
      ['home', 1],
      ['home', 1],
    ])
    expect(stagesAhead(story, runtime.exportState(), memory, 3)).toHaveLength(3)
    // The playthrough itself goes on untouched.
    expect(runtime.snapshot.step.type).toBe('page')
    expect(backgroundName(runtime.snapshot.stage.backgroundId)).toBe('hall')
  })
})
