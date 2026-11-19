import {
  checkChapterDocument,
  checkGameManifest,
  readGameArchive,
  type ArchivedChapter,
  ArchiveError,
  type ChapterDocument,
  DocumentError,
  type GameArchive,
  type GameManifest,
  chapterIn,
  languagesOf,
  projectIn,
  type PlayableStory,
  uncountedEndingIds,
  countedEndingCount,
  writeInstalledGameArchive,
} from '@cyberdeck/core'

/**
 * Where installed games are kept: files on the desktop, IndexedDB in the browser. Each profile keeps
 * its own copy of each game in its library: the manifest (`game.json` as merged from the archives it
 * installed) and the chapters. Asset files are shared by every game of every profile, named
 * `<sha-256>.<extension>`, so that a picture two profiles have is stored once.
 */
export interface LibraryStorage {
  /** The stored manifests of a profile's library, unchecked. */
  listManifests: (profileId: string) => Promise<unknown[]>
  readManifest: (profileId: string, gameId: string) => Promise<unknown>
  writeManifest: (profileId: string, gameId: string, manifest: GameManifest) => Promise<void>
  readChapter: (profileId: string, gameId: string, chapterId: string) => Promise<unknown>
  writeChapter: (profileId: string, gameId: string, chapter: ChapterDocument) => Promise<void>
  hasAsset: (fileName: string) => Promise<boolean>
  writeAsset: (fileName: string, bytes: Uint8Array<ArrayBuffer>) => Promise<void>
  /** The content of a stored asset file; null when it is not stored. */
  readAsset: (fileName: string) => Promise<Uint8Array<ArrayBuffer> | null>
  /** An address the page can load the asset from. */
  assetUrl: (fileName: string) => Promise<string>
  removeGame: (profileId: string, gameId: string) => Promise<void>
  /** Removes every game of a profile's library. */
  removeLibrary: (profileId: string) => Promise<void>
  /** The manifests of every library, the earlier games' included: what decides which asset files are kept. */
  listAllManifests: () => Promise<unknown[]>
  /** Deletes asset files no installed game uses any more. */
  removeAssetsExcept: (fileNames: readonly string[]) => Promise<void>
  earlier: EarlierGames
}

/** The games stored before each profile had its own library: only read, copied into each profile, and removed. */
export interface EarlierGames {
  listManifests: () => Promise<unknown[]>
  readChapter: (gameId: string, chapterId: string) => Promise<unknown>
  removeGame: (gameId: string) => Promise<void>
}

export interface LibraryEntry {
  id: string
  name: string
  release: string
  description: string
  credits: string
  coverUrl: string | null
  /** Endings the story names, for "Endings reached: 1 of 3". */
  endingCount: number
  /** Illustrations of the game, for its gallery. */
  illustrationCount: number
  /** Every chapter of the game; `included` tells whether it is installed. */
  chapters: ArchivedChapter[]
  /** The languages the game can be played in, the story's first first. */
  languages: readonly string[]
}

export interface InstallOutcome {
  gameName: string
  release: string
  isNewGame: boolean
  addedChapters: string[]
  updatedChapters: string[]
  /** True when the archive is older than what was installed: it only added missing chapters. */
  wasOlder: boolean
}

export interface GameLibraryOptions {
  /** The profiles there are; null, or an error, when they cannot be read. */
  knownProfiles?: () => Promise<readonly string[] | null>
  /** Told once the earlier games are copied, with the profiles that received them; none when there were none. */
  adopted?: (profileIds: readonly string[]) => void
}

/**
 * Installs downloaded games, merging the archives of one game, and opens them for playing. Each
 * profile has its own library: a game added, updated or removed in one leaves the others' alone, and
 * nothing tells a profile what the others have. That is no lock, as a PIN is none: the files are
 * stored as any other game's.
 */
export class GameLibrary {
  /** The copying of the games stored before each profile had its own library, while it runs. */
  private adopting: Promise<void> | null = null
  /** Set once no earlier game is left: nothing is read for them any more. */
  private isAdopted = false

