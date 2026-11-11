import { describe, expect, it } from 'vitest'
import { exportText, playerFormatVersion, StoryRuntime } from '../../src/index'
import { readChoiceHeading } from '../../src/importer/readControl'
import { storyFromText } from './storyFromText'

describe('options below', () => {
  it('reads below and the time in either order, and leaves a decision named so alone', () => {
    expect(readChoiceHeading('Action below')).toEqual({ decision: 'Action', timeLimitMs: null, below: true })
    expect(readChoiceHeading('Action 10s below')).toEqual({ decision: 'Action', timeLimitMs: 10_000, below: true })
    expect(readChoiceHeading('Action below 10s')).toEqual({ decision: 'Action', timeLimitMs: 10_000, below: true })
    expect(readChoiceHeading('Action 10s')).toEqual({ decision: 'Action', timeLimitMs: 10_000, below: false })
    expect(readChoiceHeading('Below')).toEqual({ decision: 'Below', timeLimitMs: null, below: false })
  })

  it('offers the choice as written, is written back, and needs Datajack 3.3', () => {
    const story = storyFromText(['[choice: Action below]', '> Strike = Strike', '> Guard = Guard', 'Done.'])
    const runtime = new StoryRuntime(story)
    runtime.start(0)
    const step = runtime.snapshot.step
    expect(step.type === 'choice' && step.choice.below).toBe(true)
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[choice: Action below]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.3')
    const plain = storyFromText(['[choice: Action]', '> Strike = Strike', 'Done.'])
    expect(playerFormatVersion(plain.project, plain.chapters)).not.toBe('3.3')
  })
})
