import { describe, expect, it } from 'vitest'
import { assetsUsedBy, checkReferences, exportText, importText, indexNames, nameWarnings, playerFormatVersion, stateFromSave, StoryRuntime, storyFlow, toSave } from '../../src/index'
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

  it('compares its size with a counter, as the storyboard and the text say it', () => {
    const lines = [
      '[counter: Cut = 2]',
      '[list: Shoe = a | b | c]',
      '[if: Shoe size < {Cut}]', 'Refill.', '[else]', 'Enough.', '[end]',
      '[take: Cut = first of Shoe]',
      '[set: Cut = 3]',
      '[if: Shoe size < {Cut}]', 'Refill now.', '[end]',
      '[if: Shoe size is {Cut}]', 'Never.', '[end]',
    ]
    expect(pagesOf(lines)).toEqual(['Enough.', 'Refill now.'])
    const story = storyFromText(lines)
    expect(exportText(story.project, story.chapters, { declareDecisions: false })).toContain('[if: Shoe size < {Cut}]')
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

  it('has its pictures carried by an exported game, though no tag names them', () => {
    const story = storyFromText(['[list: Shown = 2 × back]', '[choice: Cell grid 2 × 1 from Shown with tile]', '[set: Shown Cell = open]', 'Opened.'])
    const tile = story.project.characters.find(character => character.name === 'tile')!
    const project = { ...story.project, characters: story.project.characters.map(character => character === tile
      ? { ...character, expressions: character.expressions.map(expression => ({ ...expression, assetId: `file-${expression.name}` })) }
      : character) }
    expect([...assetsUsedBy(project, story.chapters)].sort()).toEqual(['file-back', 'file-open'])
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

describe('a grid with a caption and the clock now', () => {
  it('shows the line under the grid with its values, written back, needing Datajack 3.2', () => {
    const story = storyFromText(['[counter: Left = 3]', '[list: Shown = 4 × back]', '[choice: Cell grid 2 × 2 from Shown with tile]', '> {Left} cells left', 'Picked {Cell}.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    const step = runtime.snapshot.step
    expect(step.type === 'grid' ? step.grid.caption : null).toBe('3 cells left')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[choice: Cell grid 2 × 2 from Shown with tile]\n> {Left} cells left')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.2')
  })

  it('reads now as seconds since 1970, to time the player', () => {
    const story = storyFromText(['[counter: Start = 0]', '[set: Start = {now}]', 'Started at {Start}.', 'Now {now}.'])
    const runtime = new StoryRuntime(story)
    let time = 1_000_000_000_000
    runtime.useClock({ now: () => new Date(time), minutesAway: 0 })
    runtime.start()
    expect(shownText(runtime)).toBe('Started at 1000000000.')
    time += 95_000
    runtime.next()
    expect(shownText(runtime)).toBe('Now 1000000095.')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.2')
  })
})

describe('a grid with a second way to pick', () => {
  it('gives a tile marked to its own counter, the picking one 0, and the other way round; written back', () => {
    const story = storyFromText(['[list: Shown = 4 × hidden]', '[loop]', '[choice: Cell grid 2 × 2 from Shown with tile, marking Flag]', '[if: Flag > 0]', '[set: Shown Flag = flag]', '[end]', 'Cell {Cell}, flag {Flag}.', '[end]'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.pickCell(3, true)
    expect(shownText(runtime)).toBe('Cell 0, flag 3.')
    runtime.next()
    const step = runtime.snapshot.step
    expect(step.type === 'grid' ? step.items : null).toEqual(['hidden', 'hidden', 'flag', 'hidden'])
    runtime.pickCell(2)
    expect(shownText(runtime)).toBe('Cell 2, flag 0.')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[choice: Cell grid 2 × 2 from Shown with tile, marking Flag]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.2')
  })
})
