import { ArchiveError, assignAsset, createGameArchive, createProject, emptyProgressOf, importText, matchAssetFile, readZip, storeImport, writeZip, type ProjectDocument } from '@cyberdeck/core'
import { describe, expect, it, vi } from 'vitest'
import { describeError } from '../../src/i18n/errorMessages'
import { GameLibrary } from '../../src/library/gameLibrary'
import { createSampleRecord } from '../../src/library/sampleShelf'
import { createProfileTransfer, isProfileFile, PROFILE_FILE_PATH, PROFILE_ZIP_LIMITS, ProfileFileError, profileFileName, readProfileFile, writeProfileFile } from '../../src/profiles/profileFile'
import { gameSettingsKey, lookKey, profileLanguageKey, settingsKey } from '../../src/profiles/profileKeys'
import { createProfileLocks } from '../../src/profiles/profileLocks'
import { createBrowserProfileStore } from '../../src/profiles/profileStore'
import { memoryLibraryStorage } from '../library/memoryLibraryStorage'
import { memoryStorage } from '../memoryStorage'
import { someSave } from '../someSave'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }
const encoder = new TextEncoder()

/** A game of one chapter and one picture, exported as players download it. */
function gameArchive(name: string, gameId: string, exportedAt = '2026-10-01') {
  const environment = { createId: () => gameId, now: () => '2026-10-26T09:00:00.000Z' }
  const stored = storeImport(importText('# One\n[bg: street]\nHello.', { layout: monospaceLayout, locale: 'en' }), createProject({ name, locale: 'en' }, environment), { fileName: null }, { createId: (() => {
    let next = 1
    return () => `${gameId}-${next++}`
  })(), now: environment.now })
  let project: ProjectDocument = { ...stored.project, id: gameId }
  project = assignAsset(project, matchAssetFile('street.png', 'image/png', project)!, { id: 'asset-street', fileName: 'street.png', mediaType: 'image/png', byteSize: 1 })
  return createGameArchive({
    project,
    chapters: stored.chapters,
    includedChapterIds: project.chapterOrder,
    readAsset: async () => new Uint8Array([gameId.length]),
    release: '1.0',
    exportedAt: new Date(exportedAt),
  })
}

/** A device: its profiles, libraries and page storage, all in memory. */
function device(idPrefix = 'home') {
  const storage = memoryStorage()
  let nextId = 1
  const store = createBrowserProfileStore(() => storage, () => `${idPrefix}-${nextId++}`, () => '2026-10-26T10:00:00.000Z')
  const libraryStorage = memoryLibraryStorage()
  const library = new GameLibrary(libraryStorage.storage)
  const locks = createProfileLocks(() => storage, { iterations: 1000 })
  const transfer = createProfileTransfer({ store, library, locks, storage: () => storage })
  return { storage, store, library, libraryStorage, locks, transfer }
}

const saveOf = (gameId: string, gameName: string) => ({ ...someSave(), game: { id: gameId, name: gameName } })

/** Pascal, with a game, a save of it, its progress, a save of a game removed since, settings, a look, a language, a sample installed and a PIN. */
async function pascalOn(here: ReturnType<typeof device>) {
  const pascal = await here.store.create('Pascal', null)
  await here.library.install(await gameArchive('The Letter', 'letter'), pascal.id)
  const saves = here.store.saveStore(pascal.id)
  await saves.write('letter', '2', saveOf('letter', 'The Letter'))
  await saves.writeProgress('letter', { ...emptyProgressOf({ id: 'letter', name: 'The Letter' }), endingIds: ['home'] })
  await saves.write('gone', 'auto', saveOf('gone', 'Gone'))
  here.storage.setItem(settingsKey(pascal.id), '{"textSpeed":3}')
  here.storage.setItem(gameSettingsKey(pascal.id, 'letter'), '{"textSpeed":1}')
  here.storage.setItem(lookKey(pascal.id), 'paper')
  here.storage.setItem(profileLanguageKey(pascal.id), 'fr')
  createSampleRecord(() => here.storage).write(pascal.id, 'knee-deep', 'abc')
  await here.locks.set(pascal.id, '1234')
  return pascal
}

