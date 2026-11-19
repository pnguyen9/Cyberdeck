import { MEDIA_TYPES_BY_EXTENSION as ARCHIVE_MEDIA_TYPES } from '@cyberdeck/core'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
  it('keeps manifests and chapters per profile and game, and lists the games of a library', async () => {
    const library = new LibraryFiles(folder)
    await library.writeManifest('profile-1', 'game-1', '{"name":"One"}')
    await library.writeManifest('profile-1', 'game-2', '{"name":"Two"}')
    await library.writeManifest('profile-2', 'game-1', '{"name":"One, older"}')
    await library.writeChapter('profile-1', 'game-1', 'chapter-1', '{"nodes":[]}')

    expect((await library.listManifests('profile-1')).sort()).toEqual(['{"name":"One"}', '{"name":"Two"}'])
    expect(await library.listManifests('profile-2')).toEqual(['{"name":"One, older"}'])
    expect(await library.readChapter('profile-1', 'game-1', 'chapter-1')).toBe('{"nodes":[]}')
    expect(await library.readChapter('profile-2', 'game-1', 'chapter-1')).toBeNull()
    expect(await library.readManifest('profile-1', 'game-3')).toBeNull()
    expect(existsSync(join(folder, 'profiles', 'profile-1', 'games', 'game-1', 'chapters', 'chapter-1.json'))).toBe(true)
  })

  it('reads and removes the games installed before each profile had its own library, and lists every manifest', async () => {
    const library = new LibraryFiles(folder)
    await mkdir(join(folder, 'games', 'game-1', 'chapters'), { recursive: true })
    await writeFile(join(folder, 'games', 'game-1', 'game.json'), '{"name":"Earlier"}')
    await writeFile(join(folder, 'games', 'game-1', 'chapters', 'chapter-1.json'), '{"nodes":[]}')
    await library.writeManifest('profile-1', 'game-2', '{"name":"Two"}')

    expect([await library.listEarlierManifests(), await library.readEarlierChapter('game-1', 'chapter-1')])
      .toEqual([['{"name":"Earlier"}'], '{"nodes":[]}'])
    expect((await library.listAllManifests()).sort()).toEqual(['{"name":"Earlier"}', '{"name":"Two"}'])
    await library.removeEarlierGame('game-1')
    expect(await library.listAllManifests()).toEqual(['{"name":"Two"}'])
    // Only the page's copies are written: the earlier games are never; a profile is always named.
    await expect(library.writeManifest(null as unknown as string, 'game-1', '{}')).rejects.toThrow('Invalid profile identifier')
    await expect(library.readManifest(null as unknown as string, 'game-1')).rejects.toThrow('Invalid profile identifier')
  })

  it('stores asset files only when their content matches their name', async () => {
    const library = new LibraryFiles(folder)
    await library.writeAsset(ASSET_NAME, BYTES)

    expect(await library.hasAsset(ASSET_NAME)).toBe(true)
    expect(existsSync(library.assetPath(ASSET_NAME))).toBe(true)
    expect(await library.readAsset(ASSET_NAME)).toEqual(BYTES)
    expect(await library.readAsset(`${'f'.repeat(64)}.png`)).toBe(null)
    await expect(library.readAsset('../profiles.json')).rejects.toThrow('Invalid asset file name')
    await expect(library.writeAsset(`${'f'.repeat(64)}.png`, BYTES)).rejects.toThrow('does not match')
    await expect(library.writeAsset(ASSET_NAME.replace('.png', '.exe'), BYTES)).rejects.toThrow('Invalid asset file name')
  })

  it('refuses identifiers that would leave the library folder, and content that is not JSON', async () => {
    const library = new LibraryFiles(folder)
    await expect(library.writeManifest('profile-1', '../escape', '{}')).rejects.toThrow('Invalid game identifier')
    await expect(library.writeManifest('../escape', 'game-1', '{}')).rejects.toThrow('Invalid profile identifier')
    await expect(library.writeChapter('profile-1', 'game-1', '../../escape', '{}')).rejects.toThrow('Invalid chapter identifier')
    await expect(library.writeManifest('profile-1', 'game-1', 'not json')).rejects.toThrow('Expected a JSON object')
    await expect(library.removeLibrary('..')).rejects.toThrow('Invalid profile identifier')
    expect(() => library.assetPath('../profiles.json')).toThrow('Invalid asset file name')
  })

  it('removes a game, or a whole library, then the assets no game keeps', async () => {
    const library = new LibraryFiles(folder)
    const otherBytes = new Uint8Array([4])
    const otherName = `${createHash('sha256').update(otherBytes).digest('hex')}.ogg`
    await library.writeManifest('profile-1', 'game-1', '{}')
    await library.writeManifest('profile-2', 'game-1', '{}')
    await library.writeManifest('profile-2', 'game-2', '{}')
    await library.writeAsset(ASSET_NAME, BYTES)
    await library.writeAsset(otherName, otherBytes)

    await library.removeGame('profile-1', 'game-1')
    await library.removeAssetsExcept([otherName])

    expect([await library.listManifests('profile-1'), await library.listManifests('profile-2')]).toEqual([[], ['{}', '{}']])
    await library.removeLibrary('profile-2')
    expect([await library.listAllManifests(), existsSync(join(folder, 'profiles', 'profile-2'))]).toEqual([[], false])
    expect(await library.hasAsset(ASSET_NAME)).toBe(false)
    expect(await library.hasAsset(otherName)).toBe(true)
  })

  it('serves assets with the media type of their extension, the same list as the archive format', () => {
    expect(MEDIA_TYPES_BY_EXTENSION).toEqual(ARCHIVE_MEDIA_TYPES)
    expect(mediaTypeOfAsset(ASSET_NAME)).toBe('image/png')
    expect(mediaTypeOfAsset('index.html')).toBeNull()
  })
})
