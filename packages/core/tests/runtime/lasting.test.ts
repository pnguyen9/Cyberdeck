import { describe, expect, it } from 'vitest'
import { emptyProgress, exportText, parseProgress, recordLasting, StoryRuntime } from '../../src/index'
import { storyFromText } from './storyFromText'

const STORY = ['[counter lasting: Coins = 0]', '[decision multi lasting: Bag = Key | Lamp]', '[counter: Day]', 'You have {Coins} coins and {Bag}.', '[add: Coins 10]', '[set: Bag = Key]', '[add: Day]', 'Day {Day}.']

describe('lasting counters and decisions', () => {
  it('start a new game with what the last one left, and only they do', () => {
    const story = storyFromText(STORY)
    const first = new StoryRuntime(story)
    first.start()
    first.next()
    const kept = recordLasting(emptyProgress(story), first.lastingValues)
    expect(Object.values(kept.lasting!.counters)).toEqual([10])

    const second = new StoryRuntime(story)
    second.useLasting(kept.lasting!)
    second.start()
    const step = second.snapshot.step
    expect(step.type === 'page' ? step.page.text : '').toBe('You have 10 coins and Key.')
    second.next()
    expect(second.snapshot.step.type === 'page' ? second.snapshot.step.page.text : '').toBe('Day 1.')
  })

  it('are undone by going back, as any value is', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    runtime.back()
    expect(runtime.lastingValues).toEqual({ decisions: {}, counters: {} })
  })

  it('are written back as declared, and read back from a progress file field by field', () => {
    const story = storyFromText(STORY)
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[counter lasting: Coins = 0]')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[decision multi lasting: Bag = Key | Lamp]')
    const read = parseProgress({ ...emptyProgress(story), lasting: { decisions: { bag: ['key', 3] , ok: ['x'] }, counters: { coins: 4, bad: 1.5 } } })
    expect(read?.lasting).toEqual({ decisions: { ok: ['x'] }, counters: { coins: 4 } })
  })
})