describe('profile files', () => {
  it('carry a whole profile to another device: games, saves, progress, settings, look, language, samples and PIN', async () => {
    const home = device()
    const pascal = await pascalOn(home)
    const file = await home.transfer.exportFile(pascal, new Date('2026-11-19T10:00:00Z'))

    const away = device('away')
    await away.store.create('Alex', null)
    const contents = await readProfileFile(file)
    const outcome = await away.transfer.importFile(contents, 'Pascal', null)

    expect(contents.exportedAt).toEqual(new Date('2026-11-19T10:00:00Z'))
    expect(outcome).toEqual({ profile: expect.objectContaining({ id: 'away-2', name: 'Pascal' }), games: 1, saves: 2 })
    const id = outcome.profile.id
    expect((await away.library.list(id)).map(entry => `${entry.name} ${entry.release}`)).toEqual(['The Letter 1.0'])
    expect((await away.library.open('letter', id)).assetUrls.size).toBe(1)
    const saves = away.store.saveStore(id)
    expect((await saves.read('letter', '2'))?.game.id).toBe('letter')
    expect((await saves.read('gone', 'auto'))?.game.id).toBe('gone')
    expect((await saves.readProgress('letter'))?.endingIds).toEqual(['home'])
    expect([settingsKey(id), gameSettingsKey(id, 'letter'), lookKey(id), profileLanguageKey(id)].map(key => away.storage.getItem(key)))
      .toEqual(['{"textSpeed":3}', '{"textSpeed":1}', 'paper', 'fr'])
    expect(createSampleRecord(() => away.storage).read(id)).toEqual({ 'knee-deep': 'abc' })
    expect(away.locks.isLocked(id)).toBe(true)
    expect(await away.locks.check(id, '0000')).toEqual({ outcome: 'wrong', triesLeft: 4 })
    expect(await away.locks.check(id, '1234')).toEqual({ outcome: 'right' })
    // Imported, not chosen: the profile opening at the next start is still the one it was.
    expect((await away.store.list()).lastUsedId).toBe('away-1')
  })

  it('always add a new profile, even on the device they came from: the profile there is left as it is', async () => {
    const home = device()
    const pascal = await pascalOn(home)
    const file = await readProfileFile(await home.transfer.exportFile(pascal))
    await home.library.install(await gameArchive('Other', 'other'), pascal.id)

    const outcome = await home.transfer.importFile(file, 'Pascal 2', null)

    expect(outcome.profile.id).not.toBe(pascal.id)
    expect((await home.store.list()).profiles.map(profile => profile.name)).toEqual(['Pascal', 'Pascal 2'])
    expect((await home.library.list(pascal.id)).map(entry => entry.name)).toEqual(['Other', 'The Letter'])
    expect((await home.library.list(outcome.profile.id)).map(entry => entry.name)).toEqual(['The Letter'])
    expect([home.locks.isLocked(pascal.id), home.locks.isLocked(outcome.profile.id)]).toEqual([true, true])
  })

  it('import nothing when a part cannot be written: the new profile is removed again, the others left as they were', async () => {
    const home = device()
    const pascal = await pascalOn(home)
    const file = await readProfileFile(await home.transfer.exportFile(pascal))
    const saveStore = home.store.saveStore
    vi.spyOn(home.store, 'saveStore').mockImplementation(profileId => ({ ...saveStore(profileId), writeProgress: async () => false }))

    const error = await home.transfer.importFile(file, 'Pascal 2', null).catch((caught: unknown) => caught)

    expect(describeError(error, 'en')).toBe('The progress of The Letter could not be written.')
    expect(describeError(error, 'fr')).toBe('La progression de The Letter n’a pas pu être enregistrée.')
    const { profiles } = await home.store.list()
    expect(profiles.map(profile => profile.name)).toEqual(['Pascal'])
    expect(home.storage.getItem(settingsKey('home-2'))).toBe(null)
    expect(home.locks.isLocked('home-2')).toBe(false)
    expect(await home.library.list('home-2')).toEqual([])
    expect((await home.library.list(pascal.id)).map(entry => entry.name)).toEqual(['The Letter'])
  })

  it('are read when zipped again inside a folder, as a player removing a password may do', async () => {
    const home = device()
    const file = await home.transfer.exportFile(await pascalOn(home))
    const refolded = await writeZip(await Promise.all(readZip(file).map(async entry => ({ path: `Pascal/${entry.path}`, bytes: await entry.read(), compress: false }))), new Date())

    expect((await readProfileFile(refolded)).profile.name).toBe('Pascal')
    expect(isProfileFile(refolded)).toBe(true)
  })

  it('read a game larger than a game archive’s own files may be, as one entry of the file', async () => {
    const home = device()
    const file = await home.transfer.exportFile(await pascalOn(home))
    // The game's entry announces 300 MB: over what a game archive takes for one file, under what a profile file takes.
    const view = new DataView(file.buffer)
    let position = view.getUint32(file.length - 22 + 16, true)
    while (!new TextDecoder().decode(file.subarray(position + 46, position + 46 + view.getUint16(position + 28, true))).startsWith('games/')) {
      position += 46 + view.getUint16(position + 28, true) + view.getUint16(position + 30, true) + view.getUint16(position + 32, true)
    }
    view.setUint32(position + 24, 300 * 1024 * 1024, true)

    expect(PROFILE_ZIP_LIMITS.maximumEntrySize).toBe(PROFILE_ZIP_LIMITS.maximumTotalSize)
    const error = await readProfileFile(file).catch((caught: unknown) => caught)
    // Listed, then read: only its content, no longer matching, is refused.
    expect(error).toBeInstanceOf(ProfileFileError)
    expect((error as ProfileFileError).problem).toMatchObject({ code: 'game', error: { problem: { code: 'damagedFile' } } })
  })

  it('are not made larger than importing reads: the export stops before the game that would not fit', async () => {
    const archiveOf = vi.fn(async () => new Uint8Array(600))
    const contents = { profile: { id: 'p', name: 'Pascal' }, games: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }, { id: 'three', name: 'Three' }], archiveOf, saves: [], progress: [], settings: null, gameSettings: {}, look: null, language: null, samples: {}, pin: null }

    const error = await writeProfileFile(contents, new Date(), { ...PROFILE_ZIP_LIMITS, maximumTotalSize: 1500 }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ProfileFileError)
    expect(archiveOf).toHaveBeenCalledTimes(2)
    const atTwoGigabytes = new ProfileFileError({ code: 'tooLarge', maximumSize: PROFILE_ZIP_LIMITS.maximumTotalSize })
    expect(describeError(atTwoGigabytes, 'en')).toBe('This profile is too large for one file: a profile file holds at most 2 GB. Remove a few games from its library, then export it again.')
    expect(describeError(atTwoGigabytes, 'fr')).toBe('Ce profil est trop volumineux pour un seul fichier\u00a0: un fichier de profil contient au plus 2\u00a0Go. Retirez quelques jeux de sa bibliothèque, puis exportez-le de nouveau.')
  })

  it('are named after the profile, in the player’s language', () => {
    expect([profileFileName('Pascal', 'en'), profileFileName('Pascal', 'fr'), profileFileName('a/b:', 'fr'), profileFileName('***', 'en')])
      .toEqual(['Pascal - Datajack profile.zip', 'Pascal - profil Datajack.zip', 'ab - profil Datajack.zip', 'Profile - Datajack profile.zip'])
  })

  describe('refuse, worded for players', () => {
    const refusal = async (bytes: Uint8Array<ArrayBuffer>) => readProfileFile(bytes).then(() => null, (error: unknown) => error)
    const profileJson = (value: unknown) => writeZip([{ path: PROFILE_FILE_PATH, bytes: encoder.encode(JSON.stringify(value)), compress: true }], new Date())

    it('a file that is no profile file, a game, a newer format, a damaged one', async () => {
      const errors = [
        await refusal(await writeZip([{ path: 'notes.txt', bytes: encoder.encode('hello'), compress: true }], new Date())),
        await refusal(await gameArchive('The Letter', 'letter')),
        await refusal(await profileJson({ profileFormat: 2 })),
        await refusal(await profileJson({ profileFormat: 1, profile: { id: '../up', name: 'Pascal' }, games: [] })),
        await refusal(await profileJson({ profileFormat: 1, profile: { id: 'p', name: 'Pascal' }, games: [{ id: 'letter', name: 'The Letter' }] })),
      ]
      expect(errors.every(error => error instanceof ProfileFileError)).toBe(true)
      expect(errors.map(error => describeError(error, 'en'))).toEqual([
        'This file is not a Datajack profile file.',
        'This file is a game, not a profile: open a profile, then use Add a game…',
        'This profile file was made by a newer Datajack: update Datajack, then import the file again.',
        'This profile file is damaged. If you can, export the profile again from the device it came from.',
        'This profile file is damaged. If you can, export the profile again from the device it came from.',
      ])
      expect(errors.map(error => describeError(error, 'fr'))).toEqual([
        'Ce fichier n’est pas un fichier de profil Datajack.',
        'Ce fichier est un jeu, pas un profil : ouvrez un profil, puis utilisez Ajouter un jeu…',
        'Ce fichier de profil a été créé par une version plus récente de Datajack : mettez Datajack à jour, puis importez de nouveau le fichier.',
        'Ce fichier de profil est endommagé. Si vous le pouvez, exportez de nouveau le profil depuis l’appareil d’origine.',
        'Ce fichier de profil est endommagé. Si vous le pouvez, exportez de nouveau le profil depuis l’appareil d’origine.',
      ])
    })

    it('a game of the file that cannot be installed, saying which and why', async () => {
      const contents = { profile: { id: 'p', name: 'Pascal' }, games: [{ id: 'letter', name: 'The Letter' }], archiveOf: async () => encoder.encode('not a zip'), saves: [], progress: [], settings: null, gameSettings: {}, look: null, language: null, samples: {}, pin: null }
      const error = await refusal(await writeProfileFile(contents, new Date()))
      expect(describeError(error, 'en')).toBe('The Letter, in this file, cannot be installed: This file is not a ZIP archive')
      expect(describeError(error, 'fr')).toBe('Le jeu The Letter de ce fichier ne peut pas être installé : Ce fichier n’est pas une archive ZIP')
    })

    it('a PIN asking more rounds than any Datajack would, which would keep the page busy', async () => {
      const locks = createProfileLocks(() => memoryStorage(), { iterations: 1000 })
      expect(locks.restore('p', { salt: 'AAAA', hash: 'AAAA', iterations: 1e12 })).toBe(false)
      expect(locks.restore('p', { salt: 'AAAA', hash: 'AAAA' })).toBe(false)
      expect(locks.isLocked('p')).toBe(false)
    })

    it('a PIN whose salt or hash no PIN could match, which would lock the profile for ever', async () => {
      const storage = memoryStorage()
      const home = createProfileLocks(() => storage, { iterations: 1000 })
      await home.set('p', '1234')
      const carried = home.carried('p')!
      const locks = createProfileLocks(() => memoryStorage(), { iterations: 1000 })

      expect([
        locks.restore('q', { ...carried, salt: 'AAAA' }),
        locks.restore('q', { ...carried, hash: 'not base64!' }),
        locks.restore('q', { ...carried, hash: carried.hash.slice(4) }),
        locks.isLocked('q'),
      ]).toEqual([false, false, false, false])
      expect(locks.restore('q', carried)).toBe(true)
      expect(await locks.check('q', '1234')).toEqual({ outcome: 'right' })
    })
  })
})

