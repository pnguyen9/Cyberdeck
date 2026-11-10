import { describe, expect, it } from 'vitest'
import { checkReferences, exportText, importText, indexNames, nameWarnings, playerFormatVersion, stateFromSave, StoryRuntime, storyFlow, toSave } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

const shownText = (runtime: StoryRuntime) => {
  const step = runtime.snapshot.step
  return step.type === 'page' ? step.page.text : step.type
}

/** The pages a story shows, read through to its end. */
function pagesOf(lines: string[]): string[] {
  const runtime = new StoryRuntime(storyFromText(lines))
  runtime.start()
  const pages: string[] = []
  while (runtime.snapshot.step.type === 'page' && pages.length < 50) {
    pages.push(shownText(runtime))
    runtime.next()
  }
  return pages
}

describe('a list', () => {
  it('holds values by place, from 1, given, tested and shown by a number or a counter', () => {
    expect(pagesOf([
      '[decision: Animal = cat | dog]',
      '[counter: Cell = 2]',
      '[list: Board = 3 × none]',
      '[set: Board 1 = cat]',
      '[set: Animal = dog]',
      '[set: Board Cell = {Animal}]',
      '[set: Board 3 = {Board 1}]',
      'Places: {Board 1}, {Board Cell}, {Board 3}; {Board size} in all.',
      '[if: Board Cell is dog and Board 3 is {Board 1}]',
      'Tested.',
      '[end]',
    ])).toEqual(['Places: cat, dog, cat; 3 in all.', 'Tested.'])
  })

  it('is a queue: added at the end, taken from the front into a counter, until empty', () => {
    expect(pagesOf([
      '[counter: Cell = 0]',
      '[list: Queue]',
      '[add: Queue = 4]',
      '[add: Queue = 7]',
      '[loop]',
      '[if: Queue size is 0]', '[break]', '[end]',
      '[take: Cell = first of Queue]',
      'Opened {Cell}, {Queue size} left.',
      '[end]',
    ])).toEqual(['Opened 4, 1 left.', 'Opened 7, 0 left.'])
  })

  it('shuffles from the seed, every value kept, and is kept by saves', () => {
    const story = storyFromText(['[list: Deck = a | b | c | d | e]', '[shuffle: Deck]', 'Top: {Deck 1}.', 'Next.'])
    const runtime = new StoryRuntime(story)
    runtime.start(42)
    const deck = runtime.exportState().lists?.[story.project.lists![0]!.id]
    expect([...deck ?? []].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    const save = toSave(story, runtime.exportState(), '2026-11-10T10:00:00.000Z')
    expect(save.lists).toEqual({ Deck: [...deck ?? []] })
    expect(stateFromSave(story, save).lists).toEqual(runtime.exportState().lists)
  })

  it('reads a number back into a counter, writes back as written, and needs Datajack 3.0', () => {
    const lines = ['[counter: Near = 0]', '[list: Counts = 3 × 0]', '[set: Counts 2 = 5]', '[set: Near = {Counts 2}]', '[add: Near 1]', 'Near: {Near}.', '[unset: Counts]', '[shuffle: Counts]']
    expect(pagesOf(lines)).toEqual(['Near: 6.'])
    const story = storyFromText(lines)
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(['[list: Counts = 3 × 0]', '[set: Counts 2 = 5]', '[set: Near = {Counts 2}]', '[unset: Counts]', '[shuffle: Counts]'].map(line => written.includes(line))).toEqual([true, true, true, true, true])
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.0')
  })

  it('is checked at import: a list declared, a place a number or a counter', () => {
    const problems = (lines: string[]) => checkReferences(importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })).map(problem => `${problem.code} ${problem.subject}`)
    expect(problems(['[list: Board = 2 × none]', '[shuffle: Bord]', '[set: Board Cel = x]', '[add: Queue = x]', 'Hi.'])).toEqual([
      'unknownList Bord',
      'unknownCounter Cel',
      'unknownList Queue',
    ])
  })
})

describe('a grid of picture buttons', () => {
  it('shows each place of its list, gives the counter the number picked, and makes the tiles’ pictures', () => {
    const story = storyFromText([
      '[list: Shown = 4 × back]',
      '[loop]',
      '[choice: Cell grid 2 × 2 from Shown with tile]',
      '[set: Shown Cell = open]',
      'Opened {Cell}.',
      '[if: Cell is 4]', '[break]', '[end]',
      '[end]',
    ])
    expect(story.project.characters.find(character => character.name === 'tile')?.expressions.map(expression => expression.name)).toEqual(['back', 'open'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    const items = () => runtime.snapshot.step.type === 'grid' ? runtime.snapshot.step.items : null
    expect(items()).toEqual(['back', 'back', 'back', 'back'])
    runtime.pickCell(3)
    expect(shownText(runtime)).toBe('Opened 3.')
    runtime.next()
    expect(items()).toEqual(['back', 'back', 'open', 'back'])
    runtime.pickCell(4)
    runtime.next()
    expect(runtime.snapshot.step.type).toBe('end')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[choice: Cell grid 2 × 2 from Shown with tile]')
  })
})

describe('the index', () => {
  it('knows what lists, grids and draws read and give: nothing there looks forgotten', () => {
    const story = storyFromText([
      '[decision: Card = ace | king]',
      '[decision: Kept = ace | king]',
      '[counter: Cell = 0]',
      '[counter: Second = 0]',
      '[counter: Count = 0]',
      '[list: Shown = 4 × back]',
      '[list: Hand]',
      '[choice: Cell grid 2 × 2 from Shown with tile]',
      '[set: Second = {Cell}]',
      '[set: Shown Second = open]',
      '[set: Card = random]',
      '[add: Hand = {Card}]',
      '[take: Kept = first of Hand]',
      '[take: Count = first of Hand]',
      '[if: Kept is ace or Kept is king]',
      'Kept {Count}.',
      '[end]',
      '[if: Card is ace]',
      'An ace.',
      '[end]',
    ])
    const index = indexNames(story.project, story.chapters)
    expect(nameWarnings(index, story.project, storyFlow(story.chapters, [])).map(warning => `${warning.name.name} ${warning.code}`)).toEqual(['Card valueGivenNeverTested'])
  })
})
