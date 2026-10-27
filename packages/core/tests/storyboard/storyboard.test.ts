import { describe, expect, it } from 'vitest'
import {
  applyImport,
  CHAPTER_START,
  createProject,
  flattenStoredNodes,
  moveNodes,
  previewImport,
  removeNodes,
  storyboardEntries,
  type ChapterDocument,
  type ProjectDocument,
  type StoryboardEntry,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-26T12:00:00.000Z'

function chapterOf(lines: string[]): { project: ProjectDocument; chapter: ChapterDocument } {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
  const project = createProject({ name: 'Game', locale: 'en' }, environment)
  const preview = previewImport(lines.join('\n'), project, monospaceLayout)
  expect(preview.problems).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null }, environment)
  return { project: applied.project, chapter: applied.chapters[0]! }
}

/** Entries as one compact string each: what the storyboard shows. */
function shown(entries: StoryboardEntry[]): string[] {
  return entries.map(entry => {
    switch (entry.type) {
      case 'card':
        return entry.node.type === 'page' ? `${entry.number} ${entry.node.text}` : `${entry.number} choice`
      case 'marker':
        return `[${entry.node.type}: ${entry.text}]`
      case 'conditionStart':
        return `if ${entry.text}`
      case 'branchStart':
        return entry.text
      case 'conditionEnd':
        return 'end'
      case 'loopStart':
        return 'loop'
      case 'loopEnd':
        return 'end loop'
    }
  })
}

const pageTexts = (chapter: ChapterDocument) => flattenStoredNodes(chapter.nodes).flatMap(node => node.type === 'page' ? [node.text] : [])

const BRANCHING = [
  'One.',
  '[choice: Answer]',
  '> Yes',
  '> No',
  '[if: Answer is A]',
  'Yes one.',
  'Yes two.',
  '[else]',
  'No one.',
  '[end]',
  '[remember: After]',
  'After.',
  '[ending: Over]',
]

describe('storyboardEntries', () => {
  it('numbers cards, lettering branch pages, the main line resuming after the longest branch', () => {
    const { project, chapter } = chapterOf(BRANCHING)
    expect(shown(storyboardEntries(chapter, project))).toEqual([
      '1 One.',
      '2 choice',
      'if Answer is A',
      '3a Yes one.',
      '4a Yes two.',
      'else',
      '3b No one.',
      'end',
      '[remember: After]',
      '5 After.',
      '[ending: Over]',
    ])
  })

  it('letters nested branches after their parent, and shows staging and assignments as markers', () => {
    const { project, chapter } = chapterOf([
      '[decision: Mood = Calm | Angry]',
      '[decision: Weather = Sun | Rain]',
      '[if: Mood is Calm]',
      '[set: Weather = Rain]',
      '[if: Weather is Rain or Mood is not Angry]',
      'Wet.',
      '[end]',
      '[end]',
      '[bg: street]',
      '[choice: Mood]',
      '> Stay calm = Calm',
      '> Shout = Angry',
    ])
    expect(shown(storyboardEntries(chapter, project))).toEqual([
      'if Mood is Calm',
      '[set: Weather = Rain]',
      'if Weather is Rain or Mood is not Angry',
      '1aa Wet.',
      'end',
      'end',
      '[stage: bg: street]',
      '2 choice',
    ])
  })

  it('numbers the pages of a loop on the main line, between its opening and its end', () => {
    const { project, chapter } = chapterOf(['One.', '[loop]', 'Again.', '[break]', '[end]', 'After.'])
    expect(shown(storyboardEntries(chapter, project))).toEqual(['1 One.', 'loop', '2 Again.', '[break: out of the loop]', 'end loop', '3 After.'])
  })

})

