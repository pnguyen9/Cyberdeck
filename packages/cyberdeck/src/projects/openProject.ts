import {
  FORMAT_VERSION,
  applyImport,
  applyNodeEdit,
  assignAsset,
  checkChapterDocument,
  checkProjectDocument,
  createGameArchive,
  createProject,
  exportText,
  findPathTo,
  createProjectBackup,
  defaultEnvironment,
  isSupportedAssetMediaType,
  matchAssetFile,
  moveChapter,
  readProjectBackup,
  removeChapter,
  renameChapter,
  renameProject,
  setDrawnFacing,
  toSave,
  unusedAssetIds,
  updateDetails,
  withoutAssets,
  type AssetTarget,
  type ChapterDocument,
  type Environment,
  type Facing,
  type GameDetails,
  type ImportPreview,
  type ImportTarget,
  type NodeEditTarget,
  type PlayableStory,
  type ProjectDocument,
  type SaveData,
} from '@cyberdeck/core'
import type { ProjectStore } from './projectStore'

/** A file the author gave: dropped, or picked in a file dialog. */
export interface GivenFile {
  name: string
  mediaType: string
  bytes: Uint8Array<ArrayBuffer>
}

export interface FileMatch {
  fileName: string
  /** What the file went to, `Marie, smile`; null when no entry has its name. */
  entry: string | null
}

/** Projects as listed: those whose document cannot be read are left out. */
export async function listProjects(store: ProjectStore): Promise<ProjectDocument[]> {
  return (await store.listProjects())
    .flatMap(value => {
      try {
        return [checkProjectDocument(value, 'project')]
      } catch {
        return []
      }
    })
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

export async function createNewProject(store: ProjectStore, name: string, locale: string, environment: Environment = defaultEnvironment): Promise<ProjectDocument> {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    throw new Error('A project needs a name')
  }
  const project = createProject({ name: trimmedName, locale }, environment)
  await store.writeProject(project)
  return project
}

/** Restores a backup, replacing the project of the same identifier if there is one. */
export async function restoreBackup(store: ProjectStore, bytes: Uint8Array<ArrayBuffer>): Promise<ProjectDocument> {
  const backup = await readProjectBackup(bytes)
  await store.deleteProject(backup.project.id)
  for (const chapter of backup.chapters) {
    await store.writeChapter(backup.project.id, chapter)
  }
  for (const asset of backup.project.assets) {
    await store.writeAsset(backup.project.id, asset.id, backup.assetFiles.get(asset.id)!, asset.mediaType)
  }
  await store.writeProject(backup.project)
  return backup.project
}

/**
 * A project being edited. Every change is stored at once: chapters and files first, the project
 * document last, so that an interrupted change never leaves the project pointing at what is missing.
 */
/** Storyboard changes that can be undone, the oldest forgotten first. */
const MAXIMUM_UNDO_STEPS = 100

export class OpenProject {
  /** Chapters as they were before each storyboard change, the latest last. */
  private undoSteps: ChapterDocument[] = []

  private constructor(
    private readonly store: ProjectStore,
    private currentProject: ProjectDocument,
    private storedChapters: ChapterDocument[],
    private readonly environment: Environment,
  ) {}

  static async open(store: ProjectStore, projectId: string, environment: Environment = defaultEnvironment): Promise<OpenProject> {
    const project = checkProjectDocument(await store.readProject(projectId), 'project')
    const chapters = (await store.readChapters(projectId)).map(value => checkChapterDocument(value, 'chapter'))
    return new OpenProject(store, project, chapters, environment)
  }

  get project(): ProjectDocument {
    return this.currentProject
  }

  /** The chapters in the project's order. */
  get chapters(): ChapterDocument[] {
    return this.currentProject.chapterOrder.flatMap(chapterId => this.storedChapters.filter(chapter => chapter.id === chapterId))
  }

  /** The scenes, which are stored as chapters are, in the project's order. */
  get scenes(): ChapterDocument[] {
    return this.currentProject.sceneOrder.flatMap(sceneId => this.storedChapters.filter(scene => scene.id === sceneId))
  }

  /** Chapters then scenes: everything the story is made of. */
  get documents(): ChapterDocument[] {
    return [...this.chapters, ...this.scenes]
  }

  async importText(preview: ImportPreview, target: ImportTarget, fileName: string | null): Promise<ChapterDocument[]> {
    const applied = applyImport(preview, this.currentProject, this.documents, target, { fileName }, this.environment)
    for (const chapter of applied.chapters) {
      await this.store.writeChapter(this.currentProject.id, chapter)
    }
    this.storedChapters = [...this.storedChapters.filter(chapter => !applied.chapters.some(changed => changed.id === chapter.id)), ...applied.chapters]
    await this.saveProject(applied.project)
    return applied.chapters
  }

