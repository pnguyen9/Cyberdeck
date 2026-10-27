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
  /** The profile played last, opened directly at the next start. */
  lastUsedId: string | null
}

export interface SaveFolderChange {
  moved: number
  /** Saves already in the new folder for the same game and slot, kept instead of the moved ones. */
  keptInNewFolder: number
}

export interface DesktopChannels {
  'profiles:list': () => ProfileList
  'profiles:defaultSaveFolder': (name: string) => string
  /** Opens the system folder picker; null when the player cancels. */
  'profiles:chooseFolder': () => string | null
  /** A null folder means the default one for the name. */
  'profiles:create': (name: string, saveFolder: string | null) => ProfileRecord
  'profiles:rename': (profileId: string, name: string) => void
  /** Forgets the profile; its save files stay where they are. */
  'profiles:remove': (profileId: string) => void
  'profiles:use': (profileId: string) => void
  'profiles:changeSaveFolder': (profileId: string, saveFolder: string) => SaveFolderChange
  'saves:read': (profileId: string, gameId: string, slot: string) => string | null
  'saves:write': (profileId: string, gameId: string, slot: string, text: string) => void
  'library:listManifests': () => string[]
  'library:readManifest': (gameId: string) => string | null
  'library:writeManifest': (gameId: string, text: string) => void
  'library:readChapter': (gameId: string, chapterId: string) => string | null
  'library:writeChapter': (gameId: string, chapterId: string, text: string) => void
  'library:hasAsset': (fileName: string) => boolean
  'library:writeAsset': (fileName: string, bytes: Uint8Array) => void
  'library:removeGame': (gameId: string) => void
  'library:removeAssetsExcept': (fileNames: string[]) => void
}

/** Where the page loads installed assets from, by file name. */
export const INSTALLED_ASSETS_PATH = '/installed-assets/'

export type DesktopChannel = keyof DesktopChannels

export type DesktopBridge = ChannelBridge<DesktopChannels>
