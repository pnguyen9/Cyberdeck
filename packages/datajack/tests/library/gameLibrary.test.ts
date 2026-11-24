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
import { describe, expect, it, vi } from 'vitest'
import { GameLibrary } from '../../src/library/gameLibrary'
import { memoryLibraryStorage } from './memoryLibraryStorage'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

/** The profile adding the games, when only one is needed. */
const ME = 'sam'

const STORY = ['# One', '[bg: street]', 'Hello.', '# Two', '[bg: rooftop]', 'Goodbye.'].join('\n')

/** One game, from which archives are exported at various dates with various chapters. */
function buildGame(name = 'The Letter', idPrefix = 'id', story = STORY) {
  let nextId = 1
  const environment = { createId: () => `${idPrefix}-${nextId++}`, now: () => '2026-10-26T09:00:00.000Z' }
  const stored = storeImport(importText(story, { layout: monospaceLayout, locale: 'en' }), createProject({ name, locale: 'en' }, environment), { fileName: null }, environment)
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

    const outcome = await library.install(await game.export({ exportedAt: '2026-10-01' }), ME)

    expect(outcome).toEqual({ gameName: 'The Letter', release: '1.0', isNewGame: true, addedChapters: ['One', 'Two'], updatedChapters: [], wasOlder: false })
    expect(await library.list(ME)).toEqual([{
      id: 'id-1',
      name: 'The Letter',
      release: '1.0',
      description: '',
      credits: '',
      coverUrl: null,
      endingCount: 0,
      illustrationCount: 0,
      chapters: [{ id: game.one.id, title: 'One', included: true }, { id: game.two.id, title: 'Two', included: true }],
      languages: ['en'],
    }])
    const story = await library.open('id-1', ME)
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
      const runtime = new StoryRuntime(await library.open((await library.list(ME))[0]!.id, ME))
      runtime.start()
      const texts: string[] = []
      for (let step = runtime.snapshot.step; step.type === 'page'; step = runtime.snapshot.step) {
        texts.push(step.page.text)
        runtime.next()
      }
      return texts
    }

    await library.install(await exportWith('Bye.', '2026-10-26T10:00:00Z'), ME)
    expect(await pagesOf()).toEqual(['Bye.', 'After.'])
    await library.install(await exportWith('Bye for now.', '2026-10-27T10:00:00Z'), ME)
    expect(await pagesOf()).toEqual(['Bye for now.', 'After.'])
    await library.install(await exportWith('An older goodbye.', '2026-10-20T10:00:00Z'), ME)
    expect(await pagesOf()).toEqual(['Bye for now.', 'After.'])
  })

  it('gives no title for a chapter without one, for the report to name in the player’s language', async () => {
    const game = buildGame('The Letter', 'id', ['[bg: street]', 'Hello.', '# Two', '[bg: rooftop]', 'Goodbye.'].join('\n'))
    const library = new GameLibrary(memoryLibraryStorage().storage)

    expect(await library.install(await game.export({ exportedAt: '2026-10-01' }), ME)).toMatchObject({ addedChapters: [null, 'Two'] })
  })

  it('adds the chapters of a later release to those installed', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.one.id], exportedAt: '2026-10-01' }), ME)

    const outcome = await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-11-01', release: '1.1' }), ME)

    expect(outcome).toMatchObject({ isNewGame: false, addedChapters: ['Two'], updatedChapters: [], release: '1.1' })
    expect((await library.list(ME))[0]?.chapters.map(chapter => chapter.included)).toEqual([true, true])
    const runtime = new StoryRuntime(await library.open('id-1', ME))
    runtime.start()
    runtime.next()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Goodbye.')
  })

  it('shows which chapters are missing when only a later one is installed', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-10-01' }), ME)

    expect((await library.list(ME))[0]?.chapters).toEqual([
      { id: game.one.id, title: 'One', included: false },
      { id: game.two.id, title: 'Two', included: true },
    ])
    const runtime = new StoryRuntime(await library.open('id-1', ME))
    runtime.start()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Goodbye.')
  })

  it('keeps the newer release when an older archive is installed after it, taking only missing chapters', async () => {
    const game = buildGame()
    const library = new GameLibrary(memoryLibraryStorage().storage)
    await library.install(await game.export({ chapters: [game.two.id], exportedAt: '2026-11-01', release: '1.1', rename: 'The Letter (revised)' }), ME)

    const outcome = await library.install(await game.export({ exportedAt: '2026-10-01', release: '1.0' }), ME)

    expect(outcome).toMatchObject({ addedChapters: ['One'], updatedChapters: [], wasOlder: true, release: '1.1' })
    expect((await library.list(ME))[0]).toMatchObject({ name: 'The Letter (revised)', release: '1.1' })
  })

  it('stores each asset file once, however many archives bring it', async () => {
    const game = buildGame()
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await library.install(await game.export({ exportedAt: '2026-10-01' }), ME)
    await library.install(await game.export({ exportedAt: '2026-11-01' }), ME)

    expect(memory.assetWrites).toBe(2)
  })

  it('removes a game and the files no other game uses', async () => {
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await library.install(await buildGame().export({ exportedAt: '2026-10-01' }), ME)
    const other = buildGame('Another Letter', 'other')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }), ME)
    expect(memory.assets.size).toBe(2)

    await library.remove('id-1', ME)

    expect((await library.list(ME)).map(entry => entry.name)).toEqual(['Another Letter'])
    expect(memory.assets.size).toBe(1)
  })

  it('removes every game, and every file they kept', async () => {
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await library.install(await buildGame().export({ exportedAt: '2026-10-01' }), ME)
    const other = buildGame('Another Letter', 'other')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }), ME)

    await library.removeAll(ME)

    expect([await library.list(ME), memory.assets.size]).toEqual([[], 0])
  })

  it('refuses a file that is not a game, installing nothing', async () => {
    const memory = memoryLibraryStorage()
    const library = new GameLibrary(memory.storage)
    await expect(library.install(new TextEncoder().encode('not an archive'), ME)).rejects.toThrow('This file is not a ZIP archive')
    expect(await library.list(ME)).toEqual([])
  })
})

