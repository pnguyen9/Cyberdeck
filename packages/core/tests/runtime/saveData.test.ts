import { describe, expect, it } from 'vitest'
import { parseSave, stateFromSave, toSave } from '../../src/saves/saveData'
import { StoryRuntime } from '../../src/runtime/storyRuntime'
import { storyFromText } from './storyFromText'

const STORY = [
  '# The Letter',
  '[bg: classroom] [music: calm]',
  '[enter: marie left smile]',
  '[decision multi: Clues = Letter | Key]',
  '[set: Clues = Letter]',
  '— Marie: Did you choose?',
  '[choice: Answer]',
  '> Tell the truth. = Truth',
  '> Lie. = Lie',
  '— Marie: I see.',
]

function playedToSecondPage() {
  const story = storyFromText(STORY)
  const runtime = new StoryRuntime(story)
  runtime.start()
  runtime.next()
  const step = runtime.snapshot.step
  if (step.type !== 'choice') {
    throw new Error('Expected the choice')
  }
  runtime.choose(step.choice.options[0]!.id)
  return { story, runtime }
}

describe('toSave', () => {
  it('writes a readable save: names rather than identifiers wherever a person might look', () => {
    const { story, runtime } = playedToSecondPage()
    const save = toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')

    expect(save).toMatchObject({
      saveFormat: 1,
      game: { id: story.project.id, name: 'Test' },
      savedAt: '2026-10-26T12:00:00.000Z',
      chapter: 'The Letter',
      excerpt: 'I see.',
      decisions: { Clues: ['Letter'], Answer: ['Truth'] },
      stage: { background: 'classroom', music: 'calm', characters: [{ name: 'Marie', expression: 'smile', x: 25, facing: null }] },
      choices: [{ decision: 'Answer', option: 'Tell the truth.' }],
    })
  })
})

describe('saves of screen effects and scenes', () => {
  it('keep the screen faded out, the tint and the illustration, through a save', () => {
    const story = storyFromText(['[tint: night] [illustration: Kiss]', 'Dark streets.', '[fade out: white]', 'Blinding.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    const save = JSON.parse(JSON.stringify(toSave(story, runtime.exportState(), '2026-10-27T12:00:00.000Z')))
    expect(save.stage).toMatchObject({ cover: 'white', tint: 'night', illustration: 'Kiss' })
    expect(parseSave(save)).not.toBeNull()
    const restored = new StoryRuntime(story)
    restored.restoreState(stateFromSave(story, save))
    expect([restored.snapshot.stage.cover, restored.snapshot.stage.tint, restored.snapshot.stage.illustrationId]).toEqual(['white', 'night', story.project.illustrations[0]!.id])
    expect(parseSave({ ...save, stage: { ...save.stage, tint: 'purple' } })).toBeNull()
  })

  it('keep the pages already on a screen of full-screen text, and where the screen ends', () => {
    const story = storyFromText(['[text: full]', 'P1.', 'P2.', 'P3.', 'P4.', 'P5.', 'P6.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    runtime.next()
    const save = JSON.parse(JSON.stringify(toSave(story, runtime.exportState(), '2026-10-27T12:00:00.000Z')))
    expect(parseSave(save)).not.toBeNull()
    const restored = new StoryRuntime(story)
    restored.restoreState(stateFromSave(story, save))
    const screen = () => restored.screenfulPages().map(page => page.text)
    expect(screen()).toEqual(['P1.', 'P2.', 'P3.'])
    restored.next()
    restored.next()
    expect(screen()).toEqual(['P1.', 'P2.', 'P3.', 'P4.', 'P5.'])
    restored.next()
    expect(screen()).toEqual(['P6.'])
    expect(parseSave({ ...save, stage: { ...save.stage, screen: [1] } })).toBeNull()
  })

  it('keep the choices made inside a scene', () => {
    const story = storyFromText(['[play: Question]', 'After.', '# Scene: Question', '[choice: Answer]', '> Yes', '> No'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    const step = runtime.snapshot.step
    runtime.choose(step.type === 'choice' ? step.choice.options[1]!.id : '')
    expect(toSave(story, runtime.exportState(), '2026-10-27T12:00:00.000Z').choices).toMatchObject([{ decision: 'Answer', option: 'No' }])
  })
})

describe('stateFromSave', () => {
  it('restores what was saved, through the names', () => {
    const { story, runtime } = playedToSecondPage()
    const save = toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')

    const restored = new StoryRuntime(story)
    expect(restored.restoreState(stateFromSave(story, save))).toBe('exact')
    expect(restored.snapshot.decisions).toEqual(runtime.snapshot.decisions)
    expect(restored.snapshot.stage).toEqual(runtime.snapshot.stage)
  })

  it('accepts a save edited by hand, and ignores names the story does not have', () => {
    const { story, runtime } = playedToSecondPage()
    const save = toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')
    const edited = {
      ...save,
      decisions: { clues: ['letter', 'KEY'], Answer: ['Lie'], Weather: ['Rain'] },
      stage: { ...save.stage, characters: [...save.stage.characters, { name: 'Nobody', expression: 'sad', x: 75, facing: null }] },
    }

    const state = stateFromSave(story, edited)
    const clues = story.project.decisions.find(decision => decision.name === 'Clues')!
    const answer = story.project.decisions.find(decision => decision.name === 'Answer')!
    expect(state.decisions).toEqual({
      [clues.id]: clues.values.map(value => value.id),
      [answer.id]: [answer.values.find(value => value.name === 'Lie')!.id],
    })
    expect(state.stage.characters).toHaveLength(1)
  })
})

describe('parseSave', () => {
  it('accepts what toSave writes, once through JSON', () => {
    const { story, runtime } = playedToSecondPage()
    const save = toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')
    expect(parseSave(JSON.parse(JSON.stringify(save)))).toEqual(save)
  })

  it('refuses anything else: saves are files players can edit and share', () => {
    const { story, runtime } = playedToSecondPage()
    const save = toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')

    expect(parseSave(null)).toBeNull()
    expect(parseSave('save')).toBeNull()
    expect(parseSave({ ...save, saveFormat: 2 })).toBeNull()
    expect(parseSave({ ...save, decisions: { Clues: 'Letter' } })).toBeNull()
    expect(parseSave({ ...save, page: { chapterId: 1 } })).toBeNull()
    expect(parseSave({ ...save, stage: { ...save.stage, characters: [{ name: 'Marie', expression: 'smile', x: 'upstairs', facing: null }] } })).toBeNull()
    expect(parseSave({ ...save, stage: { ...save.stage, characters: [{ name: 'Marie', expression: 'smile', x: 250, facing: null }] } })).toBeNull()
    expect(parseSave({ ...save, excerpt: '<img src=x onerror=alert(1)>' })).not.toBeNull()
  })
})