describe('zips locked with a password', () => {
  /** A tiny zip whose entry is marked encrypted, as zip tools mark it: in the file list, or only in its own header. */
  async function lockedZip(where: 'list' | 'header') {
    const bytes = await writeZip([{ path: PROFILE_FILE_PATH, bytes: encoder.encode('{}'), compress: false }], new Date())
    const view = new DataView(bytes.buffer)
    const flagsOffset = where === 'header' ? 6 : view.getUint32(bytes.length - 22 + 16, true) + 8
    view.setUint16(flagsOffset, view.getUint16(flagsOffset, true) | 1, true)
    return bytes
  }

  it('are refused by every import, which says how to give Datajack one it reads', async () => {
    for (const where of ['list', 'header'] as const) {
      const bytes = await lockedZip(where)
      const asProfile = await readProfileFile(bytes).catch((error: unknown) => error)
      const asGame = await new GameLibrary(memoryLibraryStorage().storage).install(bytes, 'p').catch((error: unknown) => error)
      for (const error of [asProfile, asGame]) {
        expect(error).toBeInstanceOf(ArchiveError)
        expect(describeError(error, 'en')).toBe('This file is locked with a password, which Datajack cannot open. Unzip it with its password, zip what it holds again without one, then use that new file.')
        expect(describeError(error, 'fr')).toBe('Ce fichier est protégé par un mot de passe, que Datajack ne sait pas ouvrir. Décompressez-le avec son mot de passe, compressez de nouveau son contenu sans mot de passe, puis utilisez ce nouveau fichier.')
      }
    }
  })
})
