import { describe, expect, it } from 'vitest'
import {
  checkReferences,
  emptyProgress,
  exportText,
  importText,
  minutesAway,
  playerFormatVersion,
  recordPlaying,
  StoryRuntime,
  toSave,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

const STORY = [
  '[if: hour >= 22 or hour < 6]',
  'Asleep. Day {weekday}.',
  '[else if: time away > 1440]',
  'You were away {time away} minutes!',
  '[else]',
  'Awake at {hour}.',
  '[end]',
]

const shownText = (runtime: StoryRuntime) => {
  const step = runtime.snapshot.step
  return step.type === 'page' ? step.page.text : step.type
}

/** A Sunday, at the hour given, in the local time of the computer running the tests. */
const sunday = (hour: number) => new Date(2026, 10, 8, hour, 30)

function played(hour: number, away: number) {
  const story = storyFromText(STORY)
  const runtime = new StoryRuntime(story)
  runtime.useClock({ now: () => sunday(hour), minutesAway: away })
  runtime.start()
  return { story, runtime }
}

describe('the clock’s counters', () => {
  it('give the hour, the day of the week from Monday 1, and the time away, without declaring them', () => {
    expect(shownText(played(23, 0).runtime)).toBe('Asleep. Day 7.')
    expect(shownText(played(14, 3000).runtime)).toBe('You were away 3000 minutes!')
    expect(shownText(played(14, 5).runtime)).toBe('Awake at 14.')
  })

  it('stay out of saves and of the text written back, and need Datajack 2.1', () => {
    const { story, runtime } = played(14, 5)
    expect(toSave(story, runtime.exportState(), '2026-11-10T10:00:00.000Z').counters).toBeUndefined()
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(written).not.toContain('[counter')
    expect(written).toContain('[if: hour >= 22 or hour < 6]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })

  it('cannot be changed, and leave the name to a decision or a counter the story declares', () => {
    const problems = (lines: string[]) => {
      const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
      return checkReferences(imported).map(problem => `${problem.code} ${problem.subject}`)
    }
    expect(problems(['[set: hour = 3]', '[add: time away 5]', 'Hi.'])).toEqual(['clockReadOnly hour', 'clockReadOnly time away'])
    expect(problems(['[counter: hour = 9]', '[add: hour 1]', 'Hi.'])).toEqual([])
    const own = storyFromText(['[decision: Hour = Dawn | Dusk]', '[set: Hour = Dusk]', '[if: Hour is Dusk]', 'Dusk.', '[end]'])
    expect(own.project.counters).toEqual([])
  })

  it('count the time away from when the profile last played, refreshed at most once a minute', () => {
    const progress = emptyProgress(storyFromText(['Hi.']))
    const now = new Date('2026-11-10T10:00:00.000Z')
    expect(minutesAway(progress, now)).toBe(0)
    const playing = recordPlaying(progress, now)
    expect(playing.lastPlayedAt).toBe('2026-11-10T10:00:00.000Z')
    expect(recordPlaying(playing, new Date('2026-11-10T10:00:30.000Z'))).toBe(playing)
    expect(minutesAway(playing, new Date('2026-11-11T10:00:00.000Z'))).toBe(1440)
  })
})

describe('values changed by hand, as an author testing the story', () => {
  it('are read by what follows: a decision, a counter, a memory no playthrough could give', () => {
    const story = storyFromText([
      '[decision: Way = Left | Right]', '[counter: Coins = 0]',
      'Before.',
      '[if: remembered Met the cat]', 'The cat knows you.', '[else if: Way is Right and Coins > 5]', 'Rich, on the right.', '[else]', 'Nothing.', '[end]',
      '[remember: Met the cat]',
    ])
    const playThrough = (changes: (runtime: StoryRuntime) => void) => {
      const runtime = new StoryRuntime(story)
      runtime.start()
      changes(runtime)
      runtime.next()
      return shownText(runtime)
    }
    const way = story.project.decisions[0]!
    const coins = story.project.counters[0]!
    const cat = story.project.memories[0]!
    expect(playThrough(() => undefined)).toBe('Nothing.')
    expect(playThrough(runtime => {
      runtime.change({ type: 'decision', decisionId: way.id, valueIds: [way.values[1]!.id] })
      runtime.change({ type: 'counter', counterId: coins.id, units: 9 })
    })).toBe('Rich, on the right.')
    expect(playThrough(runtime => runtime.change({ type: 'memory', memoryId: cat.id, isHeld: true }))).toBe('The cat knows you.')
  })
})
