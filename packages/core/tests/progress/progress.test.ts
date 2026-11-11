import { describe, expect, it } from 'vitest'
import {
  decisionsTestedFrom,
  emptyProgress,
  layOutProgressMap,
  mergeProgress,
  parseProgress,
  recordChoiceReached,
  recordOptionPicked,
  parseSave,
  toSave,
  recordEndReached,
  recordPageRead,
  stateFromSave,
  StoryRuntime,
  type PendingOption,
  type PlayableStory,
  type ProgressData,
} from '../../src/index'
import { storyFromText } from '../runtime/storyFromText'
import { stagedPointKeyOf } from '../../src/progress/progress'

const NOW = '2026-10-26T12:00:00.000Z'

/** Mood is tested again at the door; the hat only right after it is chosen. */
const STORY = [
  '[choice: Mood]', '> Smile = Happy', '> Frown = Sad',
  '[if: Mood is Happy]', 'You smile.', '[else]', 'You frown.', '[end]',
  '[choice: Hat]', '> Red hat = Red', '> Blue hat = Blue',
  '[if: Hat is Red]', 'Red.', '[else]', 'Blue.', '[end]',
  '[choice: Door]', '> Open = Open', '> Leave = Leave',
  '[if: Door is Open]', '[if: Mood is Happy]', 'A party!', '[ending: Party]', '[end]', 'Empty.', '[ending: Empty]', '[end]',
  'You leave.',
]

/** Plays like Datajack does, recording progress at every stop, picking the options named in turn. */
function play(story: PlayableStory, progress: ProgressData, optionTexts: string[], runtime = startedRuntime(story), arrivedBy: PendingOption | null = null): ProgressData {
  let pending = arrivedBy
  const remaining = [...optionTexts]
  for (;;) {
    const step = runtime.snapshot.step
    if (step.type === 'page') {
      progress = recordPageRead(progress, step.page.id)
      runtime.next()
    } else if (step.type === 'choice') {
      const recorded = recordChoiceReached(progress, story, runtime.exportState(), pending, NOW)
      progress = recorded.progress
      const wanted = remaining.shift()
      const option = step.choice.options.find(candidate => candidate.text === wanted)
      if (option === undefined) {
        throw new Error(`No option ${wanted} among ${step.choice.options.map(candidate => candidate.text).join(', ')}`)
      }
      pending = { pointKey: recorded.pointKey, optionId: option.id }
      runtime.choose(option.id)
    } else if (step.type === 'end') {
      return recordEndReached(progress, step.endingId, pending)
    }
  }
}

function startedRuntime(story: PlayableStory) {
  const runtime = new StoryRuntime(story)
  runtime.start()
  return runtime
}

describe('progress', () => {
  it('merges paths that agree on the decisions still tested, and keeps the others apart', () => {
    const story = storyFromText(STORY)
    let progress = play(story, emptyProgress(story), ['Smile', 'Red hat', 'Open'])
    progress = play(story, progress, ['Smile', 'Blue hat', 'Open'])

    expect(progress.points).toHaveLength(3)
    const hat = progress.points[1]!
    expect(hat.taken.map(option => option.next)).toEqual([
      { type: 'point', key: progress.points[2]!.key },
      { type: 'point', key: progress.points[2]!.key },
    ])

    progress = play(story, progress, ['Frown', 'Red hat', 'Leave'])
    expect(progress.points).toHaveLength(5)
    expect(progress.endingIds.map(endingId => story.project.endings.find(ending => ending.id === endingId)?.name)).toEqual(['Party'])
  })

  it('keeps apart arrivals at a choice inside a loop that differ on what the loop tests before it', () => {
    const story = storyFromText([
      '[decision: Book = Read]',
      '[loop]',
      '[if: Book is Read]', 'You know this place now.', '[end]',
      '[choice: Where]', '> The library = Library', '> The park = Park', '> Go home = Home',
      '[if: Where is Library]', '[set: Book = Read]', '[else if: Where is Home]', '[break]', '[end]',
      '[end]',
      'Home.',
    ])
    // Before the book is read, and after: two points. The place picked the round before is no
    // matter, the choice giving it again before anything tests it.
    const progress = play(story, emptyProgress(story), ['The park', 'The library', 'The park', 'Go home'])
    expect(progress.points).toHaveLength(2)
  })

  it('records the pages read once', () => {
    const story = storyFromText(STORY)
    const progress = play(story, emptyProgress(story), ['Smile', 'Red hat', 'Open'])
    expect(progress.readPageIds).toHaveLength(3)
    expect(recordPageRead(progress, progress.readPageIds[0]!)).toBe(progress)
  })

  it('resumes a point exactly, so that another option joins the same map', () => {
    const story = storyFromText(STORY)
    let progress = play(story, emptyProgress(story), ['Frown', 'Red hat', 'Open'])
    const door = progress.points[2]!

    const runtime = new StoryRuntime(story)
    runtime.restoreState(stateFromSave(story, door.save))
    progress = play(story, progress, ['Leave'], runtime)

    expect(progress.points).toHaveLength(3)
    const empty = story.project.endings.find(ending => ending.name === 'Empty')!
    expect(progress.points[2]!.taken.map(option => option.next)).toEqual([
      { type: 'end', endingId: empty.id },
      { type: 'end', endingId: null },
    ])
  })

  it('reads back what it wrote, dropping what is broken', () => {
    const story = storyFromText(STORY)
    const progress = play(story, emptyProgress(story), ['Smile', 'Red hat', 'Open'])
    const written = JSON.parse(JSON.stringify(progress))
    expect(parseProgress(written)).toEqual(progress)

    written.points[0].save = { broken: true }
    expect(parseProgress(written)?.points).toHaveLength(2)
    expect(parseProgress({ progressFormat: 2 })).toBeNull()
  })
})

