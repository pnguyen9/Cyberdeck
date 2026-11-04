import { CHAPTER_START, flattenStoredNodes, moveNodes, previewImport, previewNodeEdit, readGameArchive, removeNodes, StoryRuntime, type ChapterDocument } from '@cyberdeck/core'
import { describe, expect, it } from 'vitest'
import { createNewProject, createProjectWithoutStory, listProjects, OpenProject, restoreBackup } from '../../src/projects/openProject'
import { memoryProjectStore } from './memoryProjectStore'

const layout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }
const NOW = '2026-10-26T12:00:00.000Z'

function testEnvironment() {
  let nextId = 1
  return { createId: () => `id-${nextId++}`, now: () => NOW }
}

async function projectWith(text: string) {
  const memory = memoryProjectStore()
  const environment = testEnvironment()
  const created = await createNewProject(memory.store, 'The Letter', 'en', environment)
  const open = await OpenProject.open(memory.store, created.id, environment)
  const preview = previewImport(text, open.project, layout)
  expect(preview.problems).toEqual([])
  await open.importText(preview, { type: 'newChapters' }, 'letter.txt')
  return { ...memory, open, environment }
}

const file = (name: string, mediaType: string, byte: number) => ({ name, mediaType, bytes: new Uint8Array([byte]) })
const pageTexts = (chapter: ChapterDocument | undefined) => flattenStoredNodes(chapter?.nodes ?? []).flatMap(node => node.type === 'page' ? [node.text] : [])

