import type { ChannelBridge } from '@cyberdeck/desktop/invoke'

/**
 * What the desktop shell offers the editor page, reached through `window.cyberdeckDesktop`: project
 * folders on the disk. Every call crosses processes, hence the promises on the page side.
 */
export interface DesktopChannels {
  'projects:folder': () => string
  /** Opens the system folder picker and keeps projects there from then on; null when cancelled. */
  'projects:chooseFolder': () => string | null
  'projects:list': () => string[]
  'projects:readProject': (projectId: string) => string | null
  'projects:writeProject': (projectId: string, text: string) => void
  'projects:readChapters': (projectId: string) => string[]
  'projects:writeChapter': (projectId: string, chapterId: string, text: string) => void
  'projects:deleteChapter': (projectId: string, chapterId: string) => void
  'projects:writeAsset': (projectId: string, assetId: string, bytes: Uint8Array) => void
  'projects:readAsset': (projectId: string, assetId: string) => Uint8Array
  'projects:deleteAsset': (projectId: string, assetId: string) => void
  /** Moves the project's folder to the system's trash. */
  'projects:deleteProject': (projectId: string) => void
}

/** Where the page loads a project's files from: `<path><project>/<asset>`. */
export const PROJECT_ASSETS_PATH = '/project-assets/'

export type DesktopChannel = keyof DesktopChannels

export type DesktopBridge = ChannelBridge<DesktopChannels>