describe('the map', () => {
  it('joins paths that reach a choice with different stages, and keeps points recorded with the stage', () => {
    const lines = ['[choice: Way]', '> Park = Park', '> Street = Street', '[if: Way is Park]', '[bg: park]', '[enter: marie]', 'Trees.', '[else]', '[bg: street]', 'Cars.', '[end]', '[choice: Then]', '> Home = Home', 'Done.']
    const story = storyFromText(lines)
    let progress = play(story, emptyProgress(story), ['Park', 'Home'])
    progress = play(story, progress, ['Street', 'Home'])
    expect(progress.points.map(point => point.choiceId === story.chapters[0]!.nodes.at(-2)?.id ? 'Then' : 'Way')).toEqual(['Way', 'Then'])

    // A point keyed the way it was before 3.2, the stage in its key: the same arrival joins it.
    const runtime = startedRuntime(story)
    const first = runtime.snapshot.step
    runtime.choose(first.type === 'choice' ? first.choice.options[0]!.id : '')
    while (runtime.snapshot.step.type === 'page') {
      runtime.next()
    }
    const fresh = recordChoiceReached(emptyProgress(story), story, runtime.exportState(), null, NOW).progress
    const point = fresh.points[0]!
    const legacyKey = stagedPointKeyOf(point.choiceId, point.save, decisionsTestedFrom(story, point.choiceId))
    expect(legacyKey).not.toBe(point.key)
    const legacy = { ...fresh, points: [{ ...point, key: legacyKey }] }
    const joined = recordChoiceReached(legacy, story, runtime.exportState(), null, NOW)
    expect([joined.progress.points.length, joined.pointKey]).toEqual([1, legacyKey])
  })

  it('marks an option taken when picked, and links it to the next choice after the game was left and resumed', () => {
    const story = storyFromText(STORY)
    const runtime = startedRuntime(story)
    const onAPage = () => runtime.snapshot.step.type === 'page'
    while (onAPage()) {
      runtime.next()
    }
    const reached = recordChoiceReached(emptyProgress(story), story, runtime.exportState(), null, NOW)
    const step = runtime.snapshot.step
    const smile = step.type === 'choice' ? step.choice.options[0]!.id : ''
    const picked = { pointKey: reached.pointKey, optionId: smile }
    let progress = recordOptionPicked(reached.progress, picked)
    expect(progress.points[0]?.taken).toEqual([{ optionId: smile, next: null }])
    runtime.choose(smile)
    // Left on the page after the choice: the autosave keeps the option picked.
    const autosave = parseSave(JSON.parse(JSON.stringify({ ...toSave(story, runtime.exportState(), NOW), arrivedBy: picked })))
    expect(autosave?.arrivedBy).toEqual(picked)
    while (onAPage()) {
      runtime.next()
    }
    progress = recordChoiceReached(progress, story, runtime.exportState(), autosave?.arrivedBy ?? null, NOW).progress
    expect(progress.points[0]?.taken).toEqual([{ optionId: smile, next: { type: 'point', key: progress.points[1]!.key } }])
  })

  it('shows each option with the values its point held, as the choice did', () => {
    const story = storyFromText(['[counter: Money = 1000.00]', '[choice: Bet]', '> Ten = Ten', '> Everything: {Money} dollars = All', 'Done.'])
    const progress = play(story, emptyProgress(story), ['Everything: 1,000.00 dollars'])
    const point = layOutProgressMap(progress, story).nodes.find(node => node.type === 'point')
    expect(point?.type === 'point' ? point.options.map(option => option.text) : null).toEqual(['Ten', 'Everything: 1,000.00 dollars'])
  })

  it('lays points out left to right, lanes per option, endings last', () => {
    const story = storyFromText(STORY)
    let progress = play(story, emptyProgress(story), ['Smile', 'Red hat', 'Open'])
    progress = play(story, progress, ['Frown', 'Blue hat', 'Leave'])
    const map = layOutProgressMap(progress, story)

    const shown = map.nodes.map(node => node.type === 'point'
      ? `${node.decisionName} @${node.column},${node.row} [${node.options.map(option => `${option.text}${option.isTaken ? '' : '?'}`).join(', ')}]`
      : `end ${node.endingName ?? '(plain)'} @${node.column},${node.row}`)
    expect(shown).toEqual([
      'Mood @0,0 [Smile, Frown]',
      'Hat @1,0 [Red hat, Blue hat?]',
      'Door @2,0 [Open, Leave?]',
      'Hat @1,1 [Red hat?, Blue hat]',
      'Door @2,1 [Open?, Leave]',
      'end Party @3,0',
      'end (plain) @3,1',
    ])
    expect(map.edges).toHaveLength(6)
    expect([map.endingsReached, map.endingsTotal]).toEqual([1, 2])
  })
})

