import { describe, expect, it } from 'vitest'
import { StoryRuntime } from '../../src/runtime/storyRuntime'
import { storyFromText } from './storyFromText'

const STORY = [
  '# One',
  '[bg: street]',
  '— Marie: First.',
  '[choice: Answer]',
  '> Yes',
  '> No',
  '[if: Answer is A]',
  '— Marie: You said yes.',
  '[else]',
  '— Marie: You said no.',
  '[end]',
  '# Two',
  'Second chapter.',
  'The end.',
]

function chooseText(runtime: StoryRuntime, optionText: string) {
  const step = runtime.snapshot.step
  if (step.type !== 'choice') {
    throw new Error(`Expected a choice, got ${step.type}`)
  }
  const option = step.choice.options.find(candidate => candidate.text === optionText)
  runtime.choose(option!.id)
}

const currentText = (runtime: StoryRuntime) => {
  const step = runtime.snapshot.step
  return step.type === 'page' ? step.page.text : step.type
}

describe('backlog', () => {
  it('lists the pages read and the options picked before the current stop', () => {
    const runtime = new StoryRuntime(storyFromText(STORY))
    runtime.start()
    runtime.next()
    chooseText(runtime, 'Yes')
    runtime.next()

    expect(runtime.backlog().map(entry => entry.type === 'page' ? entry.page.text : `> ${entry.optionText}`))
      .toEqual(['First.', '> Yes', 'You said yes.'])
  })

  it('goes back to an entry, as many steps as needed', () => {
    const runtime = new StoryRuntime(storyFromText(STORY))
    runtime.start()
    runtime.next()
    chooseText(runtime, 'Yes')
    runtime.next()

    runtime.backTo(runtime.backlog()[0]!.stopIndex)
    expect(currentText(runtime)).toBe('First.')
    expect(runtime.backlog()).toEqual([])
  })
})

describe('exporting and restoring the state', () => {
  it('restores the page, decisions, stage and choices, and plays on identically', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    chooseText(runtime, 'No')
    const state = runtime.exportState()

    const restored = new StoryRuntime(story)
    expect(restored.restoreState(state)).toBe('exact')
    expect(currentText(restored)).toBe('You said no.')
    expect(restored.snapshot.decisions).toEqual(runtime.snapshot.decisions)
    expect(restored.snapshot.stage).toEqual(runtime.snapshot.stage)
    expect(restored.snapshot.choices).toEqual(runtime.snapshot.choices)

    restored.next()
    expect(currentText(restored)).toBe('Second chapter.')
  })

  it('restores a state saved on a choice', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    const restored = new StoryRuntime(story)
    restored.restoreState(runtime.exportState())
    expect(restored.snapshot.step.type).toBe('choice')
  })

  it('falls back to the start of the chapter when the page no longer exists, keeping decisions', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    chooseText(runtime, 'Yes')
    runtime.next()
    const state = { ...runtime.exportState(), page: { chapterId: story.chapters[1]!.id, nodeId: 'removed-page' } }

    const restored = new StoryRuntime(story)
    expect(restored.restoreState(state)).toBe('chapterStart')
    expect(currentText(restored)).toBe('Second chapter.')
    expect(restored.snapshot.decisions).toEqual(runtime.snapshot.decisions)
  })

  it('falls back to the start of the story when the chapter no longer exists', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const state = { ...runtime.exportState(), page: { chapterId: 'removed-chapter', nodeId: 'removed-page' } }

    const restored = new StoryRuntime(story)
    expect(restored.restoreState(state)).toBe('storyStart')
    expect(currentText(restored)).toBe('First.')
  })

  it('has nothing to go back to right after restoring', () => {
    const story = storyFromText(STORY)
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    const restored = new StoryRuntime(story)
    restored.restoreState(runtime.exportState())
    expect(restored.canGoBack).toBe(false)
  })

})
