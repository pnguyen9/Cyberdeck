import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProfileFiles } from '../../electron/profileFiles.js'

let root: string
let settingsFolder: string
let documentsFolder: string

function createProfileFiles() {
  let nextId = 1
  return new ProfileFiles({
    settingsFolder,
    documentsFolder,
    createId: () => `profile-${nextId++}`,
    now: () => '2026-10-26T10:00:00.000Z',
  })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'datajack-profiles-'))
  settingsFolder = join(root, 'settings')
  documentsFolder = join(root, 'Documents')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const SAVE_TEXT = JSON.stringify({ saveFormat: 1, game: 'Sandbox' })

describe('profiles', () => {
  it('starts without any profile', async () => {
    expect(await createProfileFiles().list()).toEqual({ profiles: [], lastUsedId: null })
  })

  it('creates a profile saving in a folder of the documents by default, and remembers it as the last used', async () => {
    const profile = await createProfileFiles().create('Pascal', null)

    expect(profile).toEqual({
      id: 'profile-1',
      name: 'Pascal',
      saveFolder: join(documentsFolder, 'Datajack', 'Pascal'),
      createdAt: '2026-10-26T10:00:00.000Z',
    })
    expect(await createProfileFiles().list()).toEqual({ profiles: [profile], lastUsedId: 'profile-1' })
  })

  it('creates a profile saving in a folder of the player\'s choice', async () => {
    const folder = join(root, 'Dropbox', 'saves')
    expect((await createProfileFiles().create('Pascal', folder)).saveFolder).toBe(folder)
  })

  it('makes the default folder safe for every system and distinct from other profiles', async () => {
    const profileFiles = createProfileFiles()
    expect(await profileFiles.defaultSaveFolder(' Pas:cal? ')).toBe(join(documentsFolder, 'Datajack', 'Pascal'))
    expect(await profileFiles.defaultSaveFolder('CON')).toBe(join(documentsFolder, 'Datajack', 'Profile'))
    expect(await profileFiles.defaultSaveFolder('...')).toBe(join(documentsFolder, 'Datajack', 'Profile'))

    await profileFiles.create('Pascal', null)
    expect(await profileFiles.defaultSaveFolder('pascal?')).toBe(join(documentsFolder, 'Datajack', 'pascal 2'))
  })

  it('refuses blank names and names already taken, whatever the case', async () => {
    const profileFiles = createProfileFiles()
    await profileFiles.create('Pascal', null)
    const other = await profileFiles.create('Alex', null)

    await expect(profileFiles.create('  ', null)).rejects.toThrow('name')
    await expect(profileFiles.create('PASCAL', null)).rejects.toThrow('name')
    await expect(profileFiles.rename(other.id, 'pascal')).rejects.toThrow('name')
  })

  it('refuses a save folder already used by another profile', async () => {
    const profileFiles = createProfileFiles()
    const pascal = await profileFiles.create('Pascal', null)
    const alex = await profileFiles.create('Alex', null)

    await expect(profileFiles.create('Sam', pascal.saveFolder)).rejects.toThrow('folder')
    await expect(profileFiles.changeSaveFolder(alex.id, pascal.saveFolder)).rejects.toThrow('folder')
  })

  it('renames a profile without moving its saves', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)
    await profileFiles.rename(profile.id, 'Pascal N.')

    expect((await profileFiles.list()).profiles).toEqual([{ ...profile, name: 'Pascal N.' }])
  })

  it('remembers the profile last used', async () => {
    const profileFiles = createProfileFiles()
    const pascal = await profileFiles.create('Pascal', null)
    await profileFiles.create('Alex', null)
    await profileFiles.use(pascal.id)

    expect((await createProfileFiles().list()).lastUsedId).toBe(pascal.id)
    await expect(profileFiles.use('unknown')).rejects.toThrow('profile')
  })

  it('forgets a removed profile but leaves its saves on the disk', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)
    await profileFiles.writeSave(profile.id, 'game-1', 'auto', SAVE_TEXT)
    await profileFiles.remove(profile.id)

    expect(await profileFiles.list()).toEqual({ profiles: [], lastUsedId: null })
    expect(existsSync(join(profile.saveFolder, 'game-1', 'auto.json'))).toBe(true)
  })

  it('sets aside an unreadable profile list rather than overwriting it', async () => {
    await mkdir(settingsFolder, { recursive: true })
    await writeFile(join(settingsFolder, 'profiles.json'), '{ broken')
    const profileFiles = createProfileFiles()

    expect(await profileFiles.list()).toEqual({ profiles: [], lastUsedId: null })
    await profileFiles.create('Pascal', null)
    const kept = (await readdir(settingsFolder)).filter(fileName => fileName.startsWith('profiles.json.unreadable'))
    expect(kept).toHaveLength(1)
    expect(await readFile(join(settingsFolder, kept[0]!), 'utf8')).toBe('{ broken')
  })
})

