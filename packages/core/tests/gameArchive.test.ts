import { describe, expect, it } from 'vitest'
import {
  ArchiveError,
  assignAsset,
  chapterPath,
  checkChapterDocument,
  checkProjectDocument,
  createGameArchive,
  createProject,
  importText,
  MANIFEST_PATH,
  matchAssetFile,
  readGameArchive,
  readZip,
  storeImport,
  writeZip,
  type ProjectDocument,
  type StoredNode,
} from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const STORY = [
  '# One',
  '[bg: street] [music: calm]',
  '[enter: marie]',
  '— Marie: Hello.',
  '# Two',
  '[bg: rooftop]',
  '[marie: smile]',
  '— Marie: Goodbye.',
].join('\n')

const SPRITE = new Uint8Array([1, 2, 3])
const FILES = [
  { name: 'street.png', mediaType: 'image/png', bytes: new Uint8Array([10]) },
  { name: 'calm.ogg', mediaType: 'audio/ogg', bytes: new Uint8Array([20]) },
  { name: 'rooftop.webp', mediaType: 'image/webp', bytes: new Uint8Array([30]) },
  { name: 'marie.png', mediaType: 'image/png', bytes: SPRITE },
  { name: 'marie-smile.png', mediaType: 'image/png', bytes: SPRITE },
]
const EXPORTED_AT = new Date('2026-10-26T10:00:00Z')

function buildGame() {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => '2026-10-26T09:00:00.000Z' }
  const stored = storeImport(importText(STORY, { layout: monospaceLayout, locale: 'en' }), createProject({ name: 'The Letter', locale: 'en' }, environment), { fileName: null }, environment)
  let project: ProjectDocument = stored.project
  const bytesByAssetId = new Map<string, Uint8Array<ArrayBuffer>>()
  for (const file of FILES) {
    const assetId = `asset-${file.name}`
    project = assignAsset(project, matchAssetFile(file.name, file.mediaType, project)!, { id: assetId, fileName: file.name, mediaType: file.mediaType, byteSize: file.bytes.length })
    bytesByAssetId.set(assetId, file.bytes)
  }
  const [one, two] = stored.chapters
  return {
    project,
    chapters: stored.chapters,
    one: one!,
    two: two!,
    archive: (includedChapterIds = project.chapterOrder, release = '1.0') => createGameArchive({
      project,
      chapters: stored.chapters,
      includedChapterIds,
      readAsset: async asset => bytesByAssetId.get(asset.id)!,
      release,
      exportedAt: EXPORTED_AT,
    }),
  }
}

/** Unpacks an archive, lets the test alter its files, and packs it again. */
async function alter(bytes: Uint8Array<ArrayBuffer>, change: (files: Map<string, Uint8Array<ArrayBuffer>>) => void): Promise<Uint8Array<ArrayBuffer>> {
  const files = new Map(await Promise.all(readZip(bytes).map(async entry => [entry.path, await entry.read()] as const)))
  change(files)
  return writeZip([...files].map(([path, content]) => ({ path, bytes: content, compress: false })), EXPORTED_AT)
}

function changeJson(files: Map<string, Uint8Array<ArrayBuffer>>, path: string, change: (value: any) => void) {
  const value = JSON.parse(new TextDecoder().decode(files.get(path)))
  change(value)
  files.set(path, new TextEncoder().encode(JSON.stringify(value)))
}