describe('a library per profile', () => {
  const names = async (library: GameLibrary, profileId: string) => (await library.list(profileId)).map(entry => entry.name)
  const releases = async (library: GameLibrary, profileId: string) => (await library.list(profileId)).map(entry => `${entry.name} ${entry.release}`)

  function twoProfiles(known: () => readonly string[] | null = () => ['alex', 'sam']) {
    const memory = memoryLibraryStorage()
    return { memory, library: new GameLibrary(memory.storage, { knownProfiles: async () => known() }) }
  }

  it('lists a game in the library of the profile that added it only', async () => {
    const { library } = twoProfiles()
    const other = buildGame('Another Letter', 'other')
    await library.install(await buildGame().export({ exportedAt: '2026-10-01' }), 'sam')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }), 'alex')

    expect(await names(library, 'alex')).toEqual(['Another Letter'])
    expect(await names(library, 'sam')).toEqual(['The Letter'])
  })

  it('installs a game anew for a second profile, storing its files once', async () => {
    const { memory, library } = twoProfiles()
    const archive = await buildGame().export({ exportedAt: '2026-10-01' })
    await library.install(archive, 'sam')

    expect(await library.install(archive, 'alex')).toMatchObject({ isNewGame: true, wasOlder: false, addedChapters: ['One', 'Two'] })
    expect([memory.assetWrites, memory.assets.size]).toEqual([2, 2])
  })

  it('updates one profile’s copy only: the other keeps its version, and plays it', async () => {
    const { library } = twoProfiles()
    const game = buildGame()
    await library.install(await game.export({ exportedAt: '2026-10-01' }), 'sam')
    await library.install(await game.export({ exportedAt: '2026-10-01' }), 'alex')

    await library.install(await game.export({ exportedAt: '2026-11-01', release: '1.1', rename: 'The Letter (revised)' }), 'alex')

    expect([await releases(library, 'alex'), await releases(library, 'sam')]).toEqual([['The Letter (revised) 1.1'], ['The Letter 1.0']])
    expect((await library.open('id-1', 'sam')).project.name).toBe('The Letter')
  })

  it('compares an archive with the profile’s own copy, whatever the others have', async () => {
    const { library } = twoProfiles()
    const game = buildGame()
    await library.install(await game.export({ exportedAt: '2026-11-01', release: '1.1' }), 'sam')

    expect(await library.install(await game.export({ exportedAt: '2026-10-01', release: '1.0' }), 'alex')).toMatchObject({ isNewGame: true, wasOlder: false, release: '1.0' })
  })

  it('removes a game from one library, and its files once no library uses them', async () => {
    const { memory, library } = twoProfiles()
    const archive = await buildGame().export({ exportedAt: '2026-10-01' })
    await library.install(archive, 'sam')
    await library.install(archive, 'alex')

    await library.remove('id-1', 'sam')
    expect([await names(library, 'sam'), await names(library, 'alex'), memory.assets.size]).toEqual([[], ['The Letter'], 2])
    expect((await library.open('id-1', 'alex')).assetUrls.size).toBe(2)

    await library.remove('id-1', 'alex')
    expect(memory.assets.size).toBe(0)
  })

  it('empties one library, keeping the files another library uses', async () => {
    const { memory, library } = twoProfiles()
    const other = buildGame('Another Letter', 'other')
    await library.install(await buildGame().export({ exportedAt: '2026-10-01' }), 'sam')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }), 'sam')
    await library.install(await other.export({ chapters: [other.one.id], exportedAt: '2026-10-01' }), 'alex')
    expect(memory.assets.size).toBe(2)

    await library.removeAll('sam')

    expect([await names(library, 'sam'), await names(library, 'alex')]).toEqual([[], ['Another Letter']])
    expect(memory.assets.size).toBe(1)
  })

  it('copies the games installed before into every profile there is, once, then removes the old copies', async () => {
    let known = ['alex', 'sam']
    const { memory, library } = twoProfiles(() => known)
    await memory.addEarlier(await buildGame().export({ exportedAt: '2026-10-01' }))

    await library.adoptEarlierGames()

    expect([await names(library, 'alex'), await names(library, 'sam'), await memory.storage.earlier.listManifests()]).toEqual([['The Letter'], ['The Letter'], []])
    expect((await library.open('id-1', 'alex')).chapters).toHaveLength(2)
    known = ['alex', 'sam', 'kim']
    expect(await names(library, 'kim')).toEqual([])
  })

  it('keeps the games installed before while there is no profile, or the profiles cannot be read', async () => {
    let known: readonly string[] | null = null
    const { memory, library } = twoProfiles(() => known)
    await memory.addEarlier(await buildGame().export({ exportedAt: '2026-10-01' }))

    await library.adoptEarlierGames()
    known = []
    await library.adoptEarlierGames()
    expect(await memory.storage.earlier.listManifests()).toHaveLength(1)

    known = ['kim']
    expect(await names(library, 'kim')).toEqual(['The Letter'])
  })

  it('stops looking for games installed before once none is left, telling which profiles received them', async () => {
    const memory = memoryLibraryStorage()
    await memory.addEarlier(await buildGame().export({ exportedAt: '2026-10-01' }))
    const adopted: (readonly string[])[] = []
    const library = new GameLibrary(memory.storage, { knownProfiles: async () => ['sam'], adopted: profileIds => adopted.push(profileIds) })
    const listEarlier = vi.spyOn(memory.storage.earlier, 'listManifests')

    await names(library, 'sam')
    await names(library, 'sam')
    await library.gameNames('sam')

    expect([listEarlier.mock.calls.length, adopted]).toEqual([1, [['sam']]])
  })

  it('copies a game installed before without a chapter stored wrong, but stops when the storage fails, keeping it for the next time', async () => {
    const memory = memoryLibraryStorage()
    const game = buildGame()
    await memory.addEarlier(await game.export({ exportedAt: '2026-10-01' }))
    const library = new GameLibrary(memory.storage, { knownProfiles: async () => ['sam'] })
    const readChapter = vi.spyOn(memory.storage.earlier, 'readChapter').mockRejectedValueOnce(new Error('EBUSY'))

    await expect(library.adoptEarlierGames()).rejects.toThrow('EBUSY')
    expect([await memory.storage.earlier.listManifests(), await memory.storage.listManifests('sam')]).toEqual([[expect.anything()], []])

    readChapter.mockRestore()
    memory.earlierChapters.set(`id-1/${game.two.id}`, '{"not":"a chapter"}')
    await library.adoptEarlierGames()
    expect([await memory.storage.earlier.listManifests(), (await library.open('id-1', 'sam')).chapters.map(chapter => chapter.id)]).toEqual([[], [game.one.id]])
  })

  it('writes again a file another profile’s removal deleted while the game was being installed', async () => {
    const { memory, library } = twoProfiles()
    const archive = await buildGame().export({ exportedAt: '2026-10-01' })
    await library.install(archive, 'sam')
    const writeManifest = memory.storage.writeManifest
    // Sam removes the game after Alex's install found its files stored, before Alex's manifest names them.
    vi.spyOn(memory.storage, 'writeManifest').mockImplementationOnce(async (...written) => {
      await library.remove('id-1', 'sam')
      await writeManifest(...written)
    })

    await library.install(archive, 'alex')

    expect(memory.assets.size).toBe(2)
    expect((await library.open('id-1', 'alex')).assetUrls.size).toBe(2)
  })
})