describe('moveNodes', () => {
  const pagesInOrder = (lines: string[], move: (chapter: ChapterDocument, ids: (text: string) => string) => ChapterDocument) => {
    const { chapter } = chapterOf(lines)
    const ids = (text: string) => flattenStoredNodes(chapter.nodes).find(node => node.type === 'page' && node.text === text)!.id
    return pageTexts(move(chapter, ids))
  }

  it('reorders pages, several at once keeping their order', () => {
    expect(pagesInOrder(['A.', 'B.', 'C.', 'D.'], (chapter, ids) => moveNodes(chapter, [ids('D.'), ids('B.')], CHAPTER_START, NOW)))
      .toEqual(['B.', 'D.', 'A.', 'C.'])
    expect(pagesInOrder(['A.', 'B.', 'C.', 'D.'], (chapter, ids) => moveNodes(chapter, [ids('A.')], { containerId: null, index: 3 }, NOW)))
      .toEqual(['B.', 'C.', 'A.', 'D.'])
  })

  it('moves pages into and out of branches', () => {
    const { chapter } = chapterOf(BRANCHING)
    const ids = (text: string) => flattenStoredNodes(chapter.nodes).find(node => node.type === 'page' && node.text === text)!.id
    const condition = chapter.nodes.find(node => node.type === 'condition')!

    const intoBranch = moveNodes(chapter, [ids('One.')], { containerId: condition.branches[1]!.id, index: 1 }, NOW)
    const intoCondition = intoBranch.nodes.find(node => node.type === 'condition')!
    expect(intoCondition.branches[1]!.nodes.flatMap(node => node.type === 'page' ? [node.text] : [])).toEqual(['No one.', 'One.'])

    const outOfBranch = moveNodes(chapter, [ids('Yes two.')], CHAPTER_START, NOW)
    expect(pageTexts(outOfBranch)).toEqual(['Yes two.', 'One.', 'Yes one.', 'No one.', 'After.'])
    expect(outOfBranch.updatedAt).toBe(NOW)
  })

  it('moves a condition with everything in it, but never inside itself', () => {
    const { chapter } = chapterOf(BRANCHING)
    const condition = chapter.nodes.find(node => node.type === 'condition')!
    expect(pageTexts(moveNodes(chapter, [condition.id], CHAPTER_START, NOW))).toEqual(['Yes one.', 'Yes two.', 'No one.', 'One.', 'After.'])
    expect(moveNodes(chapter, [condition.id], { containerId: condition.branches[1]!.id, index: 0 }, NOW)).toBe(chapter)
  })

  it('moves pages into and out of a loop, and the loop as a whole, never inside itself', () => {
    const { chapter } = chapterOf(['One.', '[loop]', 'Again.', '[break]', '[end]', 'After.'])
    const ids = (text: string) => flattenStoredNodes(chapter.nodes).find(node => node.type === 'page' && node.text === text)!.id
    const loop = chapter.nodes.find(node => node.type === 'loop')!

    const intoLoop = moveNodes(chapter, [ids('One.')], { containerId: loop.id, index: 0 }, NOW)
    const loopAfter = intoLoop.nodes.find(node => node.type === 'loop')!
    expect(loopAfter.nodes.map(node => node.type === 'page' ? node.text : node.type)).toEqual(['One.', 'Again.', 'break'])
    expect(pageTexts(moveNodes(chapter, [loop.id], { containerId: null, index: 3 }, NOW))).toEqual(['One.', 'After.', 'Again.'])
    expect(moveNodes(chapter, [loop.id], { containerId: loop.id, index: 0 }, NOW)).toBe(chapter)
    const breakId = loop.nodes.find(node => node.type === 'break')!.id
    expect(moveNodes(chapter, [breakId], CHAPTER_START, NOW)).toBe(chapter)
    expect(moveNodes(chapter, [breakId], { containerId: loop.id, index: 0 }, NOW)).not.toBe(chapter)
    expect(pageTexts(removeNodes(chapter, [ids('Again.')], NOW))).toEqual(['One.', 'After.'])
  })

  it('removes nodes, wherever they are', () => {
    const { chapter } = chapterOf(BRANCHING)
    const ids = flattenStoredNodes(chapter.nodes).filter(node => node.type === 'page' && ['One.', 'No one.'].includes(node.text)).map(node => node.id)
    expect(pageTexts(removeNodes(chapter, ids, NOW))).toEqual(['Yes one.', 'Yes two.', 'After.'])
  })
})

describe('drop slots', () => {
  it('put dropped nodes right after the entry, inside a branch after its opening entries', () => {
    const { project, chapter } = chapterOf(BRANCHING)
    const entries = storyboardEntries(chapter, project)
    const condition = chapter.nodes.find(node => node.type === 'condition')!
    const slotAfter = (text: string) => entries[shown(entries).indexOf(text)]!.slot

    expect(slotAfter('1 One.')).toEqual({ containerId: null, index: 1 })
    expect(slotAfter('if Answer is A')).toEqual({ containerId: condition.branches[0]!.id, index: 0 })
    expect(slotAfter('4a Yes two.')).toEqual({ containerId: condition.branches[0]!.id, index: 2 })
    expect(slotAfter('else')).toEqual({ containerId: condition.branches[1]!.id, index: 0 })
    expect(slotAfter('end')).toEqual({ containerId: null, index: 3 })
  })
})
