import { describe, expect, it } from 'vitest'
import { checkReferences, exportText, importText, recordMemories, StoryRuntime } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

describe('forgetting', () => {
  it('takes a memory away, for this game and for the profile, and writes back as imported', () => {
    const story = storyFromText(['[remember: Found the key]', 'You have the key.', '[forget: Found the key]', '[if: remembered Found the key]', 'Still here.', '[else]', 'Gone.', '[end]'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    expect(runtime.snapshot.step.type === 'page' ? runtime.snapshot.step.page.text : '').toBe('Gone.')
    expect([runtime.memoryIds, runtime.forgottenMemoryIds.length]).toEqual([[], 1])
    const progress = { memoryIds: [runtime.forgottenMemoryIds[0]!, 'other'] }
    expect(recordMemories(progress as never, runtime.memoryIds, runtime.forgottenMemoryIds).memoryIds).toEqual(['other'])
    expect(exportText(story.project, story.chapters, { declareDecisions: false })).toContain('[forget: Found the key]')
  })

  it('is not undone by going back, as remembering is not', () => {
    const story = storyFromText(['[remember: Seen]', 'One.', '[forget: Seen]', 'Two.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    runtime.back()
    expect(runtime.memoryIds).toEqual([])
  })

  it('reports a memory forgotten that nothing remembers', () => {
    const imported = importText('[forget: Fuond the key]\nHello.', { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported).map(problem => `${problem.code} ${problem.subject}`)).toEqual(['unknownMemory Fuond the key'])
  })
})

describe('format 2.0', () => {
  it('reads every earlier version, and none newer', async () => {
    const { isSupportedFormatVersion } = await import('../../src/index')
    expect(['1.0', '1.1', '1.5', '2.0', '2.1', '2.2', '3.0', '3.1', '4.0', '0.9', 'two'].map(isSupportedFormatVersion)).toEqual([true, true, true, true, true, true, true, false, false, false, false])
  })
})
