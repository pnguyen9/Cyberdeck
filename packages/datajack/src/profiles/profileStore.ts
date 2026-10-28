import type { SaveFolderChange } from '../../electron/bridge'
import { checkedProfileName } from '../../electron/profileNames'
import { createStorageSaveStore, type Locale, type SaveStore } from '@cyberdeck/stage'

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
  use: (profileId: string) => Promise<void>
  changeSaveFolder: (profileId: string, saveFolder: string) => Promise<SaveFolderChange>
  saveStore: (profileId: string) => SaveStore
}

const PROFILES_KEY = 'datajack:profiles'
const savesKeyPrefix = (profileId: string) => `datajack:profile:${profileId}:save:`

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
      const storage = getStorage()
      const saveKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
        .filter((key): key is string => key?.startsWith(savesKeyPrefix(profileId)) ?? false)
      saveKeys.forEach(key => storage.removeItem(key))
      write({
        profiles: list.profiles.filter(profile => profile.id !== profileId),
        lastUsedId: list.lastUsedId === profileId ? null : list.lastUsedId,
      })
    },
    use: async profileId => {
      const list = read()
      find(list, profileId)
      write({ ...list, lastUsedId: profileId })
    },
    changeSaveFolder: async () => {
      throw new Error('The browser keeps the saves itself.')
    },
    saveStore: profileId => createStorageSaveStore(getStorage, savesKeyPrefix(profileId)),
  }
}

function isProfileList(value: unknown): value is ProfileList {
  if (typeof value !== 'object' || value === null || !('profiles' in value) || !Array.isArray(value.profiles)) {
    return false
  }
  return value.profiles.every(profile => typeof profile === 'object' && profile !== null
    && typeof profile.id === 'string' && typeof profile.name === 'string' && typeof profile.createdAt === 'string')
}