  /** Gives each file to the entry named like it, replacing the file it had; files of no entry are reported. */
  async addFiles(files: readonly GivenFile[]): Promise<FileMatch[]> {
    let project = this.currentProject
    const matches: FileMatch[] = []
    for (const file of files) {
      const target = isSupportedAssetMediaType(file.mediaType) ? matchAssetFile(file.name, file.mediaType, project) : null
      if (target === null) {
        matches.push({ fileName: file.name, entry: null })
        continue
      }
      const assetId = this.environment.createId()
      await this.store.writeAsset(project.id, assetId, file.bytes, file.mediaType)
      project = assignAsset(project, target, { id: assetId, fileName: file.name, mediaType: file.mediaType, byteSize: file.bytes.length })
      matches.push({ fileName: file.name, entry: describeTarget(project, target) })
    }
    await this.saveWithoutUnusedFiles(project)
    return matches
  }

  /** A null file removes the cover. */
  async setCover(file: GivenFile | null) {
    let project = this.currentProject
    if (file !== null) {
      if (!file.mediaType.startsWith('image/') || !isSupportedAssetMediaType(file.mediaType)) {
        throw new Error(`${file.name}: a cover must be a PNG, JPEG, WebP, AVIF, GIF or SVG image`)
      }
      const assetId = this.environment.createId()
      await this.store.writeAsset(project.id, assetId, file.bytes, file.mediaType)
      project = { ...project, assets: [...project.assets, { id: assetId, fileName: file.name, mediaType: file.mediaType, byteSize: file.bytes.length }] }
      project = updateDetails(project, { coverAssetId: assetId }, this.now())
    } else {
      project = updateDetails(project, { coverAssetId: null }, this.now())
    }
    await this.saveWithoutUnusedFiles(project)
  }

  /** Stores a chapter changed in the storyboard; the version it replaces can be restored with `undo`. */
  async replaceChapter(chapter: ChapterDocument) {
    const previous = this.storedChapters.find(candidate => candidate.id === chapter.id)
    if (previous === undefined || previous === chapter) {
      return
    }
    await this.writeChapter(chapter)
    this.undoSteps = [...this.undoSteps.slice(1 - MAXIMUM_UNDO_STEPS), previous]
  }

  /**
   * Stores a page or marker edited as text in the storyboard, or new pages; returns the identifiers
   * of the nodes written. The project goes first: it may list a new character nobody uses yet,
   * which is harmless, whereas a chapter naming a character the project lacks is not.
   */
  async editNodes(chapterId: string, preview: ImportPreview, target: NodeEditTarget): Promise<string[]> {
    const applied = applyNodeEdit(preview, this.currentProject, this.documents, chapterId, target, this.environment)
    await this.saveProject(applied.project)
    await this.replaceChapter(applied.chapter)
    return applied.nodeIds
  }

  get canUndo(): boolean {
    return this.undoSteps.length > 0
  }

  /** Restores the chapter changed last as it was; returns its identifier, or null when there was nothing to undo. */
  async undo(): Promise<string | null> {
    const previous = this.undoSteps.at(-1)
    if (previous === undefined) {
      return null
    }
    await this.writeChapter({ ...previous, updatedAt: this.now() })
    this.undoSteps = this.undoSteps.slice(0, -1)
    return previous.id
  }

  rename(name: string) {
    return this.saveProject(renameProject(this.currentProject, name, this.now()))
  }

  updateDetails(details: Partial<Omit<GameDetails, 'coverAssetId'>>) {
    return this.saveProject(updateDetails(this.currentProject, details, this.now()))
  }

  setDrawnFacing(characterId: string, drawnFacing: Facing | null) {
    return this.saveProject(setDrawnFacing(this.currentProject, characterId, drawnFacing, this.now()))
  }

  async renameChapter(chapterId: string, title: string) {
    const chapter = this.storedChapters.find(candidate => candidate.id === chapterId)
    if (chapter === undefined) {
      return
    }
    await this.writeChapter(renameChapter(chapter, title, this.now()))
  }

  moveChapter(chapterId: string, toIndex: number) {
    return this.saveProject(moveChapter(this.currentProject, chapterId, toIndex, this.now()))
  }

  async removeChapter(chapterId: string) {
    await this.saveProject(removeChapter(this.currentProject, chapterId, this.now()))
    await this.store.deleteChapter(this.currentProject.id, chapterId)
    this.storedChapters = this.storedChapters.filter(chapter => chapter.id !== chapterId)
  }

  /** The game players download: the chapters chosen, and the files they use. */
  exportGame(release: string, includedChapterIds: readonly string[], exportedAt: Date): Promise<Uint8Array<ArrayBuffer>> {
    return createGameArchive({
      project: this.currentProject,
      chapters: this.documents,
      includedChapterIds,
      readAsset: asset => this.store.readAsset(this.currentProject.id, asset.id),
      release,
      exportedAt,
    })
  }

