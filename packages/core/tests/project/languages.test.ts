import { describe, expect, it } from 'vitest'
import {
  applyImport,
  chapterIn,
  createGameArchive,
  createProject,
  languageCode,
  languagesOf,
  previewImport,
  projectIn,
  readGameArchive,
  withTextOf,
  type ChapterDocument,
  type ProjectDocument,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const ENGLISH = `[import: story]
# The Letter
[choice: Answer]
> Yes = Accept
> No = Refuse
The classroom was empty.
[play: Caught]
# The Roof
The wind was cold.
# Scene: Caught
Caught!
[ending: The Empty Room]`

const FRENCH = `[import: story fr]
# La Lettre
[choice: Answer]
> Oui = Accept
> Non = Refuse
La salle était vide.
[play: Caught]
# Scene: Caught
Pris !
[ending: The Empty Room = La Chambre vide]`

/** Imports a text in a language as the editor does: chapters as views in it, put back in their documents. */
function importIn(text: string, project: ProjectDocument, stored: readonly ChapterDocument[], language: string) {
  const views = [...project.chapterOrder, ...project.sceneOrder].map(id => chapterIn(stored.find(chapter => chapter.id === id)!, language, project))
  const preview = previewImport(text, project, monospaceLayout, { language, scenes: views, documents: views })
  expect(preview.problems.filter(problem => problem.severity === 'error')).toEqual([])
  const applied = applyImport(preview, project, views.filter(view => project.chapterOrder.includes(view.id)), { type: 'newChapters' }, { fileName: null })
  const byId = new Map(stored.map(chapter => [chapter.id, chapter]))
  for (const chapter of applied.chapters) {
    byId.set(chapter.id, withTextOf(byId.get(chapter.id), chapter, applied.project))
  }
  return { project: applied.project, chapters: [...byId.values()] }
}

function storyInTwoLanguages() {
  const english = importIn(ENGLISH, createProject({ name: 'Letter', locale: 'en' }), [], 'en')
  return { english, both: importIn(FRENCH, english.project, english.chapters, 'fr') }
}

describe('a story in several languages', () => {
  it('lays a translation over the chapters by their place, the scenes by their name, leaving the rest hollow', () => {
    const { english, both } = storyInTwoLanguages()
    expect(languagesOf(both.project)).toEqual(['en', 'fr'])
    expect(both.project.chapterOrder).toEqual(english.project.chapterOrder)
    expect(both.project.sceneOrder).toEqual(english.project.sceneOrder)
    const [letter, roof] = both.project.chapterOrder.map(id => both.chapters.find(chapter => chapter.id === id)!)
    expect(chapterIn(letter!, 'en', both.project).title).toBe('The Letter')
    expect(chapterIn(letter!, 'fr', both.project).title).toBe('La Lettre')
    expect(chapterIn(roof!, 'fr', both.project)).toMatchObject({ title: 'The Roof', hollow: true, nodes: [] })
    const scene = both.chapters.find(chapter => chapter.id === both.project.sceneOrder[0])!
    expect(chapterIn(scene, 'fr', both.project).nodes.some(node => node.type === 'page' && node.text === 'Pris !')).toBe(true)
  })

  it('shares the names: the same decision, its values given by options of each language; an ending read in each', () => {
    const { both } = storyInTwoLanguages()
    expect(both.project.decisions.map(decision => decision.values.map(value => value.name))).toEqual([['Accept', 'Refuse']])
    expect(both.project.endings).toEqual([{ id: expect.any(String), name: 'The Empty Room', translations: { fr: 'La Chambre vide' } }])
    expect(projectIn(both.project, 'fr').endings[0]!.name).toBe('La Chambre vide')
    expect(projectIn(both.project, 'en').endings[0]!.name).toBe('The Empty Room')
  })

  it('takes a chapter new to the story from any language, hollow in the others', () => {
    const { both } = storyInTwoLanguages()
    const more = importIn('# Le Toit\nLe vent.\n# Le Retour\nRetour.', both.project, both.chapters, 'fr')
    // The roof was hollow in French: the first new chapter fills it, the second is new to the story.
    expect(more.project.chapterOrder.length).toBe(3)
    const added = more.chapters.find(chapter => chapter.id === more.project.chapterOrder[2])!
    expect([chapterIn(added, 'fr', more.project).title, chapterIn(added, 'en', more.project).hollow]).toEqual(['Le Retour', true])
  })

  it('ships only languages with a text for every chapter shipped and every scene, the first always', async () => {
    const { both } = storyInTwoLanguages()
    const archive = (includedChapterIds: readonly string[], languages?: readonly string[]) => createGameArchive({
      project: both.project, chapters: both.chapters, includedChapterIds, ...(languages === undefined ? {} : { languages }), readAsset: async () => new Uint8Array(), release: '1.0', exportedAt: new Date('2026-11-05T10:00:00Z'),
    })
    await expect(archive(both.project.chapterOrder)).rejects.toThrow('The Roof is not written in fr yet')
    await expect(archive(both.project.chapterOrder, ['fr'])).rejects.toThrow('first language')
    const english = await readGameArchive(await archive(both.project.chapterOrder, ['en']))
    expect([english.manifest.project.languages, english.manifest.project.formatVersion]).toEqual([['en'], '1.1'])
    const game = await readGameArchive(await archive([both.project.chapterOrder[0]!]))
    expect([game.manifest.project.languages, game.manifest.project.formatVersion]).toEqual([['en', 'fr'], '2.0'])
    expect(chapterIn(game.chapters[0]!, 'fr', game.manifest.project).title).toBe('La Lettre')
  })

  it('knows a language by its standard code, language, script and region only, and no made-up one', () => {
    expect(['fr', 'pt-br', 'zh-Hant', 'en-US-POSIX', 'zh-Hant-TW-x-foo', 'fr-XX', 'zxx', 'xx', 'french', ''].map(languageCode))
      .toEqual(['fr', 'pt-BR', 'zh-Hant', 'en-US', 'zh-Hant-TW', null, null, null, null, null])
  })

  it('lays a whole story in another language over the story by place, translated chapters included', () => {
    const { both } = storyInTwoLanguages()
    const whole = importIn('[import: story fr]\n# La Lettre encore\nVide.\n# Le Toit\nLe vent.', both.project, both.chapters, 'fr')
    expect(whole.project.chapterOrder).toEqual(both.project.chapterOrder)
    expect(whole.project.chapterOrder.map(id => chapterIn(whole.chapters.find(chapter => chapter.id === id)!, 'fr', whole.project).title)).toEqual(['La Lettre encore', 'Le Toit'])
  })

  it('keeps a chapter hollow when only its title or its condition changes', () => {
    const { both } = storyInTwoLanguages()
    const roof = both.chapters.find(chapter => chapter.id === both.project.chapterOrder[1])!
    const renamed = withTextOf(roof, { ...chapterIn(roof, 'fr', both.project), title: 'Le Toit' }, both.project)
    expect(chapterIn(renamed, 'fr', both.project)).toMatchObject({ title: 'Le Toit', hollow: true })
    const hollowInFirst = withTextOf(undefined, { ...roof, id: 'new', title: 'Nouveau', nodes: [], language: 'fr' } as ChapterDocument, both.project)
    const { translations: _translations, ...firstText } = hollowInFirst
    const conditioned = withTextOf(hollowInFirst, firstText, both.project)
    expect(chapterIn(conditioned, 'en', both.project).hollow).toBe(true)
  })
})