describe('saves', () => {
  it('writes each save as a readable file per game and slot, and reads it back', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)

    expect(await profileFiles.readSave(profile.id, 'game-1', '1')).toBeNull()
    await profileFiles.writeSave(profile.id, 'game-1', '1', SAVE_TEXT)

    expect(await profileFiles.readSave(profile.id, 'game-1', '1')).toBe(SAVE_TEXT)
    expect(await readdir(join(profile.saveFolder, 'game-1'))).toEqual(['1.json'])
  })

  it('keeps the last of many writes made in a burst', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)
    const texts = Array.from({ length: 20 }, (_, index) => JSON.stringify({ saveFormat: 1, index }))

    await Promise.all(texts.map(text => profileFiles.writeSave(profile.id, 'game-1', 'auto', text)))

    expect(await profileFiles.readSave(profile.id, 'game-1', 'auto')).toBe(texts.at(-1))
    expect(await readdir(join(profile.saveFolder, 'game-1'))).toEqual(['auto.json'])
  })

  it('refuses game names and slots that would leave the save folder', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)

    await expect(profileFiles.writeSave(profile.id, '..', 'auto', SAVE_TEXT)).rejects.toThrow('game')
    await expect(profileFiles.writeSave(profile.id, 'game-1', '../auto', SAVE_TEXT)).rejects.toThrow('slot')
    await expect(profileFiles.readSave(profile.id, 'a/b', 'auto')).rejects.toThrow('game')
  })

  it('refuses to write anything but a JSON object', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)

    await expect(profileFiles.writeSave(profile.id, 'game-1', 'auto', 'not json')).rejects.toThrow('save')
    await expect(profileFiles.writeSave(profile.id, 'game-1', 'auto', '[1, 2]')).rejects.toThrow('save')
  })

  it('moves the saves to a new folder, keeping those already there', async () => {
    const profileFiles = createProfileFiles()
    const profile = await profileFiles.create('Pascal', null)
    await profileFiles.writeSave(profile.id, 'game-1', 'auto', SAVE_TEXT)
    await profileFiles.writeSave(profile.id, 'game-1', '1', SAVE_TEXT)
    await profileFiles.writeSave(profile.id, 'game-2', 'auto', SAVE_TEXT)
    await writeFile(join(profile.saveFolder, 'notes.txt'), 'mine')
    const newFolder = join(root, 'Dropbox')
    await mkdir(join(newFolder, 'game-1'), { recursive: true })
    await writeFile(join(newFolder, 'game-1', 'auto.json'), '{"fromOtherComputer":true}')

    expect(await profileFiles.changeSaveFolder(profile.id, newFolder)).toEqual({ moved: 2, keptInNewFolder: 1 })

    expect((await profileFiles.list()).profiles[0]?.saveFolder).toBe(newFolder)
    expect(await profileFiles.readSave(profile.id, 'game-1', 'auto')).toBe('{"fromOtherComputer":true}')
    expect(await profileFiles.readSave(profile.id, 'game-1', '1')).toBe(SAVE_TEXT)
    expect(await profileFiles.readSave(profile.id, 'game-2', 'auto')).toBe(SAVE_TEXT)
    expect(existsSync(join(profile.saveFolder, 'game-1', 'auto.json'))).toBe(true)
    expect(existsSync(join(profile.saveFolder, 'game-2'))).toBe(false)
    expect(existsSync(join(profile.saveFolder, 'notes.txt'))).toBe(true)
  })
})
