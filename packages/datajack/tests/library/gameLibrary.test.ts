import {
  assignAsset,
  createGameArchive,
  createProject,
  importText,
  matchAssetFile,
  storeImport,
  StoryRuntime,
  type ProjectDocument,
} from '@cyberdeck/core'
import { describe, expect, it } from 'vitest'
import { GameLibrary } from '../../src/library/gameLibrary'
import { memoryLibraryStorage } from './memoryLibraryStorage'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

const STORY = ['# One', '[bg: street]', 'Hello.', '# Two', '[bg: rooftop]', 'Goodbye.'].join('\n')

/** One game, from which archives are exported at various dates with various chapters. */
function buildGame(name = 'The Letter', idPrefix = 'id') {
  let nextId = 1
  const environment = { createId: () => `${idPrefix}-${nextId++}`, now: () => '2026-10-26T09:00:00.000Z' }
  const stored = storeImport(importText(STORY, { layout: monospaceLayout, locale: 'en' }), createProject({ name, locale: 'en' }, environment), { fileName: null }, environment)
  let project: ProjectDocument = stored.project
  for (const [fileName, byte] of [['street.png', 1], ['rooftop.png', 2]] as const) {
    project = assignAsset(project, matchAssetFile(fileName, 'image/png', project)!, { id: `asset-${byte}`, fileName, mediaType: 'image/png', byteSize: 1 })
  }
  const [one, two] = stored.chapters
  return {
    one: one!,
    two: two!,
    export: (options: { chapters?: string[]; exportedAt: string; release?: string; rename?: string }) => createGameArchive({
      project: options.rename === undefined ? project : { ...project, name: options.rename },
      chapters: stored.chapters,
      includedChapterIds: options.chapters ?? project.chapterOrder,
      readAsset: async asset => new Uint8Array([asset.id === 'asset-1' ? 1 : 2]),
      release: options.release ?? '1.0',
      exportedAt: new Date(options.exportedAt),
    }),
  }
}

describe('GameLibrary', () => {
  it('installs a game and plays it', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)

    const outcome = await library.install(await game.export({ exportedAt: '2026-10-01' }))

    expect(outcome).toEqual({ gameName: 'The Letter', release: '1.0', isNewGame: true, addedChapters: ['One', 'Two'], updatedChapters: [], wasOlder: false })
    expect(await library.list()).toEqual([{
      id: 'id-1',
      name: 'The Letter',
      release: '1.0',
      description: '',
      credits: '',
      coverUrl: null,
      endingCount: 0,
      illustrationCount: 0,
      chapters: [{ id: game.one.id, title: 'One', included: true }, { id: game.two.id, title: 'Two', included: true }],
    }])
    const story = await library.open('id-1')
    expect(story.assetUrls.size).toBe(2)
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Hello.')
  })

  it('installs the scenes with any chapter, and plays them where the chapters say', async () => {
    let nextId = 1
    const environment = { createId: () => `scene-game-${nextId++}`, now: () => '2026-10-26T09:00:00.000Z' }
    const exportWith = (sceneText: string, exportedAt: string) => {
      const text = ['# One', 'Hello.', '# Two', '[play: Farewell]', 'After.', '# Scene: Farewell', sceneText].join('\n')
      nextId = 1
      const stored = storeImport(importText(text, { layout: monospaceLayout, locale: 'en' }), createProject({ name: 'Scenes', locale: 'en' }, environment), { fileName: null }, environment)
      return createGameArchive({
        project: stored.project,
        chapters: [...stored.chapters, ...stored.scenes],
        includedChapterIds: [stored.chapters[1]!.id],
        readAsset: async () => new Uint8Array([0]),
        release: exportedAt,
        exportedAt: new Date(exportedAt),
      })
    }
    const library = new GameLibrary(memoryLibraryStorage().storage)
    const pagesOf = async () => {
      const runtime = new StoryRuntime(await library.open((await library.list())[0]!.id))
      runtime.start()
      const texts: string[] = []
      for (let step = runtime.snapshot.step; step.type === 'page'; step = runtime.snapshot.step) {
        texts.push(step.page.text)
        runtime.next()
      }
      return texts
    }

    await library.install(await exportWith('Bye.', '2026-10-26T10:00:00Z'))
    expect(await pagesOf()).toEqual(['Bye.', 'After.'])
    await library.install(await exportWith('Bye for now.', '2026-10-27T10:00:00Z'))
    expect(await pagesOf()).toEqual(['Bye for now.', 'After.'])
    await library.install(await exportWith('An older goodbye.', '2026-10-20T10:00:00Z'))
    expect(await pagesOf()).toEqual(['Bye for now.', 'After.'])
  })

  it('adds the chapters of a later release to those installed', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.one.id], exportedAt: '2026-10-01' }))

    const outcome = await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-11-01', release: '1.1' }))

    expect(outcome).toMatchObject({ isNewGame: false, addedChapters: ['Two'], updatedChapters: [], release: '1.1' })
    expect((await library.list())[0]?.chapters.map(chapter => chapter.included)).toEqual([true, true])
    const runtime = new StoryRuntime(await library.open('id-1'))
    runtime.start()
    runtime.next()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Goodbye.')
  })

  it('shows which chapters are missing when only a later one is installed', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-10-01' }))

    expect((await library.list())[0]?.chapters).toEqual([
      { id: game.one.id, title: 'One', included: false },
      { id: game.two.id, title: 'Two', included: true },
    ])
    const runtime = new StoryRuntime(await library.open('id-1'))
    runtime.start()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Goodbye.')
  })

  it('keeps the newer release when an older archive is installed after it, taking only missing chapters', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-11-01', release: '1.1', rename: 'The Letter (revised)' }))

    const outcome = await library.install(await game.export({ exportedAt: '2026-10-01', release: '1.0' }))

    expect(outcome).toMatchObject({ addedChapters: ['One'], updatedChapters: [], wasOlder: true, release: '1.1' })
    expect((await library.list())[0]).toMatchObject({ name: 'The Letter (revised)', release: '1.1' })
  })

  it('stores each asset file once, however many archives bring it', async () => {
    const game = buildGame()
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await library.install(await game.export({ exportedAt: '2026-10-01' }))
    await library.install(await game.export({ exportedAt: '2026-11-01' }))

    expect(memory.assetWrites).toBe(2)
  })

  it('removes a game and the files no other game uses', async () => {
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await library.install(await buildGame().export({ exportedAt: '2026-10-01' }))
    const other = buildGame('Another Letter', 'other')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }))
    expect(memory.assets.size).toBe(2)

    await library.remove('id-1')

    expect((await library.list()).map(entry => entry.name)).toEqual(['Another Letter'])
    expect(memory.assets.size).toBe(1)
  })

  it('refuses a file that is not a game, installing nothing', async () => {
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await expect(library.install(new TextEncoder().encode('not an archive'))).rejects.toThrow('This file is not a ZIP archive')
    expect(await library.list()).toEqual([])
  })
})
