import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { isFileError, isJsonObject, SAFE_SEGMENT, writeAtomically } from '@cyberdeck/desktop/files'

/** The files games may carry, by extension; the same list as the archive format's. */
export const MEDIA_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  weba: 'audio/webm',
  webm: 'video/webm',
  mp4: 'video/mp4',
  vtt: 'text/vtt',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

/** `<sha-256>.<extension>`: installed assets are named by their content, shared by every game. */
const ASSET_FILE_NAME = new RegExp(`^([0-9a-f]{64})\\.(${Object.keys(MEDIA_TYPES_BY_EXTENSION).join('|')})$`)
const MAXIMUM_MANIFEST_LENGTH = 10_000_000
const MAXIMUM_CHAPTER_LENGTH = 20_000_000

/**
 * The games installed on the desktop, in the application's data folder: each profile's library in
 * `profiles/<profile>/games/<game>/game.json` and `…/chapters/<chapter>.json`, the asset files of every
 * library in `assets/<sha-256>.<extension>`. `games/<game>/…` keeps the games installed before each
 * profile had its own library, until the page copies them into each.
 * The page checks archives before installing them; this checks again what reaches the disk.
 */
export class LibraryFiles {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly folder: string) {}

  listManifests(profileId: string): Promise<string[]> {
    return this.inTurn(() => readManifestsIn(this.gamesFolder(profileId)))
  }

  /** The manifests of the games installed before each profile had its own library. */
  listEarlierManifests(): Promise<string[]> {
    return this.inTurn(() => readManifestsIn(this.earlierFolder))
  }

  /** Every library's manifests, the earlier games' included: what decides which asset files are kept. */
  listAllManifests(): Promise<string[]> {
    return this.inTurn(async () => {
      const profiles = await readdir(join(this.folder, 'profiles'), { withFileTypes: true }).catch(() => [])
      const manifests = await readManifestsIn(this.earlierFolder)
      for (const profile of profiles.filter(entry => entry.isDirectory() && SAFE_SEGMENT.test(entry.name))) {
        manifests.push(...await readManifestsIn(this.gamesFolder(profile.name)))
      }
      return manifests
    })
  }

  readManifest(profileId: string, gameId: string): Promise<string | null> {
    return this.inTurn(() => readOptional(join(this.gameFolder(profileId, gameId), 'game.json')))
  }

  writeManifest(profileId: string, gameId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const path = join(this.gameFolder(profileId, gameId), 'game.json')
      checkJson(text, MAXIMUM_MANIFEST_LENGTH)
      await mkdir(join(path, '..'), { recursive: true })
      await writeAtomically(path, text)
    })
  }

  readChapter(profileId: string, gameId: string, chapterId: string): Promise<string | null> {
    return this.inTurn(() => readOptional(chapterPath(this.gameFolder(profileId, gameId), chapterId)))
  }

  readEarlierChapter(gameId: string, chapterId: string): Promise<string | null> {
    return this.inTurn(() => readOptional(chapterPath(this.earlierGameFolder(gameId), chapterId)))
  }

  writeChapter(profileId: string, gameId: string, chapterId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const path = chapterPath(this.gameFolder(profileId, gameId), chapterId)
      checkJson(text, MAXIMUM_CHAPTER_LENGTH)
      await mkdir(join(path, '..'), { recursive: true })
      await writeAtomically(path, text)
    })
  }

  hasAsset(fileName: string): Promise<boolean> {
    return this.inTurn(async () => (await stat(this.assetPath(fileName)).catch(() => null))?.isFile() ?? false)
  }

  /** Refuses content that does not match the SHA-256 its name announces. */
  writeAsset(fileName: string, bytes: Uint8Array): Promise<void> {
    return this.inTurn(async () => {
      const path = this.assetPath(fileName)
      if (!(bytes instanceof Uint8Array) || createHash('sha256').update(bytes).digest('hex') !== ASSET_FILE_NAME.exec(fileName)?.[1]) {
        throw new Error(`The content of ${fileName} does not match its name`)
      }
      await mkdir(join(this.folder, 'assets'), { recursive: true })
      await writeAtomically(path, bytes)
    })
  }

  /** Null when the file is not stored. */
  readAsset(fileName: string): Promise<Uint8Array | null> {
    return this.inTurn(async () => {
      try {
        return new Uint8Array(await readFile(this.assetPath(fileName)))
      } catch (error) {
        if (isFileError(error, 'ENOENT')) {
          return null
        }
        throw error
      }
    })
  }

  removeGame(profileId: string, gameId: string): Promise<void> {
    return this.inTurn(async () => {
      await rm(this.gameFolder(profileId, gameId), { recursive: true, force: true })
    })
  }

  removeEarlierGame(gameId: string): Promise<void> {
    return this.inTurn(async () => {
      await rm(this.earlierGameFolder(gameId), { recursive: true, force: true })
    })
  }

  /** Removes a profile's library, every game of it. */
  removeLibrary(profileId: string): Promise<void> {
    return this.inTurn(async () => {
      await rm(join(this.folder, 'profiles', checkedSegment(profileId, 'profile')), { recursive: true, force: true })
    })
  }

  removeAssetsExcept(fileNames: readonly string[]): Promise<void> {
    return this.inTurn(async () => {
      if (!Array.isArray(fileNames) || !fileNames.every(fileName => typeof fileName === 'string')) {
        throw new Error('Expected a list of file names')
      }
      const kept = new Set(fileNames)
      const stored = await readdir(join(this.folder, 'assets')).catch(() => [])
      for (const fileName of stored.filter(candidate => ASSET_FILE_NAME.test(candidate) && !kept.has(candidate))) {
        await unlink(join(this.folder, 'assets', fileName)).catch(() => undefined)
      }
    })
  }

  /** Where an installed asset is, for the page to load it; throws on a name that is not an asset's. */
  assetPath(fileName: string): string {
    if (typeof fileName !== 'string' || !ASSET_FILE_NAME.test(fileName)) {
      throw new Error(`Invalid asset file name ${JSON.stringify(fileName)}`)
    }
    return join(this.folder, 'assets', fileName)
  }

  private gamesFolder(profileId: string) {
    return join(this.folder, 'profiles', checkedSegment(profileId, 'profile'), 'games')
  }

  private gameFolder(profileId: string, gameId: string) {
    return join(this.gamesFolder(profileId), checkedSegment(gameId, 'game'))
  }

  private get earlierFolder() {
    return join(this.folder, 'games')
  }

  private earlierGameFolder(gameId: string) {
    return join(this.earlierFolder, checkedSegment(gameId, 'game'))
  }

  private inTurn<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }
}

