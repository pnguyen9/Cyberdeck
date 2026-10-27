import { constants } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, rmdir, unlink } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import type { ProfileList, ProfileRecord, SaveFolderChange } from './bridge.js'
import { isFileError, isJsonObject, SAFE_SEGMENT, writeAtomically } from '@cyberdeck/desktop/files'
import { checkedProfileName } from './profileNames.js'

export interface ProfileFilesOptions {
  /** Where the list of profiles is kept: the application's own data folder. */
  settingsFolder: string
  /** Parent of the default save folders, `Datajack/<profile name>`. */
  documentsFolder: string
  createId: () => string
  now: () => string
}

interface SettingsFile {
  version: 1
  profiles: ProfileRecord[]
  lastUsedId: string | null
}

const SAVE_EXTENSION = '.json'
/** Saves are small; the progress of a long game, holding a state per choice reached, is larger. */
const MAXIMUM_SAVE_LENGTH = 20_000_000
/** Characters Windows refuses in file names; control characters are removed too. */
const UNSAFE_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\p{Cc}]/gu
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i
const FALLBACK_FOLDER_NAME = 'Profile'

/**
 * The profiles of the desktop player and their save files. Each save is a JSON file at
 * `<save folder>/<game>/<slot>.json`, replaced in one move so that a crash never leaves half a save.
 * Operations run one after another, so that a burst of autosaves lands in order.
 */
export class ProfileFiles {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: ProfileFilesOptions) {}

  list(): Promise<ProfileList> {
    return this.inTurn(async () => {
      const { profiles, lastUsedId } = await this.readSettings()
      return { profiles, lastUsedId }
    })
  }

  defaultSaveFolder(name: string): Promise<string> {
    return this.inTurn(async () => this.defaultSaveFolderAmong(name, (await this.readSettings()).profiles))
  }

  create(name: string, saveFolder: string | null): Promise<ProfileRecord> {
    return this.inTurn(async () => {
      const settings = await this.readSettings()
      const trimmedName = checkedProfileName(name, settings.profiles.map(profile => profile.name))
      const profile: ProfileRecord = {
        id: this.options.createId(),
        name: trimmedName,
        saveFolder: saveFolder === null
          ? this.defaultSaveFolderAmong(trimmedName, settings.profiles)
          : checkedFolder(saveFolder, settings.profiles),
        createdAt: this.options.now(),
      }
      await this.writeSettings({ ...settings, profiles: [...settings.profiles, profile], lastUsedId: profile.id })
      return profile
    })
  }

  rename(profileId: string, name: string): Promise<void> {
    return this.inTurn(async () => {
      const settings = await this.readSettings()
      const profile = findProfile(settings, profileId)
      const trimmedName = checkedProfileName(name, settings.profiles.filter(other => other !== profile).map(other => other.name))
      await this.writeSettings(replaceProfile(settings, { ...profile, name: trimmedName }))
    })
  }

  remove(profileId: string): Promise<void> {
    return this.inTurn(async () => {
      const settings = await this.readSettings()
      findProfile(settings, profileId)
      await this.writeSettings({
        ...settings,
        profiles: settings.profiles.filter(profile => profile.id !== profileId),
        lastUsedId: settings.lastUsedId === profileId ? null : settings.lastUsedId,
      })
    })
  }

  use(profileId: string): Promise<void> {
    return this.inTurn(async () => {
      const settings = await this.readSettings()
      findProfile(settings, profileId)
      await this.writeSettings({ ...settings, lastUsedId: profileId })
    })
  }

  /**
   * Moves the saves into the new folder. A save already there for the same game and slot, written
   * on another computer sharing the folder for instance, is kept, and the old one left where it was.
   */
  changeSaveFolder(profileId: string, saveFolder: string): Promise<SaveFolderChange> {
    return this.inTurn(async () => {
      const settings = await this.readSettings()
      const profile = findProfile(settings, profileId)
      const newFolder = checkedFolder(saveFolder, settings.profiles.filter(other => other !== profile))
      const change: SaveFolderChange = { moved: 0, keptInNewFolder: 0 }
      if (newFolder !== resolve(profile.saveFolder)) {
        for (const [gameId, slots] of await savesIn(profile.saveFolder)) {
          await mkdir(join(newFolder, gameId), { recursive: true })
          for (const slot of slots) {
            const fileName = slot + SAVE_EXTENSION
            try {
              await copyFile(join(profile.saveFolder, gameId, fileName), join(newFolder, gameId, fileName), constants.COPYFILE_EXCL)
              await unlink(join(profile.saveFolder, gameId, fileName))
              change.moved++
            } catch (error) {
              if (!isFileError(error, 'EEXIST')) {
                throw error
              }
              change.keptInNewFolder++
            }
          }
          await rmdir(join(profile.saveFolder, gameId)).catch(() => undefined)
        }
      }
      await this.writeSettings(replaceProfile(settings, { ...profile, saveFolder: newFolder }))
      return change
    })
  }

  readSave(profileId: string, gameId: string, slot: string): Promise<string | null> {
    return this.inTurn(async () => {
      const path = saveFilePath(findProfile(await this.readSettings(), profileId), gameId, slot)
      try {
        return await readFile(path, 'utf8')
      } catch (error) {
        if (isFileError(error, 'ENOENT')) {
          return null
        }
        throw error
      }
    })
  }

  writeSave(profileId: string, gameId: string, slot: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const path = saveFilePath(findProfile(await this.readSettings(), profileId), gameId, slot)
      if (!isJsonObject(text, MAXIMUM_SAVE_LENGTH)) {
        throw new Error('A save must be a JSON object')
      }
      await mkdir(join(path, '..'), { recursive: true })
      await writeAtomically(path, text)
    })
  }

  private inTurn<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }

  private get settingsPath() {
    return join(this.options.settingsFolder, 'profiles.json')
  }

  /** A file that cannot be read is set aside, never overwritten: the saves themselves stay in their folders. */
  private async readSettings(): Promise<SettingsFile> {
    let text: string
    try {
      text = await readFile(this.settingsPath, 'utf8')
    } catch (error) {
      if (isFileError(error, 'ENOENT')) {
        return { version: 1, profiles: [], lastUsedId: null }
      }
      throw error
    }
    const settings = parseSettings(text)
    if (settings === null) {
      await rename(this.settingsPath, `${this.settingsPath}.unreadable-${Date.now()}`)
      return { version: 1, profiles: [], lastUsedId: null }
    }
    return settings
  }

  private async writeSettings(settings: SettingsFile) {
    await mkdir(this.options.settingsFolder, { recursive: true })
    await writeAtomically(this.settingsPath, JSON.stringify(settings, null, 2))
  }

  private defaultSaveFolderAmong(name: string, profiles: ProfileRecord[]): string {
    const baseName = safeFolderName(name)
    // Windows and macOS see Pascal and pascal as the same folder.
    const taken = new Set(profiles.map(profile => resolve(profile.saveFolder).toLocaleLowerCase()))
    for (let number = 1; ; number++) {
      const folder = join(this.options.documentsFolder, 'Datajack', number === 1 ? baseName : `${baseName} ${number}`)
      if (!taken.has(resolve(folder).toLocaleLowerCase())) {
        return folder
      }
    }
  }
}

