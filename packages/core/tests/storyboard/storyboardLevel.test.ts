import { describe, expect, it } from 'vitest'
import {
  applyImport,
  blockOfContainer,
  createProject,
  flattenStoredNodes,
  locateNode,
  previewImport,
  stepNodes,
  storyboardLevel,
  type ChapterDocument,
  type LevelElement,
  type LevelLane,
  readingFlow,
  unreachableNodes,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-27T12:00:00.000Z'

function chapterOf(lines: string[]) {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
  const project = createProject({ name: 'Game', locale: 'en' }, environment)
  const preview = previewImport(lines.join('\n'), project, monospaceLayout)
  expect(preview.problems.filter(problem => problem.severity === 'error')).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null }, environment)
  return { project: applied.project, chapter: applied.chapters[0]! }
}

/** Elements as one compact string each, blocks with what their frame shows. */
function shown(elements: readonly LevelElement[]): string[] {
  return elements.map(element => element.kind === 'entry'
    ? element.entry.type === 'card'
      ? `${element.entry.number} ${element.entry.node.type === 'page' ? element.entry.node.text : 'choice'}`
      : `[${element.entry.node.type}: ${element.entry.text}]`
    : `block ${element.numbers} (${element.pageCount} pages${element.isCollapsed ? ', one card' : ''}): ${element.branches.map(lane => `${lane.text} → ${shown(lane.elements).join(' ') || '—'}`).join(' | ')}`)
}
const lanesShown = (lanes: readonly LevelLane[]) => lanes.map(lane => `${lane.text ?? 'chapter'}: ${shown(lane.elements).join(' / ')}`)
const pageTexts = (chapter: ChapterDocument) => flattenStoredNodes(chapter.nodes).flatMap(node => node.type === 'page' ? [node.text] : [])
const idOf = (chapter: ChapterDocument, text: string) => flattenStoredNodes(chapter.nodes).find(node => node.type === 'page' && node.text === text)!.id

const STORY = [
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
  'After.',
]

describe('storyboardLevel', () => {
  it('shows a condition as one block, its branches inside the frame while small', () => {
    const { project, chapter } = chapterOf(STORY)
    expect(lanesShown(storyboardLevel(chapter, project, null, { blockPageLimit: 5 })!.lanes)).toEqual([
      'chapter: 1 One. / 2 choice / block 3–4 (3 pages): if Answer is A → 3a Yes one. 4a Yes two. | else → 3b No one. / 5 After.',
    ])
  })

  it('shows a block holding more pages than the limit as one card', () => {
    const { project, chapter } = chapterOf(STORY)
    expect(shown(storyboardLevel(chapter, project, null, { blockPageLimit: 2 })!.lanes[0]!.elements)[2])
      .toBe('block 3–4 (3 pages, one card): if Answer is A → — | else → —')
  })

  it('shows the branches of a block entered as lanes, with the path to it', () => {
    const { project, chapter } = chapterOf(STORY)
    const condition = chapter.nodes.find(node => node.type === 'condition')!
    const level = storyboardLevel(chapter, project, condition.id, { blockPageLimit: 2 })!
    expect(level.path).toEqual([{ id: condition.id, kind: 'condition', text: 'if Answer is A' }])
    expect(lanesShown(level.lanes)).toEqual(['if Answer is A: 3a Yes one. / 4a Yes two.', 'else: 3b No one.'])
    expect(storyboardLevel(chapter, project, 'gone', { blockPageLimit: 2 })).toBeNull()
  })
})

describe('stepNodes', () => {
  it('moves side by side nodes one place, a block passing as one', () => {
    const { chapter } = chapterOf(STORY)
    const condition = chapter.nodes.find(node => node.type === 'condition')!
    expect(pageTexts(stepNodes(chapter, [idOf(chapter, 'One.')], 1, NOW))).toEqual(['One.', 'Yes one.', 'Yes two.', 'No one.', 'After.'])
    const blockForward = stepNodes(chapter, [condition.id], 1, NOW)
    expect(pageTexts(blockForward)).toEqual(['One.', 'After.', 'Yes one.', 'Yes two.', 'No one.'])
    expect(pageTexts(stepNodes(chapter, [idOf(chapter, 'After.')], -1, NOW))).toEqual(['One.', 'After.', 'Yes one.', 'Yes two.', 'No one.'])
  })

  it('takes nodes out of a block at the start or end of their branch', () => {
    const { chapter } = chapterOf(STORY)
    const condition = chapter.nodes.find(node => node.type === 'condition')!
    const outBefore = stepNodes(chapter, [idOf(chapter, 'Yes one.')], -1, NOW)
    expect(locateNode(outBefore, idOf(chapter, 'Yes one.'))).toEqual({ containerId: null, index: 2 })
    const outAfter = stepNodes(chapter, [idOf(chapter, 'No one.')], 1, NOW)
    expect(locateNode(outAfter, idOf(chapter, 'No one.'))).toEqual({ containerId: null, index: 3 })
    expect(blockOfContainer(chapter, condition.branches[1]!.id)).toBe(condition.id)
  })

  it('leaves the chapter as it is at its ends, or for nodes from different lists', () => {
    const { chapter } = chapterOf(STORY)
    expect(stepNodes(chapter, [idOf(chapter, 'One.')], -1, NOW)).toBe(chapter)
    expect(stepNodes(chapter, [idOf(chapter, 'One.'), idOf(chapter, 'Yes one.')], 1, NOW)).toBe(chapter)
  })
})