  constructor(
    private readonly storage: LibraryStorage,
    private readonly options: GameLibraryOptions = {},
  ) {}

  /**
   * Copies the games installed before each profile had its own library into the library of every
   * profile there is, then removes the old copies: each profile goes on with what it had. Tried at
   * start, before a profile can be made, so that a profile made later starts with an empty library.
   * When it cannot finish then (no profile yet, profiles or games that cannot be read), it is tried
   * again before each library is read: the earlier games then go to every profile there is at that
   * time, those made meanwhile included, rather than to none.
   */
  adoptEarlierGames(): Promise<void> {
    if (this.isAdopted) {
      return Promise.resolve()
    }
    return this.adopting ??= this.adoptNow().finally(() => {
      this.adopting = null
    })
  }

  private async adoptNow() {
    const earlier = checkedManifests(await this.storage.earlier.listManifests())
    if (earlier.length === 0) {
      this.isAdopted = true
      this.options.adopted?.([])
      return
    }
    const profileIds = await this.options.knownProfiles?.().catch(() => null) ?? null
    if (profileIds === null || profileIds.length === 0) {
      return
    }
    for (const manifest of earlier) {
      const gameId = manifest.project.id
      // A chapter that cannot be read could not be played either: the game is copied without it, as
      // a game missing that chapter.
      // Storage failing is another matter: the copying stops, the earlier game kept for the next time.
      const { chapters, scenes } = await readDocuments(manifest, chapterId => this.storage.earlier.readChapter(gameId, chapterId), true)
      const copied = new Set(chapters.map(chapter => chapter.id))
      const copiedManifest = { ...manifest, chapters: manifest.chapters.map(chapter => ({ ...chapter, included: chapter.included && copied.has(chapter.id) })) }
      for (const profileId of profileIds) {
        // A copy cut short has its chapters but not yet its manifest: it is made again.
        if (await this.storage.readManifest(profileId, gameId) != null) {
          continue
        }
        for (const chapter of [...chapters, ...scenes]) {
          await this.storage.writeChapter(profileId, gameId, chapter)
        }
        await this.storage.writeManifest(profileId, gameId, copiedManifest)
      }
      await this.storage.earlier.removeGame(gameId)
    }
    this.isAdopted = true
    this.options.adopted?.(profileIds)
  }

  /** The games of the profile's library. */
  async list(profileId: string): Promise<LibraryEntry[]> {
    const manifests = await this.manifestsOf(profileId)
    const entries = await Promise.all(manifests.map(async ({ project, release, chapters, assetFiles }): Promise<LibraryEntry> => {
      const coverFile = project.details.coverAssetId === null ? undefined : assetFiles[project.details.coverAssetId]
      return {
        id: project.id,
        name: project.name,
        release,
        description: project.details.description,
        credits: project.details.credits,
        coverUrl: coverFile === undefined ? null : await this.storage.assetUrl(storedAssetFileName(coverFile)),
        endingCount: countedEndingCount(project.endings, uncountedEndingIds(chapters)),
        languages: languagesOf(project),
        illustrationCount: project.illustrations.length,
        chapters,
      }
    }))
    return entries.sort((first, second) => first.name.localeCompare(second.name))
  }

  /** The identifiers and names of the profile's games, without what showing them needs. */
  async gameNames(profileId: string): Promise<{ id: string; name: string }[]> {
    return (await this.manifestsOf(profileId)).map(({ project }) => ({ id: project.id, name: project.name }))
  }

  private async manifestsOf(profileId: string): Promise<GameManifest[]> {
    await this.adoptEarlierGames()
    return checkedManifests(await this.storage.listManifests(profileId))
  }

  /**
   * Adds the game to the profile's library, or updates the profile's copy: other profiles keep the
   * version they have. Throws an error worded for the player when the file is not a game Datajack can
   * play.
   */
  async install(bytes: Uint8Array<ArrayBuffer>, profileId: string): Promise<InstallOutcome> {
    return this.installArchive(await readGameArchive(bytes), profileId)
  }