  /** The whole story, decisions declared, to become a project again; or chapters or scenes to replace their own after editing. */
  exportText(chapterIds: readonly string[] | null): string {
    return chapterIds === null
      ? exportText(this.currentProject, this.chapters, { declareDecisions: true, scenes: this.scenes })
      : exportText(this.currentProject, this.chapters.filter(chapter => chapterIds.includes(chapter.id)), {
        declareDecisions: false,
        scenes: this.scenes.filter(scene => chapterIds.includes(scene.id)),
        allScenes: this.scenes,
      })
  }

  backup(now: Date): Promise<Uint8Array<ArrayBuffer>> {
    return createProjectBackup(this.currentProject, this.documents, asset => this.store.readAsset(this.currentProject.id, asset.id), now)
  }

  /** An address the page can show or play an asset from. */
  assetUrl(assetId: string): Promise<string> {
    return this.store.assetUrl(this.currentProject.id, assetId)
  }

  /**
   * The story ready to play at a page or choice, as a save made there would resume it: a path to
   * it is searched from the start of its chapter, then of the story, then with every memory and
   * ending taken as known. `note` says when the path is only possible that way, or not at all.
   */
  async previewFrom(chapterId: string, nodeId: string, now: Date): Promise<{ story: PlayableStory; resumeFrom: SaveData | null; note: string | null }> {
    const fromChapter = await this.playable(chapterId)
    const whole = await this.playable(null)
    const everythingKnown = { memoryIds: this.currentProject.memories.map(memory => memory.id), endingIds: this.currentProject.endings.map(ending => ending.id) }
    const attempts = [
      { story: fromChapter, found: () => findPathTo(fromChapter, nodeId), note: null },
      { story: whole, found: () => findPathTo(whole, nodeId), note: null },
      { story: whole, found: () => findPathTo(whole, nodeId, everythingKnown), note: 'This page is only reached with memories or endings of earlier playthroughs: the preview takes them all as known.' },
    ]
    for (const attempt of attempts) {
      const found = attempt.found()
      if (found !== null) {
        return { story: attempt.story, resumeFrom: toSave(attempt.story, found.state, now.toISOString()), note: attempt.note }
      }
    }
    return { story: fromChapter, resumeFrom: null, note: 'No way of playing reaches this page: the preview starts at its chapter.' }
  }

  /** The story as Datajack plays it, from the start or from a chapter. */
  async playable(fromChapterId: string | null = null): Promise<PlayableStory> {
    const order = this.currentProject.chapterOrder
    const start = fromChapterId === null ? 0 : Math.max(0, order.indexOf(fromChapterId))
    const assetUrls = new Map<string, string>()
    for (const asset of this.currentProject.assets) {
      assetUrls.set(asset.id, await this.assetUrl(asset.id))
    }
    return { project: { ...this.currentProject, chapterOrder: order.slice(start) }, chapters: this.documents, assetUrls }
  }

  /** Files no entry uses any more are deleted once the project no longer lists them. */
  private async saveWithoutUnusedFiles(project: ProjectDocument) {
    const unused = unusedAssetIds(project)
    await this.saveProject({ ...withoutAssets(project, unused), updatedAt: this.now() })
    for (const assetId of unused) {
      await this.store.deleteAsset(project.id, assetId)
    }
  }

  /** Documents are written in the current format: an edit may add what only it describes, a loop, a style. */
  private async writeChapter(edited: ChapterDocument) {
    const chapter = { ...edited, formatVersion: FORMAT_VERSION }
    await this.store.writeChapter(this.currentProject.id, chapter)
    this.storedChapters = this.storedChapters.map(candidate => candidate.id === chapter.id ? chapter : candidate)
    await this.saveProject({ ...this.currentProject, updatedAt: this.now() })
  }

  private async saveProject(edited: ProjectDocument) {
    const project = { ...edited, formatVersion: FORMAT_VERSION }
    await this.store.writeProject(project)
    this.currentProject = project
  }

  private now() {
    return this.environment.now()
  }
}

function describeTarget(project: ProjectDocument, target: AssetTarget): string {
  switch (target.type) {
    case 'background':
      return `Background ${project.backgrounds.find(background => background.id === target.backgroundId)?.name}`
    case 'music':
      return `Music ${project.music.find(track => track.id === target.musicId)?.name}`
    case 'sound':
      return `Sound ${project.sounds.find(sound => sound.id === target.soundId)?.name}`
    case 'illustration':
      return `Illustration ${project.illustrations.find(illustration => illustration.id === target.illustrationId)?.name}`
    case 'expression': {
      const character = project.characters.find(candidate => candidate.id === target.characterId)
      return `${character?.name}, ${character?.expressions.find(expression => expression.id === target.expressionId)?.name}`
    }
  }
}
