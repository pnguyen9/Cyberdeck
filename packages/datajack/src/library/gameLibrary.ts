import {
  checkChapterDocument,
  checkGameManifest,
  readGameArchive,
  type ArchivedChapter,
  type ChapterDocument,
  type GameManifest,
  type PlayableStory,
} from '@cyberdeck/core'

/**
 * Where installed games are kept: files on the desktop, IndexedDB in the browser. Each game keeps
 * its manifest (`game.json` as merged from the archives installed) and its chapters; asset files are
 * shared by every game, named `<sha-256>.<extension>`.
 */
export interface LibraryStorage {
  /** The stored manifests, unchecked. */
  listManifests: () => Promise<unknown[]>
  readManifest: (gameId: string) => Promise<unknown>
  writeManifest: (gameId: string, manifest: GameManifest) => Promise<void>
  readChapter: (gameId: string, chapterId: string) => Promise<unknown>
  writeChapter: (gameId: string, chapter: ChapterDocument) => Promise<void>
  hasAsset: (fileName: string) => Promise<boolean>
  writeAsset: (fileName: string, bytes: Uint8Array<ArrayBuffer>) => Promise<void>
  /** An address the page can load the asset from. */
  assetUrl: (fileName: string) => Promise<string>
  removeGame: (gameId: string) => Promise<void>
  /** Deletes asset files no installed game uses any more. */
  removeAssetsExcept: (fileNames: readonly string[]) => Promise<void>
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

/** Installs downloaded games, merging the archives of one game, and opens them for playing. */
export class GameLibrary {
  constructor(private readonly storage: LibraryStorage) {}

  async list(): Promise<LibraryEntry[]> {
    const manifests = (await this.storage.listManifests()).flatMap(value => {
      try {
        return [checkGameManifest(value)]
      } catch {
        return []
      }
    })
    const entries = await Promise.all(manifests.map(async ({ project, release, chapters, assetFiles }): Promise<LibraryEntry> => {
      const coverFile = project.details.coverAssetId === null ? undefined : assetFiles[project.details.coverAssetId]
      return {
        id: project.id,
        name: project.name,
        release,
        description: project.details.description,
        credits: project.details.credits,
        coverUrl: coverFile === undefined ? null : await this.storage.assetUrl(storedAssetFileName(coverFile)),
        endingCount: project.endings.length,
        illustrationCount: project.illustrations.length,
        chapters,
      }
    }))
    return entries.sort((first, second) => first.name.localeCompare(second.name))
  }

  /** Throws an error worded for the player when the file is not a game Datajack can play. */
  async install(bytes: Uint8Array<ArrayBuffer>): Promise<InstallOutcome> {
    const archive = await readGameArchive(bytes)
    const gameId = archive.manifest.project.id
    const storedManifest = await this.storage.readManifest(gameId)
    const installed = storedManifest == null ? null : checkGameManifest(storedManifest)
    const { manifest, chapterIdsToWrite } = mergeManifests(installed, archive.manifest)

    for (const [assetId, file] of Object.entries(archive.manifest.assetFiles)) {
      const fileName = storedAssetFileName(file)
      const content = archive.assetFiles.get(file.path)
      if (Object.hasOwn(manifest.assetFiles, assetId) && content !== undefined && !(await this.storage.hasAsset(fileName))) {
        await this.storage.writeAsset(fileName, content)
      }
    }
    for (const chapter of archive.chapters.filter(candidate => chapterIdsToWrite.has(candidate.id))) {
      await this.storage.writeChapter(gameId, chapter)
    }
    // Every archive carries every scene; those of the newer export are the ones its chapters play.
    if (manifest.exportedAt === archive.manifest.exportedAt) {
      for (const scene of archive.scenes) {
        await this.storage.writeChapter(gameId, scene)
      }
    }
    await this.storage.writeManifest(gameId, manifest)

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

  async remove(gameId: string) {
    await this.storage.removeGame(gameId)
    const kept = (await this.storage.listManifests()).flatMap(value => {
      try {
        return Object.values(checkGameManifest(value).assetFiles).map(storedAssetFileName)
      } catch {
        return []
      }
    })
    await this.storage.removeAssetsExcept(kept)
  }

  async open(gameId: string): Promise<PlayableStory> {
    const manifest = checkGameManifest(await this.storage.readManifest(gameId))
    const chapters: ChapterDocument[] = []
    for (const archived of manifest.chapters.filter(chapter => chapter.included)) {
      chapters.push(checkChapterDocument(await this.storage.readChapter(gameId, archived.id), 'chapter'))
    }
    // Scenes are stored as chapters are.
    for (const sceneId of manifest.project.sceneOrder) {
      chapters.push(checkChapterDocument(await this.storage.readChapter(gameId, sceneId), 'scene'))
    }
    const assetUrls = new Map<string, string>()
    for (const [assetId, file] of Object.entries(manifest.assetFiles)) {
      assetUrls.set(assetId, await this.storage.assetUrl(storedAssetFileName(file)))
    }
    return { project: manifest.project, chapters, assetUrls }
  }
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
