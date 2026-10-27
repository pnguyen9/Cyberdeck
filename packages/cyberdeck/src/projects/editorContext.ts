import type { ChapterDocument, ProjectDocument } from '@cyberdeck/core'
import { inject, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import type { GivenFile, OpenProject } from './openProject'

/** What the tabs of an open project share: the project as stored, and how to change it. */
export interface EditorContext {
  open: OpenProject
  project: Readonly<ShallowRef<ProjectDocument>>
  chapters: Readonly<ShallowRef<ChapterDocument[]>>
  /** Pages of no chapter, played wherever a `[play]` names them; stored as chapters are. */
  scenes: Readonly<ShallowRef<ChapterDocument[]>>
  /** Runs a change, then shows the project as stored; an error becomes the message shown. Resolves to whether it succeeded. */
  act: (change: () => Promise<unknown>, successMessage?: string | (() => string)) => Promise<boolean>
  preview: (fromChapterId: string | null) => void
  /** Plays from a page or choice, reached the way a player could. */
  previewFrom: (chapterId: string, nodeId: string) => void
  /** Text being prepared for import, kept while the author visits other tabs. */
  importDraft: Ref<{ text: string; fileName: string | null }>
  /** The chapter or scene the storyboard shows; null shows the first chapter. */
  storyboardChapterId: Ref<string | null>
  openStoryboard: (chapterId: string) => void
}

export const EDITOR: InjectionKey<EditorContext> = Symbol('editor')

export function useEditor(): EditorContext {
  const context = inject(EDITOR)
  if (context === undefined) {
    throw new Error('An editor tab must be inside a project')
  }
  return context
}

/** Reads the files the author picked or dropped. */
export async function readGivenFiles(fileList: FileList | null | undefined): Promise<GivenFile[]> {
  return Promise.all([...(fileList ?? [])].map(async file => ({ name: file.name, mediaType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) })))
}
