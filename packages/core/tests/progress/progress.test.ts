import { describe, expect, it } from 'vitest'
import {
  emptyProgress,
  layOutProgressMap,
  parseProgress,
  recordChoiceReached,
  recordEndReached,
  recordPageRead,
  stateFromSave,
  StoryRuntime,
  type PendingOption,
  type PlayableStory,
  type ProgressData,
} from '../../src/index'
import { storyFromText } from '../runtime/storyFromText'

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
    // The park is chosen before and after the book is read: the page before the choice differs.
    const progress = play(story, emptyProgress(story), ['The park', 'The library', 'The park', 'Go home'])
    expect(progress.points).toHaveLength(4)
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
