import type { ChapterDocument, ProjectDocument } from '@cyberdeck/core'

/**
 * Where projects are kept, laid out as project folders: the project document, its chapters, and
 * its files under their asset identifier. Folders on the disk in the desktop build, the browser's
 * IndexedDB otherwise. Values read back are checked by the caller.
 */
export interface ProjectStore {
  listProjects: () => Promise<unknown[]>
  readProject: (projectId: string) => Promise<unknown>
  readChapters: (projectId: string) => Promise<unknown[]>
  writeProject: (project: ProjectDocument) => Promise<void>
  writeChapter: (projectId: string, chapter: ChapterDocument) => Promise<void>
  deleteChapter: (projectId: string, chapterId: string) => Promise<void>
  writeAsset: (projectId: string, assetId: string, bytes: Uint8Array<ArrayBuffer>, mediaType: string) => Promise<void>
  readAsset: (projectId: string, assetId: string) => Promise<Uint8Array<ArrayBuffer>>
  /** An address the page can show or play the file from. */
  assetUrl: (projectId: string, assetId: string) => Promise<string>
  deleteAsset: (projectId: string, assetId: string) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  /** The folder holding the projects, on the desktop, where the author may choose it. */
  folder?: {
    current: () => Promise<string>
    /** Opens the system folder picker; null when cancelled. */
    choose: () => Promise<string | null>
  }
}