describe('game archives', () => {
  it('carries the whole game: project, chapters in order, and asset files', async () => {
    const game = buildGame()
    const archive = await readGameArchive(await game.archive())

    // Stamped with the oldest format that holds the game, for players of Datajack 1.0.
    expect(archive.manifest.project).toEqual({ ...game.project, formatVersion: '1.1' })
    expect(archive.chapters).toEqual(game.chapters.map(({ importedFrom: _importedFrom, ...chapter }) => ({ ...chapter, formatVersion: '1.1' })))
    expect(archive.manifest.chapters).toEqual([
      { id: game.one.id, title: 'One', included: true },
      { id: game.two.id, title: 'Two', included: true },
    ])
    expect(archive.manifest.release).toBe('1.0')
    expect(archive.manifest.exportedAt).toBe('2026-10-26T10:00:00.000Z')
    expect(archive.manifest.assetFiles['asset-street.png']).toEqual({
      path: 'assets/backgrounds/street.png',
      sha256: '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
    })
    expect(archive.assetFiles.get('assets/backgrounds/street.png')).toEqual(new Uint8Array([10]))
  })

  it('files assets by kind, named after their entries, storing shared content once', async () => {
    const game = buildGame()
    const bytes = await game.archive()
    const archive = await readGameArchive(bytes)

    expect(readZip(bytes).map(entry => entry.path).filter(path => path.startsWith('assets/'))).toEqual([
      'assets/backgrounds/street.png',
      'assets/music/calm.ogg',
      'assets/backgrounds/rooftop.webp',
      'assets/characters/Marie/normal.png',
    ])
    expect(archive.manifest.assetFiles['asset-marie-smile.png']?.path).toBe('assets/characters/Marie/normal.png')
  })

  it('carries the cover in every archive, even one whose chapters never show it', async () => {
    const game = buildGame()
    const project: ProjectDocument = {
      ...game.project,
      assets: [...game.project.assets, { id: 'asset-cover', fileName: 'Cover Art.jpg', mediaType: 'image/jpeg', byteSize: 1 }],
      details: { description: 'A letter, a classroom, a choice.', credits: 'Story: Pascal', coverAssetId: 'asset-cover' },
    }
    const bytes = await createGameArchive({
      project,
      chapters: game.chapters,
      includedChapterIds: [game.two.id],
      readAsset: async asset => asset.id === 'asset-cover' ? new Uint8Array([99]) : SPRITE,
      release: '1.0',
      exportedAt: EXPORTED_AT,
    })
    const archive = await readGameArchive(bytes)

    expect(archive.manifest.project.details).toEqual(project.details)
    expect(archive.manifest.assetFiles['asset-cover']?.path).toBe('assets/cover.jpg')
    expect(archive.assetFiles.get('assets/cover.jpg')).toEqual(new Uint8Array([99]))
  })

  it('refuses a blank release', async () => {
    await expect(buildGame().archive(undefined, ' ')).rejects.toThrow('A release needs 1 to 40 characters')
  })

  it('carries selected chapters with only the assets they use, and lists the others by title', async () => {
    const game = buildGame()
    const archive = await readGameArchive(await game.archive([game.two.id]))

    expect(archive.chapters.map(chapter => chapter.title)).toEqual(['Two'])
    expect(archive.manifest.chapters).toEqual([
      { id: game.one.id, title: 'One', included: false },
      { id: game.two.id, title: 'Two', included: true },
    ])
    expect(Object.keys(archive.manifest.assetFiles).sort()).toEqual(['asset-marie-smile.png', 'asset-rooftop.webp'])
  })

  it('carries every scene with the assets it uses, even in an archive of a chapter that does not play it', async () => {
    let nextId = 1
    const environment = { createId: () => `id-${nextId++}`, now: () => '2026-10-26T09:00:00.000Z' }
    const text = ['# One', 'Hello.', '[play: Farewell]', '# Two', 'Later.', '# Scene: Farewell', '[bg: rooftop]', 'Bye.'].join('\n')
    const stored = storeImport(importText(text, { layout: monospaceLayout, locale: 'en' }), createProject({ name: 'Scenes', locale: 'en' }, environment), { fileName: null }, environment)
    const project = assignAsset(stored.project, matchAssetFile('rooftop.webp', 'image/webp', stored.project)!, { id: 'asset-rooftop', fileName: 'rooftop.webp', mediaType: 'image/webp', byteSize: 1 })
    const bytes = await createGameArchive({
      project,
      chapters: [...stored.chapters, ...stored.scenes],
      includedChapterIds: [stored.chapters[1]!.id],
      readAsset: async () => new Uint8Array([30]),
      release: '2',
      exportedAt: EXPORTED_AT,
    })
    const archive = await readGameArchive(bytes)
    expect(archive.chapters.map(chapter => chapter.title)).toEqual(['Two'])
    expect(archive.scenes.map(scene => scene.title)).toEqual(['Farewell'])
    expect(Object.keys(archive.manifest.assetFiles)).toEqual(['asset-rooftop'])
    await expect(readGameArchive(await alter(bytes, files => files.delete(`scenes/${stored.scenes[0]!.id}/scene.json`)))).rejects.toThrow('scene.json')
  })

  it('refuses to export a chapter the project does not have', async () => {
    await expect(buildGame().archive(['unknown'])).rejects.toThrow('No chapter unknown')
  })

  it('drops fields it does not know, which a newer minor version may add', async () => {
    const game = buildGame()
    const bytes = await alter(await game.archive(), files => changeJson(files, chapterPath(game.one.id), chapter => {
      chapter.nodes.find((node: StoredNode) => node.type === 'page').mood = 'happy'
    }))
    const page = (await readGameArchive(bytes)).chapters[0]!.nodes.find(node => node.type === 'page')
    expect(page).not.toHaveProperty('mood')
  })

  describe('refuses', () => {
    async function refusal(change: (files: Map<string, Uint8Array<ArrayBuffer>>, game: ReturnType<typeof buildGame>) => void) {
      const game = buildGame()
      const bytes = await alter(await game.archive(), files => change(files, game))
      return readGameArchive(bytes).then(() => 'accepted', (error: Error) => error.message)
    }

    it('an archive that is not a game', async () => {
      expect(await refusal(files => files.delete(MANIFEST_PATH))).toBe('This archive has no game.json: it is not a Datajack game')
    })

    it('a game made for a newer Datajack', async () => {
      expect(await refusal(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.archiveFormat = 2
      }))).toBe('This game was made for a newer Datajack: download the latest one')
      expect(await refusal((files, game) => changeJson(files, chapterPath(game.one.id), chapter => {
        chapter.formatVersion = '2.0'
      }))).toMatch(/chapter\.json is invalid: chapter\.formatVersion: expected a format version this player reads$/)
    })

    it('an asset file altered after export', async () => {
      expect(await refusal(files => {
        const path = [...files.keys()].find(candidate => candidate.endsWith('.webp'))!
        files.set(path, new Uint8Array([31]))
      })).toBe('assets/backgrounds/rooftop.webp is not the file the game was exported with: the archive was altered or damaged')
    })

    it('a missing chapter file', async () => {
      expect(await refusal((files, game) => files.delete(chapterPath(game.two.id)))).toMatch(/^This archive has no chapters\//)
    })

    it('a malformed node, naming the faulty field', async () => {
      expect(await refusal((files, game) => changeJson(files, chapterPath(game.one.id), chapter => {
        chapter.nodes.find((node: StoredNode) => node.type === 'page').text = 42
      }))).toMatch(/chapter\.json is invalid: chapter\.nodes\[\d+\]\.text: expected a string$/)
    })

    it('a game identifier that could leave its folder once installed', async () => {
      expect(await refusal(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.project.id = '../escape'
      }))).toBe('game.json is invalid: game.project.id: expected a plain identifier')
    })

    it('with a code and its parameters, for players to read it in their language', async () => {
      async function problemOf(change: (files: Map<string, Uint8Array<ArrayBuffer>>, game: ReturnType<typeof buildGame>) => void) {
        const game = buildGame()
        const bytes = await alter(await game.archive(), files => change(files, game))
        return readGameArchive(bytes).then(() => null, (error: unknown) => error instanceof ArchiveError ? error.problem : error)
      }
      expect(await problemOf(files => files.delete(MANIFEST_PATH))).toEqual({ code: 'notAGame', path: 'game.json' })
      expect(await problemOf(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.archiveFormat = 2
      }))).toEqual({ code: 'newerPlayer' })
      expect(await problemOf((files, game) => changeJson(files, chapterPath(game.one.id), chapter => {
        chapter.formatVersion = '2.0'
      }))).toMatchObject({ code: 'newerFormat', path: chapterPath(buildGame().one.id), detail: 'chapter.formatVersion: expected a format version this player reads' })
      expect(await problemOf(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.project.id = '../escape'
      }))).toEqual({ code: 'invalidDocument', path: 'game.json', detail: 'game.project.id: expected a plain identifier' })
      expect(await problemOf(files => files.set(MANIFEST_PATH, new TextEncoder().encode('{')))).toEqual({ code: 'invalidJson', path: 'game.json' })
      expect(await problemOf(files => {
        const path = [...files.keys()].find(candidate => candidate.endsWith('.webp'))!
        files.set(path, new Uint8Array([31]))
      })).toEqual({ code: 'alteredFile', path: 'assets/backgrounds/rooftop.webp' })
    })

    it('a file that is not a ZIP archive, keeping the English sentence as message', async () => {
      const error = await readGameArchive(new TextEncoder().encode('just some text')).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(ArchiveError)
      expect((error as ArchiveError).code).toBe('notZip')
      expect((error as ArchiveError).message).toBe('This file is not a ZIP archive')
    })

    it('an asset file of a kind Datajack does not play', async () => {
      expect(await refusal(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.assetFiles['asset-street.png'].path = 'assets/backgrounds/script.js'
      }))).toBe('game.json is invalid: game.assetFiles.asset-street.png.path: expected an asset file Datajack plays')
      expect(await refusal(files => changeJson(files, MANIFEST_PATH, manifest => {
        manifest.assetFiles['asset-street.png'].path = 'assets/../game.png'
      }))).toBe('game.json is invalid: game.assetFiles.asset-street.png.path: expected an asset file Datajack plays')
    })
  })
})

