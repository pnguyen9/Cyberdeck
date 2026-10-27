import { describe, expect, it } from 'vitest'
import {
  applyImport,
  assignAsset,
  createProject,
  flattenStoredNodes,
  matchAssetFile,
  moveChapter,
  previewImport,
  removeChapter,
  renameChapter,
  unusedAssetIds,
  updateDetails,
  type ChapterDocument,
  type ProjectDocument,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-26T12:00:00.000Z'

function testEnvironment() {
  let nextId = 1
  return { createId: () => `id-${nextId++}`, now: () => NOW }
}

/** A project with what the text imports, as Cyberdeck builds it import after import. */
function importInto(text: string, project: ProjectDocument, chapters: ChapterDocument[] = [], environment = testEnvironment()) {
  const preview = previewImport(text, project, monospaceLayout)
  expect(preview.problems).toEqual([])
  const applied = applyImport(preview, project, chapters, { type: 'newChapters' }, { fileName: null }, environment)
  return { project: applied.project, chapters: [...chapters, ...applied.chapters] }
}

const pageTexts = (chapter: ChapterDocument) => flattenStoredNodes(chapter.nodes).flatMap(node => node.type === 'page' ? [node.text] : [])

describe('importing into a project', () => {
  it('adds chapters, knowing the characters and decisions already there', () => {
    const environment = testEnvironment()
    const first = importInto(['# One', '[enter: marie]', '— Marie: Hello.', '[choice: Answer]', '> Yes', '> No'].join('\n'), createProject({ name: 'Game', locale: 'en' }, environment), [], environment)
    const preview = previewImport(['# Two', '[marie: smile]', '[if: Answer is A]', '— Marie: Yes!', '[end]'].join('\n'), first.project, monospaceLayout)

    expect(preview.problems).toEqual([])
    const applied = applyImport(preview, first.project, first.chapters, { type: 'newChapters' }, { fileName: 'two.txt' }, environment)
    expect(applied.project.characters.map(character => character.name)).toEqual(['Marie'])
    expect(applied.project.chapterOrder).toHaveLength(2)
    expect(applied.chapters.map(chapter => chapter.title)).toEqual(['Two'])
    expect(applied.project.updatedAt).toBe(NOW)
  })

  it('reports references to decisions the project does not have', () => {
    const preview = previewImport('[if: Mood is Happy]\nHello.\n[end]', createProject({ name: 'Game', locale: 'en' }), monospaceLayout)
    expect(preview.hasErrors).toBe(true)
    expect(() => applyImport(preview, createProject({ name: 'Game', locale: 'en' }), [], { type: 'newChapters' }, { fileName: null })).toThrow('errors')
  })

  it('appends pages to the end of a chapter, without creating one', () => {
    const environment = testEnvironment()
    const first = importInto('# One\nHello.', createProject({ name: 'Game', locale: 'en' }, environment), [], environment)
    const chapter = first.chapters[0]!
    const preview = previewImport('[import: pages]\nGoodbye.', first.project, monospaceLayout)

    const applied = applyImport(preview, first.project, first.chapters, { type: 'endOfChapter', chapterId: chapter.id }, { fileName: null }, environment)

    expect(applied.project.chapterOrder).toEqual([chapter.id])
    expect(applied.chapters.map(pageTexts)).toEqual([['Hello.', 'Goodbye.']])
  })
})

describe('chapters', () => {
  function threeChapters() {
    const environment = testEnvironment()
    return importInto(['# One', 'The end.', '# Two', 'Two.', '# Three', 'Three.'].join('\n'), createProject({ name: 'Game', locale: 'en' }, environment), [], environment)
  }

  it('move within the order', () => {
    const { project } = threeChapters()
    const [one, two, three] = project.chapterOrder
    expect(moveChapter(project, three!, 0, NOW).chapterOrder).toEqual([three, one, two])
    expect(moveChapter(project, one!, 99, NOW).chapterOrder).toEqual([two, three, one])
  })

  it('are renamed, a blank title leaving them untitled', () => {
    const { chapters } = threeChapters()
    expect(renameChapter(chapters[0]!, '  Prologue ', NOW).title).toBe('Prologue')
    expect(renameChapter(chapters[0]!, ' ', NOW).title).toBeNull()
  })

  it('are removed from the order', () => {
    const { project, chapters } = threeChapters()
    expect(removeChapter(project, chapters[2]!.id, NOW).chapterOrder).toEqual([chapters[0]!.id, chapters[1]!.id])
  })
})

describe('assets', () => {
  it('finds files no entry uses any more, the cover counting as a use', () => {
    const environment = testEnvironment()
    let { project } = importInto('[bg: street]\nHello.', createProject({ name: 'Game', locale: 'en' }, environment), [], environment)
    const target = matchAssetFile('street.png', 'image/png', project)!
    project = assignAsset(project, target, { id: 'old', fileName: 'street.png', mediaType: 'image/png', byteSize: 1 })
    project = assignAsset(project, target, { id: 'new', fileName: 'street.png', mediaType: 'image/png', byteSize: 1 })
    project = { ...project, assets: [...project.assets, { id: 'cover', fileName: 'cover.png', mediaType: 'image/png', byteSize: 1 }] }

    expect(unusedAssetIds(project)).toEqual(['old', 'cover'])
    expect(unusedAssetIds(updateDetails(project, { coverAssetId: 'cover' }, NOW))).toEqual(['old'])
  })
})