  /** Installs a game archive already read. Asset files already stored, for any profile, are not written again. */
  async installArchive(archive: GameArchive, profileId: string): Promise<InstallOutcome> {
    const gameId = archive.manifest.project.id
    const storedManifest = await this.storage.readManifest(profileId, gameId)
    const installed = storedManifest == null ? null : checkGameManifest(storedManifest)
    const { manifest, chapterIdsToWrite } = mergeManifests(installed, archive.manifest)

    /** Those found stored: another profile removing its last game using one may delete it meanwhile. */
    const foundStored: [string, Uint8Array<ArrayBuffer>][] = []
    for (const [assetId, file] of Object.entries(archive.manifest.assetFiles)) {
      const fileName = storedAssetFileName(file)
      const content = archive.assetFiles.get(file.path)
      if (!Object.hasOwn(manifest.assetFiles, assetId) || content === undefined) {
        continue
      }
      if (await this.storage.hasAsset(fileName)) {
        foundStored.push([fileName, content])
      } else {
        await this.storage.writeAsset(fileName, content)
      }
    }
    for (const chapter of archive.chapters.filter(candidate => chapterIdsToWrite.has(candidate.id))) {
      await this.storage.writeChapter(profileId, gameId, chapter)
    }
    // Every archive carries every scene; those of the newer export are the ones its chapters play.
    if (manifest.exportedAt === archive.manifest.exportedAt) {
      for (const scene of archive.scenes) {
        await this.storage.writeChapter(profileId, gameId, scene)
      }
    }
    await this.storage.writeManifest(profileId, gameId, manifest)
    // Once the manifest names them, they are kept; one deleted before that is written again.
    for (const [fileName, content] of foundStored) {
      if (!(await this.storage.hasAsset(fileName))) {
        await this.storage.writeAsset(fileName, content)
      }
    }

    const wasInstalled = new Set(installed?.chapters.filter(chapter => chapter.included).map(chapter => chapter.id))
    const titleOf = (chapterId: string) => manifest.chapters.find(chapter => chapter.id === chapterId)?.title ?? 'Untitled chapter'
    const written = manifest.chapters.map(chapter => chapter.id).filter(chapterId => chapterIdsToWrite.has(chapterId))
    return {
      gameName: manifest.project.name,
      release: manifest.release,
      isNewGame: installed === null,
      addedChapters: written.filter(chapterId => !wasInstalled.has(chapterId)).map(titleOf),
      updatedChapters: written.filter(chapterId => wasInstalled.has(chapterId)).map(titleOf),
      wasOlder: installed !== null && archive.manifest.exportedAt < installed.exportedAt,
    }
  }

  /** Removes the game from the profile's library, and the files no game of any profile uses any more. */
  async remove(gameId: string, profileId: string) {
    await this.storage.removeGame(profileId, gameId)
    await this.removeUnusedAssets()
  }

  /**
   * Empties the profile's library, when the player erases it or the profile is removed, and removes
   * the files no game of any profile uses any more.
   */
  async removeAll(profileId: string) {
    await this.storage.removeLibrary(profileId)
    await this.removeUnusedAssets()
  }

  private async removeUnusedAssets() {
    const kept = checkedManifests(await this.storage.listAllManifests()).flatMap(manifest => Object.values(manifest.assetFiles).map(storedAssetFileName))
    await this.storage.removeAssetsExcept(kept)
  }

  /**
   * The profile's copy of a game as one archive, which installing reads as any downloaded game: to
   * carry the game, at the version the profile has, in a profile file.
   */
  async archive(gameId: string, profileId: string): Promise<Uint8Array<ArrayBuffer>> {
    const manifest = checkGameManifest(await this.storage.readManifest(profileId, gameId))
    const documents = await readDocuments(manifest, chapterId => this.storage.readChapter(profileId, gameId, chapterId), false)
    return writeInstalledGameArchive(manifest, documents, async file => {
      const content = await this.storage.readAsset(storedAssetFileName(file))
      if (content === null) {
        throw new ArchiveError({ code: 'missingFile', path: file.path })
      }
      return content
    })
  }