describe('checkChapterDocument', () => {
  it('bounds the nesting of branches', () => {
    let nodes: unknown[] = [{ type: 'break', id: 'break' }]
    for (let depth = 0; depth < 100; depth++) {
      nodes = [{ type: 'condition', id: `condition-${depth}`, branches: [{ id: `branch-${depth}`, condition: null, nodes }] }]
    }
    const chapter = { formatVersion: '1.0', id: 'chapter', title: null, nodes, createdAt: '', updatedAt: '' }
    expect(() => checkChapterDocument(chapter, 'chapter')).toThrow('at most 64 nested branches')
  })

  it('reads loops and breaks, bounding their nesting too', () => {
    const loop = { type: 'loop', id: 'loop', nodes: [{ type: 'break', id: 'break', extra: true }] }
    const chapter = (nodes: unknown[]) => ({ formatVersion: '1.1', id: 'chapter', title: null, nodes, createdAt: '', updatedAt: '' })
    expect(checkChapterDocument(chapter([loop]), 'chapter').nodes).toEqual([{ type: 'loop', id: 'loop', nodes: [{ type: 'break', id: 'break' }] }])
    expect(() => checkChapterDocument(chapter([{ type: 'loop', id: 'loop', nodes: 'none' }]), 'chapter')).toThrow('chapter.nodes[0].nodes: expected a list')

    let nodes: unknown[] = []
    for (let depth = 0; depth < 100; depth++) {
      nodes = [{ type: 'loop', id: `loop-${depth}`, nodes }]
    }
    expect(() => checkChapterDocument(chapter(nodes), 'chapter')).toThrow('at most 64 nested blocks')
  })

  it('refuses documents from a newer minor version, which may hold nodes this player does not know', () => {
    expect(() => checkChapterDocument({ formatVersion: '1.4', id: 'chapter', title: null, nodes: [], createdAt: '', updatedAt: '' }, 'chapter'))
      .toThrow('chapter.formatVersion: expected a format version this player reads')
  })
})

describe('projects written before endings, memories and details existed', () => {
  it('are read with those empty', () => {
    const { project } = buildGame()
    const { endings: _endings, memories: _memories, details: _details, ...older } = project
    expect(checkProjectDocument(older, 'project')).toEqual({ ...older, endings: [], memories: [], details: { description: '', credits: '', coverAssetId: null } })
  })
})
