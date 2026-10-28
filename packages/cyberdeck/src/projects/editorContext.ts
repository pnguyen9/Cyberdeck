import type { ChapterDocument, NameKind, ProjectDocument } from '@cyberdeck/core'
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
  openStoryboard: (chapterId: string, nodeId?: string) => void
  /**
   * Asked before the tab shown changes or the project closes: true lets it happen now; false means
   * the tab asked the author first, and calls `proceed` once they have chosen.
   */
  setLeaveGuard: (guard: ((proceed: () => void) => boolean) | null) => void
  /** What the storyboard is asked to do from anywhere in the project, numbered so that the same request twice is seen twice. */
  storyboardRequest: Readonly<Ref<{ kind: 'goToBoard' | 'togglePanel' | 'reveal'; nodeId?: string; count: number } | null>>
  /** Begins a chapter, or a scene, with no page yet, and opens it in the storyboard to write it. */
  startEmptyDocument: (kind: 'chapter' | 'scene') => void
  /** The name the Index opens on; set by `openIndex`. */
  indexFocus: Ref<{ kind: NameKind; id: string } | null>
  openIndex: (kind: NameKind, id: string) => void
}

export const EDITOR: InjectionKey<EditorContext> = Symbol('editor')

/** Storyboard requests already answered: each storyboard shown answers the one waiting, never one answered before. */
export const answeredStoryboardRequests = new WeakSet<object>()

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