export function mediaTypeOfAsset(fileName: string): string | null {
  return MEDIA_TYPES_BY_EXTENSION[ASSET_FILE_NAME.exec(fileName)?.[2] ?? ''] ?? null
}

function checkedSegment(identifier: string, kind: string): string {
  if (typeof identifier !== 'string' || !SAFE_SEGMENT.test(identifier)) {
    throw new Error(`Invalid ${kind} identifier ${JSON.stringify(identifier)}`)
  }
  return identifier
}

/** The manifest of each game folder in there that has one. */
async function readManifestsIn(gamesFolder: string): Promise<string[]> {
  const games = await readdir(gamesFolder, { withFileTypes: true }).catch(() => [])
  const manifests: string[] = []
  for (const game of games.filter(entry => entry.isDirectory() && SAFE_SEGMENT.test(entry.name))) {
    const text = await readOptional(join(gamesFolder, game.name, 'game.json'))
    if (text !== null) {
      manifests.push(text)
    }
  }
  return manifests
}

function chapterPath(gameFolder: string, chapterId: string) {
  return join(gameFolder, 'chapters', `${checkedSegment(chapterId, 'chapter')}.json`)
}

function checkJson(text: string, maximumLength: number) {
  if (!isJsonObject(text, maximumLength)) {
    throw new Error('Expected a JSON object')
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isFileError(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}
