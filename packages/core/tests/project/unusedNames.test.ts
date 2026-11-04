import { describe, expect, it } from 'vitest'
import { unusedNames, withoutNames } from '../../src/index'
import { storyFromText } from '../runtime/storyFromText'

describe('names nothing uses any more', () => {
  it('are those of the stage and those made by use, never what the author declared', () => {
    const story = storyFromText(['[decision: Mood = Calm | Angry]', '[counter: Trust]', '[enter: Marie smile]', '[choice: Answer]', '> Yes', '> No', 'Hello.'])
    const project = {
      ...story.project,
      characters: [...story.project.characters, { id: 'jules', name: 'Jules', expressions: [], drawnFacing: 'left' as const }, { id: 'ana', name: 'Ana', expressions: [], drawnFacing: null, nameColor: '#ff8800' }],
      music: [{ id: 'calm', name: 'calm', assetId: null }],
    }
    // The story without its choice and its entrance: what they named is no longer used.
    const bare = story.chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.filter(node => node.type === 'page' && node.commandsBefore.length === 0) }))
    const unused = unusedNames(project, bare)
    expect(unused.map(name => `${name.kind} ${name.name}${name.isKept ? ' (kept)' : ''}`)).toEqual([
      'music calm',
      'character Marie',
      'character Jules (kept)',
      'character Ana (kept)',
      'decision Answer',
    ])
    const cleaned = withoutNames(project, unused.filter(name => !name.isKept))
    expect([cleaned.music, cleaned.characters.map(character => character.name), cleaned.decisions.map(decision => decision.name), cleaned.counters.map(counter => counter.name)])
      .toEqual([[], ['Jules', 'Ana'], ['Mood'], ['Trust']])
  })
})
