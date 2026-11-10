import { describe, expect, it } from 'vitest'
import { checkReferences, createStageCatalog, exportText, importText, playerFormatVersion, StoryRuntime, unusedNames } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from './storyFromText'

const STORY = [
  '[decision: Card = ace-spades | queen-hearts]',
  '[decision: Place = park | rooftop]',
  '[set: Card = queen-hearts]',
  '[set: Place = rooftop]',
  '[bg: {Place}]',
  '[enter: card1 {Card} left]',
  'Dealt.',
  '[set: Card = ace-spades]',
  '[card1: {Card}]',
  'Turned.',
]

describe('a picture named by a decision’s value', () => {
  it('is the one named like the value the decision holds as the tag plays, with no branch', () => {
    const story = storyFromText(STORY)
    const card1 = story.project.characters.find(character => character.name === 'card1')!
    expect(card1.expressions.map(expression => expression.name)).toEqual(['ace-spades', 'queen-hearts'])
    const expressionName = (runtime: StoryRuntime) => card1.expressions.find(expression => expression.id === runtime.snapshot.stage.characters[0]?.expressionId)?.name
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(expressionName(runtime)).toBe('queen-hearts')
    expect(story.project.backgrounds.find(background => background.id === runtime.snapshot.stage.backgroundId)?.name).toBe('rooftop')
    runtime.next()
    expect(expressionName(runtime)).toBe('ace-spades')
  })

  it('makes the entries of every value, all used, writes back as written, and needs Datajack 2.1', () => {
    const story = storyFromText(STORY)
    expect(story.project.backgrounds.map(background => background.name)).toEqual(['park', 'rooftop'])
    expect(unusedNames(story.project, story.chapters)).toEqual([])
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect(written).toContain('[bg: {Place}]')
    expect(written).toContain('[enter: card1 left {Card}]')
    expect(written).toContain('[card1: {Card}]')
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })

  it('needs a decision, in a tag showing a picture', () => {
    const problems = (lines: string[]) => checkReferences(importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })).map(problem => `${problem.code} ${problem.subject}`)
    expect(problems(['[counter: Coins = 0]', '[decision: Mood = calm | angry]', '[bg: {Coins}]', '[music: {Mood}]', '[marie: {Mod}]', 'Hi.'])).toEqual([
      'tagValueNeedsDecision Coins',
      'tagValueNotHere music: {Mood}',
      'unknownDecision Mod',
    ])
  })
})

describe('a value drawn at random', () => {
  it('is one of the decision’s values, leaving out those another decision holds, which a value named in braces joins', () => {
    const story = storyFromText([
      '[decision: Drawn = one | two | three | four | five]',
      '[decision multi: Dealt = one | two | three | four | five]',
      '[counter: Round = 0]',
      '[loop]',
      '[if: Round is 6]', '[break]', '[end]',
      '[add: Round]',
      '[set: Drawn = random not in Dealt]',
      'You draw {Drawn}.',
      '[set: Dealt = {Drawn}]',
      '[end]',
      'Done.',
    ])
    for (let game = 0; game < 10; game++) {
      const runtime = new StoryRuntime(story)
      runtime.start()
      const drawn: string[] = []
      while (runtime.snapshot.step.type === 'page' && drawn.length < 10) {
        const step = runtime.snapshot.step
        drawn.push(step.page.text)
        runtime.next()
      }
      // Five different cards, then nothing left: the sixth round draws nothing new.
      expect(new Set(drawn.slice(0, 5)).size).toBe(5)
      expect(drawn.at(-1)).toBe('Done.')
    }
    const written = exportText(story.project, story.chapters, { declareDecisions: true })
    expect([written.includes('[set: Drawn = random not in Dealt]'), written.includes('[set: Dealt = {Drawn}]')]).toEqual([true, true])
    expect(playerFormatVersion(story.project, story.chapters)).toBe('2.1')
  })
})

describe('a character showing another’s pictures', () => {
  it('shows the file of the lender’s picture of the same name, the lender naming every picture the borrower does', () => {
    const story = storyFromText(['[character: card1 = card]', '[decision: Card = ace | queen]', '[set: Card = queen]', '[enter: card1 {Card}]', 'Dealt.'])
    const card = story.project.characters.find(character => character.name === 'card')!
    const card1 = story.project.characters.find(character => character.name === 'card1')!
    expect([card1.picturesFrom, card.expressions.map(expression => expression.name)]).toEqual([card.id, ['ace', 'queen']])
    const queen = card.expressions.find(expression => expression.name === 'queen')!
    const withFile = {
      ...story,
      project: { ...story.project, characters: story.project.characters.map(character => character.id === card.id ? { ...character, expressions: character.expressions.map(expression => expression.id === queen.id ? { ...expression, assetId: 'asset-queen' } : expression) } : character) },
      assetUrls: new Map([['asset-queen', 'blob:queen']]),
    }
    const runtime = new StoryRuntime(withFile)
    runtime.start()
    const shown = runtime.snapshot.stage.characters[0]!
    expect(createStageCatalog(withFile).expressionUrl(shown.characterId, shown.expressionId)).toBe('blob:queen')
    expect(exportText(story.project, story.chapters, { declareDecisions: true })).toContain('[character: card1 = card]')
  })
})