describe('progress brought from elsewhere', () => {
  it('joins what either reached, each point with the options taken in both, the lasting values brought', () => {
    const story = storyFromText(['Hello.'])
    const base = emptyProgress(story)
    const save = { saveFormat: 1 } as unknown as ProgressData['points'][number]['save']
    const own: ProgressData = {
      ...base,
      points: [{ key: 'door', chapterId: 'c', choiceId: 'door', reachedAt: NOW, save, taken: [{ optionId: 'open', next: { type: 'end', endingId: 'out' } }, { optionId: 'knock', next: null }] }],
      endingIds: ['out'],
      readPageIds: ['p1'],
      lasting: { decisions: {}, counters: { Coins: 1 } },
    }
    const brought: ProgressData = {
      ...base,
      points: [
        { key: 'door', chapterId: 'c', choiceId: 'door', reachedAt: NOW, save, taken: [{ optionId: 'knock', next: { type: 'point', key: 'hall' } }, { optionId: 'open', next: null }] },
        { key: 'hall', chapterId: 'c', choiceId: 'hall', reachedAt: NOW, save, taken: [] },
      ],
      endingIds: ['in'],
      readPageIds: ['p1', 'p2'],
      lasting: { decisions: {}, counters: { Coins: 7 } },
    }
    const merged = mergeProgress(own, brought)
    expect(merged.points.map(point => point.key)).toEqual(['door', 'hall'])
    expect(merged.points[0]!.taken).toEqual([{ optionId: 'open', next: { type: 'end', endingId: 'out' } }, { optionId: 'knock', next: { type: 'point', key: 'hall' } }])
    expect([merged.endingIds, merged.readPageIds, merged.lasting]).toEqual([['out', 'in'], ['p1', 'p2'], { decisions: {}, counters: { Coins: 7 } }])
  })
})

describe('points of the map', () => {
  it('lead to their next points in the order of their options, whatever order they were played in, so that lines do not cross', () => {
    const story = storyFromText(['[choice: Door]', '> Open = Open', '> Leave = Leave', '[if: Door is Open]', 'In.', '[ending: Party]', '[end]', 'Out.', '[ending: Gone]'])
    let progress = play(story, emptyProgress(story), ['Leave'])
    progress = play(story, progress, ['Open'])
    const ends = layOutProgressMap(progress, story).nodes.flatMap(node => node.type === 'end' ? [`${node.endingName} @${node.row}`] : [])
    expect(ends.sort()).toEqual(['Gone @1', 'Party @0'])
  })

  it('are not told apart by a value the story always gives again before testing it', () => {
    const story = storyFromText([
      '[counter: Pick = 0]',
      '[loop]',
      '[choice: Where]', '> The shop = Shop', '> Home = Home',
      '[if: Where is Home]', '[break]', '[end]',
      '[play: Extra]',
      '[end]',
      'Home.',
      '# Scene: Extra',
      '[set: Pick = random 1 3]',
      '[if: Pick is 1]', 'One.', '[else]', 'Another.', '[end]',
    ])
    // Whatever was drawn the first time, coming back to the choice is the same point.
    const progress = play(story, emptyProgress(story), ['The shop', 'The shop', 'The shop', 'Home'])
    expect(progress.points).toHaveLength(1)
  })
})