  /** The game of the profile's library ready to play in a language it has; in the story's first otherwise. */
  async open(gameId: string, profileId: string, language: string | null = null): Promise<PlayableStory> {
    const manifest = checkGameManifest(await this.storage.readManifest(profileId, gameId))
    const { chapters, scenes } = await readDocuments(manifest, chapterId => this.storage.readChapter(profileId, gameId, chapterId), false)
    const assetUrls = new Map<string, string>()
    for (const [assetId, file] of Object.entries(manifest.assetFiles)) {
      assetUrls.set(assetId, await this.storage.assetUrl(storedAssetFileName(file)))
    }
    const languages = languagesOf(manifest.project)
    const played = language !== null && languages.includes(language) ? language : languages[0]!
    return {
      project: projectIn(manifest.project, played),
      // Scenes are played as chapters are.
      chapters: [...chapters, ...scenes].map(chapter => chapterIn(chapter, played, manifest.project)),
      assetUrls,
      uncountedEndingIds: uncountedEndingIds(manifest.chapters),
    }
  }
}

/**
 * The installed chapters of a game, then its scenes, in their order. `skipsUnreadable`: one stored
 * wrong, or missing, is left out instead of refused; errors of the storage itself still are thrown.
 */
async function readDocuments(manifest: GameManifest, readChapter: (chapterId: string) => Promise<unknown>, skipsUnreadable: boolean) {
  const read = async (chapterId: string, kind: 'chapter' | 'scene'): Promise<ChapterDocument[]> => {
    try {
      return [checkChapterDocument(await readChapter(chapterId), kind)]
    } catch (error) {
      if (skipsUnreadable && error instanceof DocumentError) {
        return []
      }
      throw error
    }
  }
  const chapters: ChapterDocument[] = []
  for (const archived of manifest.chapters.filter(chapter => chapter.included)) {
    chapters.push(...await read(archived.id, 'chapter'))
  }
  const scenes: ChapterDocument[] = []
  for (const sceneId of manifest.project.sceneOrder) {
    scenes.push(...await read(sceneId, 'scene'))
  }
  return { chapters, scenes }
}

/** The manifests that can be read; one that cannot names no game. */
function checkedManifests(values: readonly unknown[]): GameManifest[] {
  return values.flatMap(value => {
    try {
      return [checkGameManifest(value)]
    } catch {
      return []
    }
  })
}

/** Installed files are named by content, so that games sharing a file store it once. */
export function storedAssetFileName(file: { path: string; sha256: string }): string {
  return `${file.sha256}${file.path.slice(file.path.lastIndexOf('.'))}`
}

/**
 * The newer export (by date) brings the project, the release and the chapter list; chapters it
 * includes replace the installed ones. An older archive only adds the chapters still missing.
 */
export function mergeManifests(installed: GameManifest | null, archive: GameManifest): { manifest: GameManifest; chapterIdsToWrite: Set<string> } {
  if (installed === null) {
    return { manifest: archive, chapterIdsToWrite: new Set(archive.chapters.filter(chapter => chapter.included).map(chapter => chapter.id)) }
  }
  const isNewer = archive.exportedAt >= installed.exportedAt
  const base = isNewer ? archive : installed
  const installedIds = new Set(installed.chapters.filter(chapter => chapter.included).map(chapter => chapter.id))
  const archiveIds = archive.chapters.filter(chapter => chapter.included).map(chapter => chapter.id)
  const chapterIdsToWrite = new Set(archiveIds.filter(chapterId =>
    base.chapters.some(chapter => chapter.id === chapterId) && (isNewer || !installedIds.has(chapterId))))
  const assetFiles = isNewer ? { ...installed.assetFiles, ...archive.assetFiles } : { ...archive.assetFiles, ...installed.assetFiles }
  return {
    manifest: {
      ...base,
      chapters: base.chapters.map(chapter => ({ ...chapter, included: installedIds.has(chapter.id) || chapterIdsToWrite.has(chapter.id) })),
      assetFiles: Object.fromEntries(Object.entries(assetFiles).filter(([assetId]) => base.project.assets.some(asset => asset.id === assetId))),
    },
    chapterIdsToWrite,
  }
}