function checkedFolder(folder: string, otherProfiles: ProfileRecord[]): string {
  if (!isAbsolute(folder)) {
    throw new Error('A save folder must be an absolute path.')
  }
  const resolvedFolder = resolve(folder)
  if (otherProfiles.some(profile => resolve(profile.saveFolder) === resolvedFolder)) {
    throw new Error('Another profile already saves in this folder.')
  }
  return resolvedFolder
}

function safeFolderName(name: string): string {
  const cleaned = name.replace(UNSAFE_FILE_NAME_CHARACTERS, '').trim().replace(/[. ]+$/, '')
  return cleaned === '' || RESERVED_WINDOWS_NAMES.test(cleaned) ? FALLBACK_FOLDER_NAME : cleaned
}

function findProfile(settings: SettingsFile, profileId: string): ProfileRecord {
  const profile = settings.profiles.find(candidate => candidate.id === profileId)
  if (profile === undefined) {
    throw new Error(`No profile ${profileId}`)
  }
  return profile
}

function replaceProfile(settings: SettingsFile, profile: ProfileRecord): SettingsFile {
  return { ...settings, profiles: settings.profiles.map(other => other.id === profile.id ? profile : other) }
}

function saveFilePath(profile: ProfileRecord, gameId: string, slot: string): string {
  if (!SAFE_SEGMENT.test(gameId)) {
    throw new Error(`Invalid game identifier ${JSON.stringify(gameId)}`)
  }
  if (!SAFE_SEGMENT.test(slot)) {
    throw new Error(`Invalid slot ${JSON.stringify(slot)}`)
  }
  return join(profile.saveFolder, gameId, slot + SAVE_EXTENSION)
}

/** The slots saved in a folder, by game; files and folders that are not saves are left out. */
async function savesIn(folder: string): Promise<Map<string, string[]>> {
  const saves = new Map<string, string[]>()
  const games = await readdir(folder, { withFileTypes: true }).catch(() => [])
  for (const game of games) {
    if (!game.isDirectory() || !SAFE_SEGMENT.test(game.name)) {
      continue
    }
    const slots = (await readdir(join(folder, game.name)))
      .filter(fileName => fileName.endsWith(SAVE_EXTENSION))
      .map(fileName => fileName.slice(0, -SAVE_EXTENSION.length))
      .filter(slot => SAFE_SEGMENT.test(slot))
    saves.set(game.name, slots)
  }
  return saves
}

function parseSettings(text: string): SettingsFile | null {
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null || !('profiles' in value) || !Array.isArray(value.profiles)) {
      return null
    }
    const profiles = value.profiles.filter(isProfileRecord)
    const lastUsedId = 'lastUsedId' in value && typeof value.lastUsedId === 'string'
      && profiles.some(profile => profile.id === value.lastUsedId) ? value.lastUsedId : null
    return { version: 1, profiles, lastUsedId }
  } catch {
    return null
  }
}

function isProfileRecord(value: unknown): value is ProfileRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string'
    && typeof record.saveFolder === 'string' && isAbsolute(record.saveFolder) && typeof record.createdAt === 'string'
}
