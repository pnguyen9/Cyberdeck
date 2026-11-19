import type { SaveFolderChange } from '../../electron/bridge'
import { checkedProfileName } from '../../electron/profileNames'
import { createStorageSaveStore, storageKeysStartingWith, type Locale, type SaveStore } from '@cyberdeck/stage'
import { PROFILES_KEY, savesKeyPrefix } from './profileKeys'

/** Who is playing, and where their saves go. */
export interface Profile {
  id: string
  name: string
  /** Null in the browser, which keeps the saves itself. */
  saveFolder: string | null
  createdAt: string
}

export interface ProfileList {
  profiles: Profile[]
  /** Opened directly at the next start, without asking again. */
  lastUsedId: string | null
}

export interface ProfileStore {
  /** True on the desktop, where saves are files in a folder the player chooses. */
  readonly choosesSaveFolder: boolean
  list: () => Promise<ProfileList>
  /** Where a new profile of that name saves unless the player chooses; null in the browser. */
  defaultSaveFolder: (name: string) => Promise<string | null>
  /** Asks the player for a folder, in their language; null when cancelled, and always in the browser. */
  chooseFolder: (locale: Locale) => Promise<string | null>
  /** Throws an error worded for the player when the name is blank or taken. */
  create: (name: string, saveFolder: string | null) => Promise<Profile>
  rename: (profileId: string, name: string) => Promise<void>
  /** Forgets the profile. Desktop save files stay on the disk; browser saves are deleted with it. */
  remove: (profileId: string) => Promise<void>
  /** The profile that opens directly at the next start; null after switching, so the profiles screen shows. */
  use: (profileId: string | null) => Promise<void>
  changeSaveFolder: (profileId: string, saveFolder: string) => Promise<SaveFolderChange>
  saveStore: (profileId: string) => SaveStore
  /** The games the profile has saves or progress of, installed or not. */
  savedGames: (profileId: string) => Promise<string[]>
}


/** Profiles kept in a `Storage` (`localStorage`), with their saves next to them. */
export function createBrowserProfileStore(getStorage: () => Storage, createId: () => string, now: () => string): ProfileStore {
  const read = (): ProfileList => {
    try {
      const value: unknown = JSON.parse(getStorage().getItem(PROFILES_KEY) ?? 'null')
      return isProfileList(value) ? value : { profiles: [], lastUsedId: null }
    } catch {
      return { profiles: [], lastUsedId: null }
    }
  }
  const write = (list: ProfileList) => getStorage().setItem(PROFILES_KEY, JSON.stringify(list))
  const saveStoreOf = (profileId: string) => createStorageSaveStore(getStorage, savesKeyPrefix(profileId))
  const find = (list: ProfileList, profileId: string) => {
    const profile = list.profiles.find(candidate => candidate.id === profileId)
    if (profile === undefined) {
      throw new Error(`No profile ${profileId}.`)
    }
    return profile
  }

  return {
    choosesSaveFolder: false,
    list: async () => read(),
    defaultSaveFolder: async () => null,
    chooseFolder: async () => null,
    create: async name => {
      const list = read()
      const profile: Profile = {
        id: createId(),
        name: checkedProfileName(name, list.profiles.map(other => other.name)),
        saveFolder: null,
        createdAt: now(),
      }
      write({ profiles: [...list.profiles, profile], lastUsedId: profile.id })
      return profile
    },
    rename: async (profileId, name) => {
      const list = read()
      const profile = find(list, profileId)
      const otherNames = list.profiles.filter(other => other !== profile).map(other => other.name)
      const renamed = { ...profile, name: checkedProfileName(name, otherNames) }
      write({ ...list, profiles: list.profiles.map(other => other === profile ? renamed : other) })
    },
    remove: async profileId => {
      const list = read()
      find(list, profileId)
      await saveStoreOf(profileId).eraseAll()
      write({
        profiles: list.profiles.filter(profile => profile.id !== profileId),
        lastUsedId: list.lastUsedId === profileId ? null : list.lastUsedId,
      })
    },
    use: async profileId => {
      const list = read()
      if (profileId !== null) find(list, profileId)
      write({ ...list, lastUsedId: profileId })
    },
    changeSaveFolder: async () => {
      throw new Error('The browser keeps the saves itself.')
    },
    saveStore: saveStoreOf,
    // Keys are `<prefix><game>:<slot>`, a game's identifier holding no colon.
    savedGames: async profileId => {
      const prefix = savesKeyPrefix(profileId)
      return [...new Set(storageKeysStartingWith(getStorage(), prefix).map(key => key.slice(prefix.length).split(':')[0]!))]
    },
  }
}

function isProfileList(value: unknown): value is ProfileList {
  if (typeof value !== 'object' || value === null || !('profiles' in value) || !Array.isArray(value.profiles)) {
    return false
  }
  return value.profiles.every(profile => typeof profile === 'object' && profile !== null
    && typeof profile.id === 'string' && typeof profile.name === 'string' && typeof profile.createdAt === 'string')
}