describe('projects', () => {
  it('keep what was imported, as found when opened again', async () => {
    const { store, open, environment } = await projectWith('# One\nHello.\n# Two\nGoodbye.')

    const reopened = await OpenProject.open(store, open.project.id, environment)
    expect(reopened.project).toEqual(open.project)
    expect(reopened.chapters.map(chapter => chapter.title)).toEqual(['One', 'Two'])
    expect(reopened.chapters[0]?.importedFrom?.fileName).toBe('letter.txt')
    expect((await listProjects(store)).map(project => project.name)).toEqual(['The Letter'])
  })

  it('give files to the entries named like them, deleting the files they replace', async () => {
    const { open, assets } = await projectWith('[bg: street] [music: calm]\n[enter: marie]\nHello.')

    const matches = await open.addFiles([file('street.png', 'image/png', 1), file('marie.png', 'image/png', 2), file('notes.png', 'image/png', 3), file('script.js', 'text/javascript', 4)])
    expect(matches).toEqual([
      { fileName: 'street.png', entry: 'Background street' },
      { fileName: 'marie.png', entry: 'marie, normal' },
      { fileName: 'notes.png', entry: null },
      { fileName: 'script.js', entry: null },
    ])
    expect(assets.size).toBe(2)

    await open.addFiles([file('Street.webp', 'image/webp', 5)])
    expect(assets.size).toBe(2)
    expect(open.project.assets.map(asset => asset.fileName).sort()).toEqual(['Street.webp', 'marie.png'])
  })

  it('take a cover, and delete its file when it is removed', async () => {
    const { open, assets } = await projectWith('Hello.')
    await open.setCover(file('cover.png', 'image/png', 9))
    expect(open.project.details.coverAssetId).not.toBeNull()
    expect(assets.size).toBe(1)

    await open.setCover(null)
    expect(open.project.details.coverAssetId).toBeNull()
    expect(assets.size).toBe(0)
    await expect(open.setCover(file('cover.mp3', 'audio/mpeg', 1))).rejects.toThrow('a cover must be')
  })

  it('rename, move and remove chapters, deleting the documents of removed ones', async () => {
    const { open, chapters } = await projectWith('# One\nHello.\n# Two\nGoodbye.\n# Three\nAgain.')
    const [one, two, three] = open.chapters

    await open.renameChapter(one!.id, 'Prologue')
    await open.moveChapter(three!.id, 0)
    await open.removeChapter(two!.id)

    expect(open.chapters.map(chapter => chapter.title)).toEqual(['Three', 'Prologue'])
    expect(chapters.size).toBe(2)
  })

  it('apply a condition to a whole route as one change, undone at once', async () => {
    const { open } = await projectWith('# One\n[choice: Route]\n> Marie = Marie\n> Jules = Jules\n# Two\nA.\n# Three\nB.')
    const [, two, three] = open.chapters
    const condition = { type: 'is' as const, decisionId: open.project.decisions[0]!.id, valueId: open.project.decisions[0]!.values[0]!.id, negated: false }
    await open.setChapterConditions([two!.id, three!.id], condition)
    expect(open.chapters.map(chapter => chapter.condition !== undefined)).toEqual([false, true, true])
    await open.undo()
    expect(open.chapters.map(chapter => chapter.condition !== undefined)).toEqual([false, false, false])
  })

  it('add a chapter where it is asked', async () => {
    const { open } = await projectWith('# One\nA.\n# Two\nB.\n# Three\nC.')
    await open.addEmptyDocument('chapter', 'New', 1)
    expect(open.chapters.map(chapter => chapter.title)).toEqual(['One', 'New', 'Two', 'Three'])
  })

  it('forget the undo that would bring back a name removed with its file', async () => {
    const { open, assets } = await projectWith('# One\nA.\n# Two\n[bg: street]\nB.')
    await open.addFiles([file('street.png', 'image/png', 1)])
    await open.removeChapter(open.chapters[1]!.id)
    expect(open.unusedNamesKept.map(name => name.name)).toEqual(['street'])
    await open.removeUnusedName(open.unusedNamesKept[0]!)
    expect([assets.size, open.canUndo]).toEqual([0, false])
  })

  it('put a removed chapter back where it stood with undo', async () => {
    const { open, chapters } = await projectWith('# One\nHello.\n# Two\nGoodbye.\n# Three\nAgain.')
    const two = open.chapters[1]!

    await open.removeChapter(two.id)
    expect(await open.undo()).toBe(two.id)

    expect(open.chapters.map(chapter => chapter.title)).toEqual(['One', 'Two', 'Three'])
    expect(open.chapters[1]!.nodes).toEqual(two.nodes)
    expect(chapters.size).toBe(3)
    expect(open.canUndo).toBe(false)
  })

  it('append imported pages to a chapter', async () => {
    const { open } = await projectWith('# One\nHello.')
    const preview = previewImport('[import: pages]\nGoodbye.', open.project, layout)
    await open.importText(preview, { type: 'endOfChapter', chapterId: open.chapters[0]!.id }, null)
    expect(open.chapters.map(pageTexts)).toEqual([['Hello.', 'Goodbye.']])
  })

  it('export the game players download, with the files it uses', async () => {
    const { open } = await projectWith('# One\n[bg: street]\nHello.\n# Two\nGoodbye.')
    await open.addFiles([file('street.png', 'image/png', 1)])
    await open.updateDetails({ description: 'A letter.' })

    const archive = await readGameArchive(await open.exportGame('1.0', [open.chapters[0]!.id], new Date(NOW)))

    expect(archive.manifest.project.details.description).toBe('A letter.')
    expect(archive.manifest.chapters.map(chapter => chapter.included)).toEqual([true, false])
    expect(archive.assetFiles.get('assets/backgrounds/street.png')).toEqual(new Uint8Array([1]))
  })

  it('back up and restore the whole project, replacing the one of the same identifier', async () => {
    const { open } = await projectWith('# One\n[bg: street]\nHello.')
    await open.addFiles([file('street.png', 'image/png', 1)])
    const backup = await open.backup(new Date(NOW))

    const elsewhere = memoryProjectStore()
    const restored = await restoreBackup(elsewhere.store, backup)
    await restoreBackup(elsewhere.store, backup)

    const reopened = await OpenProject.open(elsewhere.store, restored.id)
    expect(reopened.project).toEqual(open.project)
    expect(reopened.chapters).toEqual(open.chapters)
    expect(await elsewhere.store.readAsset(restored.id, open.project.assets[0]!.id)).toEqual(new Uint8Array([1]))
    expect((await listProjects(elsewhere.store))).toHaveLength(1)
  })

  it('copy a project without its story, its files with it, for a translation', async () => {
    const { open, store } = await projectWith('# One\n[bg: street]\nHello.')
    await open.addFiles([file('street.png', 'image/png', 1)])
    const copy = await createProjectWithoutStory(store, open.project, 'La Lettre', 'fr')
    const reopened = await OpenProject.open(store, copy.id)
    expect([reopened.project.name, reopened.project.locale, reopened.chapters.length]).toEqual(['La Lettre', 'fr', 0])
    expect(reopened.project.backgrounds.map(background => background.name)).toEqual(['street'])
    expect(await store.readAsset(copy.id, open.project.assets[0]!.id)).toEqual(new Uint8Array([1]))
    expect(await listProjects(store)).toHaveLength(2)
  })

  it('preview from a chapter', async () => {
    const { open } = await projectWith('# One\nHello.\n# Two\nGoodbye.')
    const runtime = new StoryRuntime(await open.playable(open.chapters[1]!.id))
    runtime.start()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Goodbye.')
  })

  it('store storyboard changes and undo them, latest first', async () => {
    const { store, open, environment } = await projectWith('# One\nA.\nB.\nC.')
    const chapter = () => open.chapters[0]!
    const pageId = (text: string) => flattenStoredNodes(chapter().nodes).find(node => node.type === 'page' && node.text === text)!.id

    await open.replaceChapter(moveNodes(chapter(), [pageId('C.')], CHAPTER_START, NOW))
    await open.replaceChapter(removeNodes(chapter(), [pageId('A.')], NOW))
    expect(pageTexts(chapter())).toEqual(['C.', 'B.'])
    expect(pageTexts((await OpenProject.open(store, open.project.id, environment)).chapters[0])).toEqual(['C.', 'B.'])

    expect(await open.undo()).toBe(chapter().id)
    expect(pageTexts(chapter())).toEqual(['C.', 'A.', 'B.'])
    await open.undo()
    expect(pageTexts(chapter())).toEqual(['A.', 'B.', 'C.'])
    expect(open.canUndo).toBe(false)
    expect(await open.undo()).toBeNull()
  })

  it('forget the names the text no longer uses, once no undo can bring them back, and offer those with a file', async () => {
    const { open } = await projectWith('# One\n[music: calm] [bg: street]\nA.\n[choice: Answer]\n> Yes\n> No\nB.')
    await open.addFiles([file('street.png', 'image/png', 1)])
    const chapter = () => open.chapters[0]!
    const page = flattenStoredNodes(chapter().nodes).find(node => node.type === 'page' && node.text === 'A.')!
    const choice = flattenStoredNodes(chapter().nodes).find(node => node.type === 'choice')!
    const pageTarget = { type: 'replace' as const, nodeId: page.id }
    await open.editNodes(chapter().id, previewNodeEdit('[music: loud]\nA.', open.project, open.chapters, chapter().id, pageTarget, layout), pageTarget)
    const choiceTarget = { type: 'replace' as const, nodeId: choice.id }
    await open.editNodes(chapter().id, previewNodeEdit('[choice: Answer]\n> Yes = Accept\n> No = Refuse', open.project, open.chapters, chapter().id, choiceTarget, layout), choiceTarget)

    // The undo steps still name calm, A and B: they stay until those steps go.
    expect(open.project.music.map(track => track.name)).toEqual(['calm', 'loud'])
    while (open.canUndo) {
      await open.undo()
    }
    await open.editNodes(chapter().id, previewNodeEdit('A, at last.', open.project, open.chapters, chapter().id, pageTarget, layout), pageTarget)
    expect(open.project.music.map(track => track.name)).toEqual(['calm'])
    expect(open.project.decisions[0]?.values.map(value => value.name)).toEqual(['A', 'B'])

    // A background with a file is not thrown away unasked: it is offered.
    const street = { type: 'replace' as const, nodeId: page.id }
    await open.editNodes(chapter().id, previewNodeEdit('A, without the street.', open.project, open.chapters, chapter().id, street, layout), street)
    expect(open.unusedNamesKept.map(name => `${name.kind} ${name.name}`)).toEqual(['background street'])
    await open.removeUnusedName(open.unusedNamesKept[0]!)
    expect([open.project.backgrounds, open.project.assets]).toEqual([[], []])
  })

  it('store pages edited as text, new characters included, and undo them', async () => {
    const { store, open, environment } = await projectWith('# One\nA.\nB.')
    const chapter = () => open.chapters[0]!
    const pageId = flattenStoredNodes(chapter().nodes).find(node => node.type === 'page' && node.text === 'B.')!.id
    const target = { type: 'replace' as const, nodeId: pageId }

    const preview = previewNodeEdit('— Jules: B, said by Jules.', open.project, open.chapters, chapter().id, target, layout)
    expect(await open.editNodes(chapter().id, preview, target)).toEqual([pageId])

    const reopened = await OpenProject.open(store, open.project.id, environment)
    expect(pageTexts(reopened.chapters[0])).toEqual(['A.', 'B, said by Jules.'])
    expect(reopened.project.characters.map(character => character.name)).toEqual(['Jules'])
    await open.undo()
    expect(pageTexts(chapter())).toEqual(['A.', 'B.'])
  })
})
