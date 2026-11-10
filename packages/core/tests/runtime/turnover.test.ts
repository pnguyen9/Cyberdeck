import { describe, expect, it } from 'vitest'
import { checkProjectDocument, exportText, playerFormatVersion, StoryRuntime, waitMillisecondsOf, type StageCommand } from '../../src/index'
import { storyFromText } from './storyFromText'

function expressionOf(runtime: StoryRuntime, story: ReturnType<typeof storyFromText>): string | undefined {
  const onStage = runtime.snapshot.stage.characters[0]
  return story.project.characters.find(character => character.id === onStage?.characterId)?.expressions.find(expression => expression.id === onStage?.expressionId)?.name
}

describe('a wait before the text', () => {
  it('holds back the tags written after it: they play in turn as each wait ends', () => {
    const story = storyFromText(['[enter: card center back]', 'Dealt.', '[card: edge]', '[wait: 0.15]', '[card: ace]', '[wait: 0.2]', '[card: king]', 'Turned.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    // On arriving, only what comes before the first wait.
    expect(expressionOf(runtime, story)).toBe('edge')
    expect(runtime.hasCommandsWaiting(0)).toBe(true)
    expect(runtime.reachOffset(0, true).map(command => command.type)).toEqual(['expression', 'wait'])
    expect(expressionOf(runtime, story)).toBe('ace')
    expect(runtime.reachOffset(0, true).map(command => command.type)).toEqual(['expression'])
    expect(expressionOf(runtime, story)).toBe('king')
    expect(runtime.hasCommandsWaiting(0)).toBe(false)
  })

  it('lets everything play at once when the player moves on, and again when coming back', () => {
    const story = storyFromText(['[enter: card center back]', 'Dealt.', '[card: edge]', '[wait: 0.15]', '[card: ace]', 'Turned.', 'Next.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    runtime.next()
    expect(expressionOf(runtime, story)).toBe('ace')
    runtime.back()
    expect(expressionOf(runtime, story)).toBe('edge')
    expect(runtime.hasCommandsWaiting(0)).toBe(true)
  })

  it('in the text too: tags after a wait at the same point wait for it', () => {
    const story = storyFromText(['[enter: card center back]', 'Look [card: edge][wait: 0.15][card: ace] here.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(runtime.reachOffset(5, true).map(command => command.type)).toEqual(['expression', 'wait'])
    expect(expressionOf(runtime, story)).toBe('edge')
    expect(runtime.hasCommandsWaiting(5)).toBe(true)
    expect(runtime.reachOffset(5, true).map(command => command.type)).toEqual(['expression'])
    expect(expressionOf(runtime, story)).toBe('ace')
  })
})

describe('a picture turning over', () => {
  const turnOf = (story: ReturnType<typeof storyFromText>) => story.chapters.flatMap(chapter => chapter.nodes)
    .flatMap(node => node.type === 'page' ? node.commandsBefore : [])
    .filter((command): command is Extract<StageCommand, { type: 'expression' }> => command.type === 'expression')
    .map(command => command.turn ?? null)

  it('reads flip, its time and wait; a picture named flip alone stays a picture', () => {
    const story = storyFromText(['[enter: card center back]', 'One.', '[card: ace flip]', 'Two.', '[card: king flip 0.6s wait]', 'Three.', '[card: flip]', 'Four.'])
    expect(turnOf(story)).toEqual([{ durationMs: 400 }, { durationMs: 600, wait: true }, null])
    expect(story.project.characters[0]?.expressions.map(expression => expression.name)).toEqual(['back', 'ace', 'king', 'flip'])
  })

  it('is kept on stage for the player to draw, holds the text when asked, and is written back as written', () => {
    const story = storyFromText(['[enter: card center back]', 'One.', '[card: ace flip 0.6s wait]', 'Two.', '[card: king]', 'Three.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    expect(runtime.snapshot.stage.characters[0]?.turnMs).toBe(600)
    runtime.next()
    expect(runtime.snapshot.stage.characters[0]?.turnMs).toBeUndefined()
    const turned = turnOf(story)[0]!
    expect(waitMillisecondsOf({ type: 'expression', characterId: 'c', expressionId: 'e', turn: turned }, runtime.context)).toBe(600)
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[card: ace flip 0.6s wait]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.1')
    expect(() => checkProjectDocument(story.project, 'project')).not.toThrow()
  })
})
