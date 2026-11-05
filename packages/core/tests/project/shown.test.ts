import { describe, expect, it } from 'vitest'
import { applyDefinitions, checkReferences, definitionsText, importText, previewDefinitions } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'
import { storyFromText } from '../runtime/storyFromText'

const STORY = ['[decision multi: Bag = Key | Lamp]', '[counter: Trust]', '[shown: Bag, endings reached]', '[shown after an ending: Trust]', 'Hello.']

describe('what players may see', () => {
  it('is said among the definitions, names listed with commas, and written back there', () => {
    const { project, chapters } = storyFromText(STORY)
    const bag = project.decisions[0]!.id
    const trust = project.counters[0]!.id
    expect(project.shown).toEqual({ always: [bag], afterAnEnding: [trust], endings: 'always' })
    expect(definitionsText(project, chapters).split('\n').filter(line => line.startsWith('[shown'))).toEqual(['[shown: Bag, endings reached]', '[shown after an ending: Trust]'])
  })

  it('is what the definitions say once edited: a name taken out of them is no longer shown', () => {
    const { project, chapters } = storyFromText(STORY)
    const text = definitionsText(project, chapters).replace('[shown: Bag, endings reached]', '[shown: Bag]')
    const edited = applyDefinitions(previewDefinitions(text, project, chapters, monospaceLayout), project)
    expect([edited.shown.always.length, edited.shown.endings]).toEqual([1, null])
  })

  it('names only decisions and counters, or the endings reached', () => {
    const imported = importText('[counter: Trust]\n[shown: Trsut]\nHello.', { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported).map(problem => `${problem.line} ${problem.code} ${problem.subject}`)).toEqual(['2 unknownShown Trsut'])
  })
})

describe('the journal', () => {
  it('shows what the author chose, a bag while it holds items, and more once an ending is reached', async () => {
    const { journalOf, hasJournal } = await import('../../src/index')
    const { project } = storyFromText([...STORY.slice(0, -1), '[ending: Home]', '[ending: Away]', 'Hello.'])
    const bag = project.decisions[0]!
    const trust = project.counters[0]!
    const holding = { decisions: { [bag.id]: [bag.values[1]!.id] }, counters: { [trust.id]: 3 }, names: {} }
    expect(journalOf(project, { decisions: {}, counters: {}, names: {} }, [])).toEqual({ entries: [], endings: { reached: [], total: 2 } })
    expect(journalOf(project, holding, []).entries.map(entry => `${entry.name}: ${entry.items.join(', ')}`)).toEqual(['Bag: Lamp'])
    const home = project.endings[0]!.id
    expect(journalOf(project, holding, [home])).toEqual({
      entries: [{ id: bag.id, name: 'Bag', kind: 'decision', items: ['Lamp'] }, { id: trust.id, name: 'Trust', kind: 'counter', items: ['3'] }],
      endings: { reached: ['Home'], total: 2 },
    })
    expect(hasJournal({ ...project, shown: { always: [], afterAnEnding: [trust.id], endings: null } }, [])).toBe(false)
  })
})
