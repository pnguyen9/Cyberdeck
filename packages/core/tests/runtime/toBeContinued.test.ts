import { describe, expect, it } from 'vitest'
import { exportText, playerFormatVersion, stateFromSave, StoryRuntime, toSave } from '../../src/index'
import { storyFromText } from './storyFromText'

const STORY = [
  '[to be continued: The story goes on in the next update.]',
  '[decision: Route = Marie | Jules]',
  '[choice: Route]',
  '> Marie = Marie',
  '> Jules = Jules',
  '[if: Route is Marie]',
  '[to be continued: Marie’s story, too, goes on.]',
  'With Marie.',
  '[else]',
  'With Jules.',
  '[end]',
  'Later.',
]

describe('what a game says on running out of chapters', () => {
  it('is the words the story last gave, those of the route taken, kept by a save', () => {
    const story = storyFromText(STORY)
    const continuedAfter = (option: number) => {
      const runtime = new StoryRuntime(story)
      runtime.start()
      runtime.choose(story.chapters[0]!.nodes.flatMap(node => node.type === 'choice' ? node.options : [])[option]!.id)
      return runtime
    }
    const marie = continuedAfter(0)
    expect(marie.snapshot.stage.continuedText).toBe('Marie’s story, too, goes on.')
    expect(continuedAfter(1).snapshot.stage.continuedText).toBe('The story goes on in the next update.')

    const save = toSave(story, marie.exportState(), '2026-11-10T10:00:00.000Z')
    expect(save.stage.continued).toBe('Marie’s story, too, goes on.')
    expect(stateFromSave(story, save).stage.continuedText).toBe('Marie’s story, too, goes on.')
  })

  it('writes back as written, and needs Datajack 2.1', () => {
    const story = storyFromText(STORY)
    const written = exportText(story.project, story.chapters, { declareDecisions: false })
    expect(written).toContain('[to be continued: The story goes on in the next update.]')
    expect(written).toContain('[to be continued: Marie’s story, too, goes on.]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })

  it('goes back to the default with none', () => {
    const runtime = new StoryRuntime(storyFromText(['[to be continued: Soon.]', 'One.', '[to be continued: none]', 'Two.']))
    runtime.start()
    expect(runtime.snapshot.stage.continuedText).toBe('Soon.')
    runtime.next()
    expect(runtime.snapshot.stage.continuedText).toBeNull()
  })
})
