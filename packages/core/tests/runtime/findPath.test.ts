import { describe, expect, it } from 'vitest'
import { findPathTo, flattenStoredNodes, StoryRuntime, type PlayableStory } from '../../src/index'
import { storyFromText } from './storyFromText'

const pageId = (story: PlayableStory, text: string) =>
  story.chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes)).find(node => node.type === 'page' && node.text === text)!.id

const optionText = (story: PlayableStory, optionId: string) => story.chapters
  .flatMap(chapter => flattenStoredNodes(chapter.nodes))
  .flatMap(node => node.type === 'choice' ? node.options : [])
  .find(option => option.id === optionId)?.text

const BRANCHING = [
  '[bg: street]',
  'Start.',
  '[choice: Door]',
  '> Open = Open',
  '> Leave = Leave',
  '[if: Door is Open]',
  '[enter: marie]',
  'Inside.',
  '[choice: Talk]',
  '> Ask = Ask',
  '> Wait = Wait',
  '[if: Talk is Wait]',
  '[marie: smile]',
  'She smiles.',
  '[end]',
  '[else]',
  'Outside.',
  '[end]',
  'The end.',
]

describe('findPathTo', () => {
  it('finds the options that lead to a page, and the stage there', () => {
    const story = storyFromText(BRANCHING)
    const found = findPathTo(story, pageId(story, 'She smiles.'))

    expect(found?.optionIds.map(optionId => optionText(story, optionId))).toEqual(['Open', 'Wait'])
    const runtime = new StoryRuntime(story)
    runtime.restoreState(found!.state)
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('She smiles.')
    expect(runtime.snapshot.stage.characters).toHaveLength(1)
    expect(runtime.snapshot.stage.backgroundId).not.toBeNull()
  })

  it('reaches a page without any choice on the way at once', () => {
    const story = storyFromText(BRANCHING)
    expect(findPathTo(story, pageId(story, 'Start.'))?.optionIds).toEqual([])
  })

  it('ends on stories that loop, taking the shortest way out', () => {
    const story = storyFromText(['[loop]', '[choice: Loop]', '> Again = Again', '> Out = Out', '[if: Loop is Out]', '[break]', '[end]', '[end]', 'Out.'])
    expect(findPathTo(story, pageId(story, 'Out.'))?.optionIds).toHaveLength(1)
    expect(findPathTo(story, 'nowhere')).toBeNull()
  })

  it('reaches pages that need memories when given them', () => {
    const story = storyFromText(['[if: remembered Secret]', 'Hidden.', '[end]', 'Shown.', '[remember: Secret]'])
    expect(findPathTo(story, pageId(story, 'Hidden.'))).toBeNull()
    expect(findPathTo(story, pageId(story, 'Hidden.'), { memoryIds: story.project.memories.map(memory => memory.id), endingIds: [] })).not.toBeNull()
  })

  it('reaches the last page of a long story with many choices', () => {
    const lines: string[] = []
    for (let choice = 0; choice < 50; choice++) {
      lines.push(`[choice: Pick${choice}]`, '> One', '> Two', ...Array.from({ length: 60 }, (_, page) => `Page ${choice}-${page}.`))
    }
    lines.push('The very end.')
    const story = storyFromText(lines)
    expect(findPathTo(story, pageId(story, 'The very end.'))?.optionIds).toHaveLength(50)
  })

  it('finds pages opened by a memory gained on the way', () => {
    const story = storyFromText([
      '[choice: A]', '> One', '> Two',
      '[if: A is B]', '[remember: Secret]', '[end]',
      '[set: A = A]',
      '[choice: B]', '> Go',
      '[if: remembered Secret]', 'Hidden.', '[end]',
      'Shown.',
    ])
    expect(findPathTo(story, pageId(story, 'Hidden.'))).not.toBeNull()
  })
})
