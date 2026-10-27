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
}

/** `<sha-256>.<extension>`: installed assets are named by their content, shared by every game. */
const ASSET_FILE_NAME = new RegExp(`^([0-9a-f]{64})\\.(${Object.keys(MEDIA_TYPES_BY_EXTENSION).join('|')})$`)
const MAXIMUM_MANIFEST_LENGTH = 10_000_000
const MAXIMUM_CHAPTER_LENGTH = 20_000_000

/**
 * The games installed on the desktop, in the application's data folder:
 * `games/<game>/game.json`, `games/<game>/chapters/<chapter>.json` and `assets/<sha-256>.<extension>`.
 * The page checks archives before installing them; this checks again what reaches the disk.
 */
export class LibraryFiles {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly folder: string) {}

  listManifests(): Promise<string[]> {
    return this.inTurn(async () => {
      const games = await readdir(join(this.folder, 'games'), { withFileTypes: true }).catch(() => [])
      const manifests: string[] = []
      for (const game of games.filter(entry => entry.isDirectory() && SAFE_SEGMENT.test(entry.name))) {
        const text = await readOptional(join(this.folder, 'games', game.name, 'game.json'))
        if (text !== null) {
          manifests.push(text)
        }
      }
      return manifests
    })
  }

  readManifest(gameId: string): Promise<string | null> {
    return this.inTurn(() => readOptional(this.manifestPath(gameId)))
  }

  writeManifest(gameId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const path = this.manifestPath(gameId)
      checkJson(text, MAXIMUM_MANIFEST_LENGTH)
      await mkdir(join(path, '..'), { recursive: true })
      await writeAtomically(path, text)
    })
  }

  readChapter(gameId: string, chapterId: string): Promise<string | null> {
    return this.inTurn(() => readOptional(this.chapterPath(gameId, chapterId)))
  }

  writeChapter(gameId: string, chapterId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const path = this.chapterPath(gameId, chapterId)
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

  removeGame(gameId: string): Promise<void> {
    return this.inTurn(async () => {
      await rm(join(this.folder, 'games', checkedSegment(gameId, 'game')), { recursive: true, force: true })
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

  private manifestPath(gameId: string) {
    return join(this.folder, 'games', checkedSegment(gameId, 'game'), 'game.json')
  }

  private chapterPath(gameId: string, chapterId: string) {
    return join(this.folder, 'games', checkedSegment(gameId, 'game'), 'chapters', `${checkedSegment(chapterId, 'chapter')}.json`)
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
