import type { ChannelBridge } from '@cyberdeck/desktop/invoke'

/**
 * What the desktop shell offers the player page. The page reaches it through `window.datajackDesktop`,
 * exposed by the preload script; every call crosses processes, hence the promises on the page side.
 */

export interface ProfileRecord {
  id: string
  name: string
  /** Absolute folder holding one subfolder of saves per game. */
  saveFolder: string
  createdAt: string
}

export interface ProfileList {
  profiles: ProfileRecord[]
  /** The profile played last, opened directly at the next start; null once the player switched profile. */
  lastUsedId: string | null
}

/** The languages of the player page, which the dialogs the shell opens for it speak too. */
export type DialogLanguage = 'en' | 'fr'

export interface SaveFolderChange {
  moved: number
  /** Saves already in the new folder for the same game and slot, kept instead of the moved ones. */
  keptInNewFolder: number
}

export interface DesktopChannels {
  'profiles:list': () => ProfileList
  'profiles:defaultSaveFolder': (name: string) => string
  /** Opens the system folder picker, titled in the page's language; null when the player cancels. */
  'profiles:chooseFolder': (language: DialogLanguage) => string | null
  /** A null folder means the default one for the name. */
  'profiles:create': (name: string, saveFolder: string | null) => ProfileRecord
  'profiles:rename': (profileId: string, name: string) => void
  /** Forgets the profile; its save files stay where they are. */
  'profiles:remove': (profileId: string) => void
  'profiles:use': (profileId: string | null) => void
  'profiles:changeSaveFolder': (profileId: string, saveFolder: string) => SaveFolderChange
  'saves:read': (profileId: string, gameId: string, slot: string) => string | null
  'saves:write': (profileId: string, gameId: string, slot: string, text: string) => void
  'saves:eraseAll': (profileId: string) => void
  'saves:erase': (profileId: string, gameId: string, slots: string[]) => void
  /** The games the profile's save folder holds saves or progress of, installed or not. */
  'saves:games': (profileId: string) => string[]
  'library:listManifests': (profileId: string) => string[]
  'library:listAllManifests': () => string[]
  'library:readManifest': (profileId: string, gameId: string) => string | null
  'library:writeManifest': (profileId: string, gameId: string, text: string) => void
  'library:readChapter': (profileId: string, gameId: string, chapterId: string) => string | null
  'library:writeChapter': (profileId: string, gameId: string, chapterId: string, text: string) => void
  'library:hasAsset': (fileName: string) => boolean
  'library:writeAsset': (fileName: string, bytes: Uint8Array) => void
  /** Null when the file is not stored. */
  'library:readAsset': (fileName: string) => Uint8Array | null
  'library:removeGame': (profileId: string, gameId: string) => void
  'library:removeLibrary': (profileId: string) => void
  'library:removeAssetsExcept': (fileNames: string[]) => void
  /** The games installed before each profile had its own library: read, then removed once copied into each. */
  'library:listEarlierManifests': () => string[]
  'library:readEarlierChapter': (gameId: string, chapterId: string) => string | null
  'library:removeEarlierGame': (gameId: string) => void
}

/** Where the page loads installed assets from, by file name. */
export const INSTALLED_ASSETS_PATH = '/installed-assets/'

export type DesktopChannel = keyof DesktopChannels

export type DesktopBridge = ChannelBridge<DesktopChannels>