describe('endings in the storyboard', () => {
  const lines = [
    '[choice: Door]',
    '> Open it',
    '> Walk away',
    '[if: Door is A]',
    'The room was empty.',
    '[ending: Empty]',
    '[else]',
    'You went home.',
    '[ending: Home]',
    '[end]',
    'Nobody reads this.',
  ]

  it('marks blocks whose routes end, and what comes after a block they all end in', () => {
    const { project, chapter } = chapterOf(lines)
    const unreachableIds = new Set([...unreachableNodes([chapter.nodes])].map(node => node.id))
    const level = storyboardLevel(chapter, project, null, { blockPageLimit: 5, unreachableIds })!
    const [, block, after] = level.lanes[0]!.elements
    expect(block?.kind === 'block' && [block.endingRouteCount, block.allRoutesEnd, block.isUnreachable]).toEqual([2, true, false])
    expect(after?.isUnreachable).toBe(true)
    expect(level.lanes[0]!.stops).toBe(true)

    const inside = storyboardLevel(chapter, project, block!.id, { blockPageLimit: 5, unreachableIds })!
    expect(inside.lanes.map(lane => lane.stops)).toEqual([true, true])
  })

  it('counts the pages a block holds that no path reaches', () => {
    const withDeadPage = [...lines.slice(0, 6), 'Lost after the ending.', ...lines.slice(6)]
    const { project, chapter } = chapterOf(withDeadPage)
    const unreachableIds = new Set([...unreachableNodes([chapter.nodes])].map(node => node.id))
    const level = storyboardLevel(chapter, project, null, { blockPageLimit: 1, unreachableIds })!
    const [, block] = level.lanes[0]!.elements
    expect(block?.kind === 'block' && [block.isCollapsed, block.unreachablePageCount]).toEqual([true, 1])
  })

  it('lets a block without else be passed by', () => {
    const { project, chapter } = chapterOf(lines.filter(line => line !== '[else]' && line !== 'You went home.' && line !== '[ending: Home]'))
    const level = storyboardLevel(chapter, project, null, { blockPageLimit: 5, unreachableIds: new Set([...unreachableNodes([chapter.nodes])].map(node => node.id)) })!
    const [, block, after] = level.lanes[0]!.elements
    expect(block?.kind === 'block' && [block.endingRouteCount, block.allRoutesEnd]).toEqual([1, false])
    expect(after?.isUnreachable).toBe(false)
  })
})

describe('loops in the storyboard', () => {
  const lines = ['One.', '[loop]', 'Again.', '[if: Answer is A]', '[break]', '[end]', '[choice: Answer]', '> Yes', '> No', '[end]', 'After.', '[loop]', 'For ever.', '[end]']

  it('show as blocks, entered as one lane, which the keyboard leaves at its ends', () => {
    const { project, chapter } = chapterOf(lines)
    const { unreachable, endlessLoops } = readingFlow([chapter.nodes])
    const options = { blockPageLimit: 5, unreachableIds: new Set([...unreachable].map(node => node.id)), endlessLoopIds: new Set([...endlessLoops].map(node => node.id)) }
    const level = storyboardLevel(chapter, project, null, options)!
    const [, loop, , endless] = level.lanes[0]!.elements
    expect(loop?.kind === 'block' && [loop.node.type, loop.pageCount, loop.isEndless, loop.numbers]).toEqual(['loop', 2, false, '2–3'])
    expect(endless?.kind === 'block' && endless.isEndless).toBe(true)

    const inside = storyboardLevel(chapter, project, loop!.id, options)!
    expect(inside.path).toEqual([{ id: loop!.id, kind: 'loop', text: 'loop' }])
    expect(lanesShown(inside.lanes)).toEqual(['repeats until a break: 2 Again. / block  (0 pages): if Answer is A → [break: out of the loop] / 3 choice'])

    const again = idOf(chapter, 'Again.')
    expect(blockOfContainer(chapter, locateNode(chapter, again)!.containerId)).toBe(loop!.id)
    expect(pageTexts(stepNodes(chapter, [again], -1, NOW))).toEqual(['One.', 'Again.', 'After.', 'For ever.'])
    expect(locateNode(stepNodes(chapter, [again], -1, NOW), again)!.containerId).toBe(null)
  })
})
