import { describe, expect, it } from 'vitest'
import { applyDefinitions, checkProjectDocument, checkReferences, definitionsText, hasJournal, importText, journalOf, playerFormatVersion, previewDefinitions, setShown, shownWhen } from '../../src/index'
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

describe('what is shown while not zero', () => {
  const WHILE_NOT_ZERO = ['[decision multi: Bag = Key | Lamp]', '[counter: Luck]', '[counter: Level = 1]', '[shown: Level]', '[shown while not zero: Luck, Bag]', 'Hello.']

  it('is said among the definitions, a decision there shown as with [shown], and written back', () => {
    const { project, chapters } = storyFromText(WHILE_NOT_ZERO)
    const bag = project.decisions[0]!.id
    const [luck, level] = project.counters.map(counter => counter.id)
    expect(project.shown).toEqual({ always: [level, bag], afterAnEnding: [], whileNotZero: [luck], endings: null })
    expect(definitionsText(project, chapters).split('\n').filter(line => line.startsWith('[shown'))).toEqual(['[shown: Level, Bag]', '[shown while not zero: Luck]'])
    expect(checkReferences(importText(WHILE_NOT_ZERO.join('\n'), { layout: monospaceLayout, locale: 'en' }))).toEqual([])
  })

  it('takes the endings reached as shown once one is, none being shown until then', () => {
    const { project } = storyFromText(['[shown while not zero: endings reached]', '[ending: Home]', 'Hello.'])
    expect(project.shown.endings).toBe('afterAnEnding')
  })

  it('reports a name neither a decision nor a counter', () => {
    const imported = importText('[counter: Luck]\n[shown while not zero: Lcuk]\nHello.', { layout: monospaceLayout, locale: 'en' })
    expect(checkReferences(imported).map(problem => `${problem.line} ${problem.code} ${problem.subject}`)).toEqual(['2 unknownShown Lcuk'])
  })

  it('shows a counter in the journal only while it is not 0, a counter shown always even at 0', () => {
    const { project } = storyFromText(WHILE_NOT_ZERO)
    const [luck, level] = project.counters.map(counter => counter.id) as [string, string]
    const names = (counters: Record<string, number>) => journalOf(project, { decisions: {}, counters, names: {} }, []).entries.map(entry => `${entry.name}: ${entry.items.join(', ')}`)
    expect(names({})).toEqual(['Level: 1'])
    expect(names({ [luck]: 2, [level]: 0 })).toEqual(['Level: 0', 'Luck: 2'])
    expect(names({ [luck]: -1 })).toEqual(['Level: 1', 'Luck: -1'])
    expect(names({ [luck]: 0 })).toEqual(['Level: 1'])
  })

  it('makes a journal of a story showing nothing else, even while every counter is 0', () => {
    const { project } = storyFromText(['[counter: Luck]', '[shown while not zero: Luck]', 'Hello.'])
    expect(hasJournal(project, [])).toBe(true)
    expect(journalOf(project, { decisions: {}, counters: {}, names: {} }, []).entries).toEqual([])
  })

  it('is a choice of the Index, moving the counter from one way of showing it to another', () => {
    const { project } = storyFromText(WHILE_NOT_ZERO)
    const [luck, level] = project.counters.map(counter => counter.id) as [string, string]
    expect([shownWhen(project, luck), shownWhen(project, level)]).toEqual(['whileNotZero', 'always'])
    const moved = setShown(setShown(project, luck, 'always', 'now'), level, 'whileNotZero', 'now')
    expect(moved.shown).toEqual({ always: [project.decisions[0]!.id, luck], afterAnEnding: [], whileNotZero: [level], endings: null })
    expect(setShown(moved, level, null, 'now').shown).not.toHaveProperty('whileNotZero')
  })

  it('is kept by the project document, which a project from before 3.7 reads without', () => {
    const { project } = storyFromText(WHILE_NOT_ZERO)
    expect(checkProjectDocument(JSON.parse(JSON.stringify(project)), 'project').shown).toEqual(project.shown)
    const { whileNotZero: _counters, ...older } = project.shown
    expect(checkProjectDocument({ ...project, shown: older }, 'project').shown).toEqual(older)
  })

  it('needs Datajack 3.7, which an older Datajack would leave out of the journal', () => {
    const story = storyFromText(WHILE_NOT_ZERO)
    expect(playerFormatVersion(story.project, story.chapters)).toBe('3.7')
    const plain = storyFromText(STORY)
    expect(playerFormatVersion(plain.project, plain.chapters)).not.toBe('3.7')
  })
})
