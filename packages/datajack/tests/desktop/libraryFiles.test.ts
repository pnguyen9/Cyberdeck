import { MEDIA_TYPES_BY_EXTENSION as ARCHIVE_MEDIA_TYPES } from '@cyberdeck/core'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LibraryFiles, MEDIA_TYPES_BY_EXTENSION, mediaTypeOfAsset } from '../../electron/libraryFiles.js'

let folder: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'datajack-library-'))
})

afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

const BYTES = new Uint8Array([1, 2, 3])
const ASSET_NAME = `${createHash('sha256').update(BYTES).digest('hex')}.png`

describe('LibraryFiles', () => {
  it('keeps manifests and chapters per game, and lists the games installed', async () => {
    const library = new LibraryFiles(folder)
    await library.writeManifest('game-1', '{"name":"One"}')
    await library.writeManifest('game-2', '{"name":"Two"}')
    await library.writeChapter('game-1', 'chapter-1', '{"nodes":[]}')

    expect((await library.listManifests()).sort()).toEqual(['{"name":"One"}', '{"name":"Two"}'])
    expect(await library.readChapter('game-1', 'chapter-1')).toBe('{"nodes":[]}')
    expect(await library.readChapter('game-1', 'chapter-2')).toBeNull()
    expect(await library.readManifest('game-3')).toBeNull()
  })

  it('stores asset files only when their content matches their name', async () => {
    const library = new LibraryFiles(folder)
    await library.writeAsset(ASSET_NAME, BYTES)

    expect(await library.hasAsset(ASSET_NAME)).toBe(true)
    expect(existsSync(library.assetPath(ASSET_NAME))).toBe(true)
    await expect(library.writeAsset(`${'f'.repeat(64)}.png`, BYTES)).rejects.toThrow('does not match')
    await expect(library.writeAsset(ASSET_NAME.replace('.png', '.exe'), BYTES)).rejects.toThrow('Invalid asset file name')
  })

  it('refuses identifiers that would leave the library folder, and content that is not JSON', async () => {
    const library = new LibraryFiles(folder)
    await expect(library.writeManifest('../escape', '{}')).rejects.toThrow('Invalid game identifier')
    await expect(library.writeChapter('game-1', '../../escape', '{}')).rejects.toThrow('Invalid chapter identifier')
    await expect(library.writeManifest('game-1', 'not json')).rejects.toThrow('Expected a JSON object')
    expect(() => library.assetPath('../profiles.json')).toThrow('Invalid asset file name')
  })

  it('removes a game, then the assets no game keeps', async () => {
    const library = new LibraryFiles(folder)
    const otherBytes = new Uint8Array([4])
    const otherName = `${createHash('sha256').update(otherBytes).digest('hex')}.ogg`
    await library.writeManifest('game-1', '{}')
    await library.writeAsset(ASSET_NAME, BYTES)
    await library.writeAsset(otherName, otherBytes)

    await library.removeGame('game-1')
    await library.removeAssetsExcept([otherName])

    expect(await library.listManifests()).toEqual([])
    expect(await library.hasAsset(ASSET_NAME)).toBe(false)
    expect(await library.hasAsset(otherName)).toBe(true)
  })

  it('serves assets with the media type of their extension, the same list as the archive format', () => {
    expect(MEDIA_TYPES_BY_EXTENSION).toEqual(ARCHIVE_MEDIA_TYPES)
    expect(mediaTypeOfAsset(ASSET_NAME)).toBe('image/png')
    expect(mediaTypeOfAsset('index.html')).toBeNull()
  })
})
