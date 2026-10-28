import { describe, expect, it } from 'vitest'
import { completionAt, tagEndingAt, tagKind, tagProblem, tagsIn, tagStartingAt, type TagVocabulary } from '../../src/editing/tagText'

const layout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }
const VOCABULARY: TagVocabulary = {
  characters: [{ name: 'Marie', expressions: ['normal', 'smile', 'surprised'] }, { name: 'Jules', expressions: ['normal'] }],
  backgrounds: ['classroom', 'rooftop'],
  music: ['calm'],
  sounds: ['door'],
  illustrations: ['Kiss'],
  videos: ['Opening'],
  positions: ['far-left', 'left', 'center', 'right', 'far-right'],
  decisions: [{ name: 'Answer', values: ['Truth', 'Dodge'] }],
  counters: ['Trust'],
  endings: ['Gone', 'Home'],
  scenes: ['Caught'],
  styles: ['Whisper'],
  memories: ["The ghost's name"],
}

/** Suggestions with the caret where `|` is. */
function suggest(textWithCaret: string) {
  const caret = textWithCaret.indexOf('|')
  const completion = completionAt(textWithCaret.replace('|', ''), caret, VOCABULARY)
  return completion === null ? null : { from: completion.from, labels: completion.items.map(item => item.label) }
}

describe('tags in the text', () => {
  const text = '[bg: rooftop]\n— Marie: Hi. [marie: smile]There.'

  it('are found with their brackets', () => {
    expect(tagsIn(text).map(tag => text.slice(tag.start, tag.end))).toEqual(['[bg: rooftop]', '[marie: smile]'])
  })

  it('are removed whole: the one before the caret by Backspace, the one after by Delete', () => {
    expect(tagEndingAt(text, 13)?.content).toBe('bg: rooftop')
    expect(tagStartingAt(text, text.indexOf('[marie'))?.content).toBe('marie: smile')
    expect(tagEndingAt(text, 12)).toBeNull()
  })

  it('are coloured by kind', () => {
    expect(['bg: x', 'enter: Marie', 'Marie: smile', 'if: Answer is Truth', 'wait: 1'].map(tagKind)).toEqual(['stage', 'character', 'character', 'control', 'pause'])
  })

  it('say what is wrong with them, as the import would', () => {
    expect(tagProblem('enter: Marie left', VOCABULARY, layout)).toBeNull()
    expect(tagProblem('enter: Marie left right', VOCABULARY, layout)).not.toBeNull()
    expect(tagProblem('ener: Marie', VOCABULARY, layout)).toContain('enter')
    expect(['style: Whisper', 'style: italic', 'style: none'].map(content => tagProblem(content, VOCABULARY, layout))).toEqual([null, null, null])
    expect(tagProblem('tint: purple', VOCABULARY, layout)).toContain('sepia, night, grey or none')
    expect(['style: italic', 'shake', 'text: full'].map(tagKind)).toEqual(['stage', 'stage', 'stage'])
    expect(tagProblem('if: Nothing is checked here', VOCABULARY, layout)).toBeNull()
    expect(tagProblem('tint: purple', VOCABULARY, layout, 'fr')).toBe('[tint: …] n’est pas compris\u00a0: il attend sepia, night, grey ou none.')
  })
})

describe('suggestions', () => {
  it('offer directives and characters after an opening bracket', () => {
    expect(suggest('[|')?.labels.slice(0, 3)).toEqual(['bg', 'transition', 'music'])
    expect(suggest('Text [e|')?.labels).toEqual(['enter', 'exit', 'else if', 'else', 'end', 'ending'])
    expect(suggest('[Ma|')).toEqual({ from: 1, labels: ['Marie'] })
  })

  it('offer the names of what the directive takes', () => {
    expect(suggest('[bg: r|')?.labels).toEqual(['rooftop'])
    expect(suggest('[music: |')?.labels).toEqual(['calm', 'stop'])
    expect(suggest('[marie: s|')?.labels).toEqual(['smile', 'surprised'])
    expect(suggest('[ending: |')?.labels).toEqual(['Gone', 'Home'])
    expect(suggest('[remember: The|')?.labels).toEqual(["The ghost's name"])
  })

  it('offer a character first, then where and how it enters', () => {
    expect(suggest('[enter: J|')).toEqual({ from: 8, labels: ['Jules'] })
    expect(suggest('[enter: Marie s|')?.labels).toEqual(['smile', 'surprised', 'slide-from-left', 'slide-from-right'])
    expect(suggest('[exit: Marie f|')?.labels).toEqual(['fade'])
  })

  it('follow the grammar of conditions', () => {
    expect(suggest('[if: |')?.labels).toEqual(['Answer', 'Trust', 'remembered', 'seen ending', 'not'])
    expect(suggest('[if: Answer is Truth and Trust |')?.labels).toEqual(['>=', '<=', '>', '<', 'is'])
    expect(suggest('[add: T|')?.labels).toEqual(['Trust'])
    expect(suggest('[set: |')?.labels).toEqual(['Answer', 'Trust'])
    expect(suggest('[unset: |')?.labels).toEqual(['Answer'])
    expect(suggest('[if: Answer is |')?.labels).toEqual(['not', 'Truth', 'Dodge'])
    expect(suggest('[if: Answer is not D|')?.labels).toEqual(['Dodge'])
    expect(suggest('[if: seen ending |')?.labels).toEqual(['Gone', 'Home'])
    expect(suggest('[set: Answer = T|')?.labels).toEqual(['Truth'])
  })

  it('describe what they offer in the author\'s language, the words of the syntax staying as they are', () => {
    const completion = completionAt('[bg: r', 6, VOCABULARY, 'fr')
    expect(completion?.items.map(item => [item.label, item.detail])).toEqual([['rooftop', 'décor']])
    expect(completionAt('[e', 2, VOCABULARY, 'fr')?.items[0]).toEqual({ label: 'enter', insert: 'enter: ', detail: 'un personnage entre en scène' })
  })

  it('stop once the tag is closed, or outside any tag', () => {
    expect(suggest('[bg: rooftop] |')).toBeNull()
    expect(suggest('Plain text|')).toBeNull()
  })
})
