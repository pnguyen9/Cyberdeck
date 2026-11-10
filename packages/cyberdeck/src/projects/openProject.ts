import {
  FORMAT_VERSION,
  MAXIMUM_CSS_LENGTH,
  refersOnlyToKnownDefinitions,
  addEmptyDocument,
  addFontFile,
  applyDefinitions,
  applyImport,
  applyNodeEdit,
  assignAsset,
  captionsMediaTypeOf,
  checkChapterDocument,
  checkProjectDocument,
  createGameArchive,
  createProject,
  exportText,
  findPathTo,
  fontMediaTypeOf,
  createProjectBackup,
  defaultEnvironment,
  isSupportedAssetMediaType,
  mediaTypeOfFile,
  readZip,
  matchAssetFile,
  moveChapter,
  withChapterCondition,
  unusedNames,
  withoutNames,
  readProjectBackup,
  removeChapter,
  removeNodes,
  renameChapter,
  renameProject,
  setDrawnFacing,
  setNameColor,
  chapterIn,
  languagesOf,
  projectIn,
  withTextOf,
  setShown,
  setShownEndings,
  toSave,
  unusedAssetIds,
  updateDetails,
  withoutAssets,
  type AssetTarget,
  type ChapterDocument,
  type DefinitionKind,
  type StoredCondition,
  type UnusedName,
  type DefinitionsPreview,
  type Environment,
  type Facing,
  type GameDetails,
  type ImportPreview,
  type ImportTarget,
  type NodeEditTarget,
  type PlayableStory,
  type ProjectDocument,
  type PageLayout,
  type ShownWhen,
  type ChapterView,
  type SaveData,
  type LeftOutChapters,
} from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'
import { castMessages } from '../i18n/castMessages'
import { AuthorError } from '../i18n/errorMessages'
import type { ProjectStore } from './projectStore'

/** A file the author gave: dropped, or picked in a file dialog. */
export interface GivenFile {
  name: string
  mediaType: string
  bytes: Uint8Array<ArrayBuffer>
}

/** Why a preview does not start where asked as a player would reach it, if it does not. */
export type PreviewNote = 'reachedWithEarlierPlaythroughs' | 'unreached'

export interface FileMatch {
  fileName: string
  /** What the file went to, `Marie, smile`; null when it went nowhere. */
  entry: string | null
  /** Why it went nowhere: no entry has its name, or Datajack plays no file of its kind. */
  unused?: 'noEntry' | 'unknownKind'
}

/**
 * The files given, a zip among them standing for the files it holds, as if they had been unzipped and
 * dropped: its folders are passed over, and what systems add beside the files (`__MACOSX`, `._x`, `.DS_Store`).
 */
async function withZipsOpened(files: readonly GivenFile[]): Promise<GivenFile[]> {
  const opened: GivenFile[] = []
  for (const file of files) {
    if (!/\.zip$/i.test(file.name)) {
      opened.push(file)
      continue
    }
    let entries
    try {
      entries = readZip(file.bytes)
    } catch {
      throw new AuthorError(text => text.zipUnreadable(file.name))
    }
    for (const entry of entries) {
      const name = entry.path.split('/').pop() ?? ''
      if (name === '' || name.startsWith('.') || entry.path.split('/').includes('__MACOSX') || /\.zip$/i.test(name)) {
        continue
      }
      opened.push({ name, mediaType: '', bytes: await entry.read() })
    }
  }
  return opened
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
    throw new AuthorError(text => text.projectWithoutName)
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

/** What one change replaced, or the chapter it removed and where it stood. */
interface UndoStep {
  chapters: ChapterDocument[]
  removedFrom?: { order: 'chapterOrder' | 'sceneOrder'; index: number }
}

export class OpenProject {
  /** What each storyboard change replaced or removed, the latest last: one Ctrl+Z puts a whole change back. */
  private undoSteps: UndoStep[] = []

  private constructor(
    private readonly store: ProjectStore,
    private currentProject: ProjectDocument,
    private storedChapters: ChapterDocument[],
    private readonly environment: Environment,
  ) {
    this.currentLanguage = languagesOf(currentProject)[0]!
  }

  /** The language the editor shows the story in: chapters and scenes are read, written and imported in it. */
  private currentLanguage: string

  get language(): string {
    return this.currentLanguage
  }

  /** Shows the story in another of its languages, or in a new one, added to the story. */
  async showLanguage(language: string) {
    if (!languagesOf(this.currentProject).includes(language)) {
      await this.saveProject({ ...this.currentProject, languages: [...languagesOf(this.currentProject), language], updatedAt: this.now() })
    }
    this.currentLanguage = language
  }

  /** Takes a language with no text yet out of the story: one added by mistake. The first cannot go. */
  async removeLanguage(language: string) {
    const [first, ...others] = languagesOf(this.currentProject)
    if (language === first || !others.includes(language) || this.storedChapters.some(chapter => (chapter.translations?.[language]?.nodes.length ?? 0) > 0)) {
      return
    }
    for (const chapter of this.storedChapters.filter(candidate => candidate.translations?.[language] !== undefined)) {
      const { [language]: _removed, ...translations } = chapter.translations!
      const { translations: _all, ...rest } = chapter
      await this.storeDocument(Object.keys(translations).length === 0 ? rest : { ...rest, translations })
    }
    await this.saveProject({ ...this.currentProject, languages: [first!, ...others.filter(other => other !== language)], updatedAt: this.now() })
    if (this.currentLanguage === language) {
      this.currentLanguage = first!
    }
  }

  /** The language a story of one language is written in, set right: its text stays as it is. */
  async changeLanguage(language: string) {
    const languages = languagesOf(this.currentProject)
    if (languages.length !== 1 || languages[0] === language) {
      return
    }
    const endings = this.currentProject.endings.map(ending => {
      const shownAs = ending.translations?.[languages[0]!]
      const { translations: _old, ...rest } = ending
      return shownAs === undefined ? rest : { ...rest, translations: { [language]: shownAs } }
    })
    await this.saveProject({ ...this.currentProject, locale: language, languages: [language], endings, updatedAt: this.now() })
    this.currentLanguage = language
  }

  /** The stored chapters and scenes in the project's order, every language in them: for backups and archives. */
  private get storedDocuments(): ChapterDocument[] {
    return this.inOrder([...this.currentProject.chapterOrder, ...this.currentProject.sceneOrder])
  }

  /** Every text of the story, in each of its languages: what names are used by. */
  private textsOf(documents: readonly ChapterDocument[]): ChapterView[] {
    return documents.flatMap(document => languagesOf(this.currentProject).map(language => chapterIn(document, language, this.currentProject)))
  }

  /** Every text of the story in each of its languages, hollow ones included, for what concerns them all. */
  get everyText(): ChapterView[] {
    return this.textsOf(this.storedDocuments)
  }

  static async open(store: ProjectStore, projectId: string, environment: Environment = defaultEnvironment): Promise<OpenProject> {
    const project = checkProjectDocument(await store.readProject(projectId), 'project')
    const chapters = (await store.readChapters(projectId)).map(value => checkChapterDocument(value, 'chapter'))
    return new OpenProject(store, project, chapters, environment)
  }

  get project(): ProjectDocument {
    return this.currentProject
  }

  /** The chapters in the project's order, in the language shown: hollow where it has no text yet. */
  get chapters(): ChapterView[] {
    return this.inOrder(this.currentProject.chapterOrder).map(chapter => chapterIn(chapter, this.currentLanguage, this.currentProject))
  }

  /** The scenes, which are stored as chapters are, in the project's order, in the language shown. */
  get scenes(): ChapterView[] {
    return this.inOrder(this.currentProject.sceneOrder).map(scene => chapterIn(scene, this.currentLanguage, this.currentProject))
  }

  /** Chapters then scenes in a language, the one an import's text is in: hollow where it has no text yet. */
  documentsIn(language: string): ChapterView[] {
    return this.storedDocuments.map(document => chapterIn(document, language, this.currentProject))
  }

  /** The stored documents of these identifiers, in that order. */
  private inOrder(ids: readonly string[]): ChapterDocument[] {
    const byId = new Map(this.storedChapters.map(chapter => [chapter.id, chapter]))
    return ids.flatMap(id => byId.get(id) ?? [])
  }

  /** Chapters then scenes: everything the story is made of. */
  get documents(): ChapterView[] {
    return [...this.chapters, ...this.scenes]
  }

  async importText(preview: ImportPreview, target: ImportTarget, fileName: string | null): Promise<ChapterDocument[]> {
    // Laid over the chapters in the text's language, which the editor then shows, once imported.
    const applied = applyImport(preview, this.currentProject, this.documentsIn(preview.language), target, { fileName }, this.environment)
    // The text of each chapter goes into its document, in the import's language, the other languages kept.
    const stored = applied.chapters.map(chapter => ({ ...withTextOf(this.storedChapters.find(candidate => candidate.id === chapter.id), chapter, applied.project), formatVersion: FORMAT_VERSION }))
    for (const chapter of stored) {
      await this.store.writeChapter(this.currentProject.id, chapter)
    }
    this.storedChapters = [...this.storedChapters.filter(chapter => !stored.some(changed => changed.id === chapter.id)), ...stored]
    await this.saveProject(applied.project)
    this.currentLanguage = preview.language
    await this.forgetUnusedNames()
    return applied.chapters
  }

  /** Gives each file to the entry named like it, replacing the file it had; files of no entry are reported. */
  /**
   * Gives each file to the entry it is named after; a font file makes a font of its name, measured
   * by `measureFont` (how much wider than the text box's font it draws), for pages in it to fit.
   * Entries are described in `locale`.
   */
  async addFiles(files: readonly GivenFile[], measureFont: (bytes: Uint8Array<ArrayBuffer>) => Promise<number> = async () => 1, locale: Locale = 'en'): Promise<FileMatch[]> {
    let project = this.currentProject
    const matches: FileMatch[] = []
    for (const file of await withZipsOpened(files)) {
      const fontMediaType = fontMediaTypeOf(file.name)
      if (fontMediaType !== null) {
        let widthScale: number
        try {
          widthScale = await measureFont(file.bytes)
        } catch {
          matches.push({ fileName: file.name, entry: null, unused: 'unknownKind' })
          continue
        }
        const assetId = this.environment.createId()
        await this.store.writeAsset(project.id, assetId, file.bytes, fontMediaType)
        const added = addFontFile(project, file.name, { id: assetId, fileName: file.name, mediaType: fontMediaType, byteSize: file.bytes.length }, widthScale, () => this.environment.createId())
        project = added.project
        matches.push({ fileName: file.name, entry: describeTarget(project, { type: 'font', fontId: added.fontId }, locale) })
        continue
      }
      // Systems name files many ways, or not at all: their extension says what they are.
      const mediaType = captionsMediaTypeOf(file.name) ?? mediaTypeOfFile(file.name, file.mediaType)
      if (!isSupportedAssetMediaType(mediaType)) {
        matches.push({ fileName: file.name, entry: null, unused: 'unknownKind' })
        continue
      }
      const target = matchAssetFile(file.name, mediaType, project)
      if (target === null) {
        matches.push({ fileName: file.name, entry: null, unused: 'noEntry' })
        continue
      }
      const assetId = this.environment.createId()
      await this.store.writeAsset(project.id, assetId, file.bytes, mediaType)
      project = assignAsset(project, target, { id: assetId, fileName: file.name, mediaType, byteSize: file.bytes.length })
      matches.push({ fileName: file.name, entry: describeTarget(project, target, locale) })
    }
    await this.saveWithoutUnusedFiles(project)
    return matches
  }

  /** A null file removes the cover. */
  async setCover(file: GivenFile | null) {
    let project = this.currentProject
    if (file !== null) {
      const mediaType = mediaTypeOfFile(file.name, file.mediaType)
      if (!mediaType.startsWith('image/') || !isSupportedAssetMediaType(mediaType)) {
        throw new AuthorError(text => text.coverNotAnImage(file.name))
      }
      const assetId = this.environment.createId()
      await this.store.writeAsset(project.id, assetId, file.bytes, mediaType)
      project = { ...project, assets: [...project.assets, { id: assetId, fileName: file.name, mediaType, byteSize: file.bytes.length }] }
      project = updateDetails(project, { coverAssetId: assetId }, this.now())
    } else {
      project = updateDetails(project, { coverAssetId: null }, this.now())
    }
    await this.saveWithoutUnusedFiles(project)
  }

  /** Stores a chapter changed in the storyboard; the version it replaces can be restored with `undo`. */
  replaceChapter(chapter: ChapterDocument) {
    return this.replaceChapters([chapter])
  }

  /**
   * Stores chapters changed together: one `undo` restores them all. Their text goes in the language
   * of each, unless they are `whole` documents, every language in them.
   */
  private async replaceChapters(chapters: readonly ChapterDocument[], { whole = false } = {}) {
    const replaced: ChapterDocument[] = []
    for (const chapter of chapters) {
      const previous = this.storedChapters.find(candidate => candidate.id === chapter.id)
      if (previous !== undefined && previous !== chapter) {
        await (whole ? this.storeDocument(chapter) : this.writeChapter(chapter))
        replaced.push(previous)
      }
    }
    if (replaced.length > 0) {
      this.pushUndoStep({ chapters: replaced })
      await this.forgetUnusedNames()
    }
  }

  private pushUndoStep(step: UndoStep) {
    this.undoSteps = [...this.undoSteps.slice(1 - MAXIMUM_UNDO_STEPS), step]
  }

  /** The texts an undo could bring back, in every language: what they name is still used. */
  private get undoableChapters(): ChapterDocument[] {
    return this.textsOf(this.undoSteps.flatMap(step => step.chapters))
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

  /** Restores what the last change replaced or removed; returns the chapter concerned, or null when there was nothing to undo. */
  async undo(): Promise<string | null> {
    const step = this.undoSteps.at(-1)
    if (step === undefined) {
      return null
    }
    const place = step.removedFrom
    for (const previous of step.chapters) {
      if (place === undefined) {
        // The document as it was, every language in it.
        await this.storeDocument({ ...previous, updatedAt: this.now() })
      } else {
        const chapter = { ...previous, formatVersion: FORMAT_VERSION, updatedAt: this.now() }
        await this.store.writeChapter(this.currentProject.id, chapter)
        this.storedChapters = [...this.storedChapters, chapter]
        const order = this.currentProject[place.order]
        await this.saveProject({ ...this.currentProject, [place.order]: [...order.slice(0, place.index), chapter.id, ...order.slice(place.index)], updatedAt: this.now() })
      }
    }
    this.undoSteps = this.undoSteps.slice(0, -1)
    await this.forgetUnusedNames()
    return step.chapters[0]?.id ?? null
  }

  /** A chapter or a scene with no page yet, to write in the storyboard, a chapter at `atIndex` when given; returns its identifier. */
  async addEmptyDocument(kind: 'chapter' | 'scene', title: string, atIndex?: number): Promise<string> {
    const added = addEmptyDocument(this.currentProject, kind, title, this.environment)
    // Begun in another language than the first, it is hollow in the first.
    const document = withTextOf(undefined, { ...added.document, language: this.currentLanguage }, this.currentProject)
    await this.store.writeChapter(this.currentProject.id, document)
    this.storedChapters = [...this.storedChapters, document]
    await this.saveProject(atIndex === undefined ? added.project : moveChapter(added.project, added.document.id, atIndex, this.now()))
    return added.document.id
  }

  /** Saves the project's own definitions, edited as text in the Definitions tab. */
  saveDefinitions(preview: DefinitionsPreview) {
    return this.saveProject(applyDefinitions(preview, this.currentProject, this.environment))
  }

  /** Whether each chapter's title shows over the stage as it starts. */
  setChapterTitleCards(isShown: boolean) {
    return this.saveProject({ ...this.currentProject, chapterTitleCards: isShown, updatedAt: this.now() })
  }

  /** Saves the CSS of the project's styles, as written: players check it again before using it. */
  saveCss(css: string) {
    if (css.length > MAXIMUM_CSS_LENGTH) {
      throw new AuthorError(text => text.cssTooLong(MAXIMUM_CSS_LENGTH))
    }
    return this.saveProject({ ...this.currentProject, css, updatedAt: this.now() })
  }

  /** Takes out a decision, counter or style nothing uses any more, made by choices since removed for instance. */
  removeUnusedDefinition(kind: DefinitionKind, id: string) {
    const project = this.currentProject
    const kept = <Entry extends { id: string }>(entries: Entry[]) => entries.filter(entry => entry.id !== id)
    return this.saveProject({
      ...project,
      ...(kind === 'decision' ? { decisions: kept(project.decisions) } : kind === 'counter' ? { counters: kept(project.counters) } : { styles: kept(project.styles) }),
      updatedAt: this.now(),
    })
  }

  /** Takes a definition out of its chapter: it then lives in the project's definitions. Undone like any change to a chapter. */
  async moveToDefinitions(documentId: string, nodeId: string) {
    const document = this.documents.find(candidate => candidate.id === documentId)
    if (document !== undefined) {
      await this.replaceChapter(removeNodes(document, [nodeId], this.now()))
    }
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

  /** Whether players see a decision or a counter in their journal: never (null), always, or after an ending. */
  setShown(id: string, when: ShownWhen | null) {
    return this.saveProject(setShown(this.currentProject, id, when, this.now()))
  }

  /** Whether players see the endings they reached in their journal. */
  setShownEndings(when: ShownWhen | null) {
    return this.saveProject(setShownEndings(this.currentProject, when, this.now()))
  }

  /** The colour of a character's name on their plate, `#rrggbb`, or null for the plate's own. */
  setNameColor(characterId: string, nameColor: string | null) {
    return this.saveProject(setNameColor(this.currentProject, characterId, nameColor, this.now()))
  }

  /** Renames the chapter or scene in the language shown. */
  async renameChapter(chapterId: string, title: string) {
    const chapter = this.documents.find(candidate => candidate.id === chapterId)
    if (chapter === undefined) {
      return
    }
    await this.writeChapter(renameChapter(chapter, title, this.now()))
  }

  /** Plays the chapters only under this condition, or always for `undefined`: a route's condition, written once. */
  setChapterConditions(chapterIds: readonly string[], condition: StoredCondition | undefined) {
    // The condition is the story's, the same in every language: the documents take it whole.
    const chapters = this.storedChapters.filter(chapter => chapterIds.includes(chapter.id))
    return this.replaceChapters(chapters.map(chapter => withChapterCondition(chapter, condition, this.now())), { whole: true })
  }

  moveChapter(chapterId: string, toIndex: number) {
    return this.saveProject(moveChapter(this.currentProject, chapterId, toIndex, this.now()))
  }

  /** Removes a chapter or a scene; `undo` puts it back where it stood. */
  async removeChapter(chapterId: string) {
    const removed = this.storedChapters.find(chapter => chapter.id === chapterId)
    const order = this.currentProject.sceneOrder.includes(chapterId) ? 'sceneOrder' : 'chapterOrder'
    const index = this.currentProject[order].indexOf(chapterId)
    await this.saveProject(removeChapter(this.currentProject, chapterId, this.now()))
    await this.store.deleteChapter(this.currentProject.id, chapterId)
    this.storedChapters = this.storedChapters.filter(chapter => chapter.id !== chapterId)
    if (removed !== undefined && index !== -1) {
      this.pushUndoStep({ chapters: [removed], removedFrom: { order, index } })
    }
    await this.forgetUnusedNames()
  }

  /** Names the story no longer uses that hold a file or a setting of the author's: Cast & files offers to remove them. */
  get unusedNamesKept(): UnusedName[] {
    return unusedNames(this.currentProject, this.everyText).filter(name => name.isKept)
  }

  /**
   * Removes a name nothing uses, and its files with it. An undo bringing back a chapter that names it
   * could not any more: those steps go, as when a definition goes.
   */
  removeUnusedName(name: UnusedName) {
    const namesIt = (chapter: ChapterDocument) => !unusedNames(this.currentProject, this.textsOf([chapter])).some(unused => unused.kind === name.kind && unused.id === name.id)
    this.undoSteps = this.undoSteps.filter(step => !step.chapters.some(namesIt))
    return this.saveWithoutUnusedFiles(withoutNames(this.currentProject, [name]))
  }

  /** The game players download: the chapters chosen and the files they use, in the languages chosen (every one by default), the story's first among them. */
  exportGame(release: string, includedChapterIds: readonly string[], exportedAt: Date, languages: readonly string[] = languagesOf(this.currentProject), leftOutChapters: LeftOutChapters = 'named'): Promise<Uint8Array<ArrayBuffer>> {
    return createGameArchive({
      project: this.currentProject,
      chapters: this.storedDocuments,
      includedChapterIds,
      leftOutChapters,
      languages,
      readAsset: asset => this.store.readAsset(this.currentProject.id, asset.id),
      release,
      exportedAt,
    })
  }

  /**
   * The whole story, decisions declared, to become a project again; or chapters or scenes to replace
   * their own after editing. With the layout the pages were cut for, paragraphs read as written.
   */
  exportText(chapterIds: readonly string[] | null, paragraphsAsWrittenFor: PageLayout | null = null): string {
    const asWritten = { language: this.currentLanguage, ...(paragraphsAsWrittenFor === null ? {} : { paragraphsAsWrittenFor }) }
    return chapterIds === null
      ? exportText(this.currentProject, this.chapters, { declareDecisions: true, scenes: this.scenes, ...asWritten })
      : exportText(this.currentProject, this.chapters.filter(chapter => chapterIds.includes(chapter.id)), {
        declareDecisions: false,
        scenes: this.scenes.filter(scene => chapterIds.includes(scene.id)),
        allScenes: this.scenes,
        ...asWritten,
      })
  }

  backup(now: Date): Promise<Uint8Array<ArrayBuffer>> {
    return createProjectBackup(this.currentProject, this.storedDocuments, asset => this.store.readAsset(this.currentProject.id, asset.id), now)
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
  async previewFrom(chapterId: string, nodeId: string, now: Date): Promise<{ story: PlayableStory; resumeFrom: SaveData | null; note: PreviewNote | null }> {
    const fromChapter = await this.playable(chapterId)
    const whole = await this.playable(null)
    const everythingKnown = { memoryIds: this.currentProject.memories.map(memory => memory.id), endingIds: this.currentProject.endings.map(ending => ending.id) }
    const attempts: { story: PlayableStory; found: () => ReturnType<typeof findPathTo>; note: PreviewNote | null }[] = [
      { story: fromChapter, found: () => findPathTo(fromChapter, nodeId), note: null },
      { story: whole, found: () => findPathTo(whole, nodeId), note: null },
      { story: whole, found: () => findPathTo(whole, nodeId, everythingKnown), note: 'reachedWithEarlierPlaythroughs' },
    ]
    for (const attempt of attempts) {
      const found = attempt.found()
      if (found !== null) {
        return { story: attempt.story, resumeFrom: toSave(attempt.story, found.state, now.toISOString()), note: attempt.note }
      }
    }
    return { story: fromChapter, resumeFrom: null, note: 'unreached' }
  }

  /** The story as Datajack plays it, from the start or from a chapter. */
  async playable(fromChapterId: string | null = null): Promise<PlayableStory> {
    const order = this.currentProject.chapterOrder
    const start = fromChapterId === null ? 0 : Math.max(0, order.indexOf(fromChapterId))
    const assetUrls = new Map<string, string>()
    for (const asset of this.currentProject.assets) {
      assetUrls.set(asset.id, await this.assetUrl(asset.id))
    }
    // In the language shown, as a player who picked it would play it.
    return { project: { ...projectIn(this.currentProject, this.currentLanguage), chapterOrder: order.slice(start) }, chapters: this.documents, assetUrls }
  }

  /**
   * Names the text no longer uses, which hold nothing of the author's, go: a track renamed, the values
   * of options renamed. What an undo could bring back is still used.
   */
  private async forgetUnusedNames() {
    const unused = unusedNames(this.currentProject, [...this.everyText, ...this.undoableChapters]).filter(name => !name.isKept)
    if (unused.length > 0) {
      await this.saveProject({ ...withoutNames(this.currentProject, unused), updatedAt: this.now() })
    }
  }

  /** Files no entry uses any more are deleted once the project no longer lists them. */
  private async saveWithoutUnusedFiles(project: ProjectDocument) {
    const unused = unusedAssetIds(project)
    await this.saveProject({ ...withoutAssets(project, unused), updatedAt: this.now() })
    for (const assetId of unused) {
      await this.store.deleteAsset(project.id, assetId)
    }
  }

  /** Writes a chapter's text in its language (a view's, or the first for a document), the other languages kept. */
  private writeChapter(edited: ChapterDocument) {
    return this.storeDocument(withTextOf(this.storedChapters.find(candidate => candidate.id === edited.id), edited, this.currentProject))
  }

  /**
   * Stores a whole document, as it is, in the current format: an edit may add what only it describes,
   * a loop, a style.
   */
  private async storeDocument(document: ChapterDocument) {
    const chapter = { ...document, formatVersion: FORMAT_VERSION }
    await this.store.writeChapter(this.currentProject.id, chapter)
    this.storedChapters = this.storedChapters.map(candidate => candidate.id === chapter.id ? chapter : candidate)
    await this.saveProject({ ...this.currentProject, updatedAt: this.now() })
  }

  private async saveProject(edited: ProjectDocument) {
    const project = { ...edited, formatVersion: FORMAT_VERSION }
    await this.store.writeProject(project)
    this.currentProject = project
    // An older chapter using a decision, a value or a style removed since can no longer be undone to.
    this.undoSteps = this.undoSteps.filter(step => step.chapters.every(chapter => refersOnlyToKnownDefinitions(chapter, project)))
  }

  private now() {
    return this.environment.now()
  }
}

function describeTarget(project: ProjectDocument, target: AssetTarget, locale: Locale): string {
  const text = castMessages[locale]
  switch (target.type) {
    case 'background':
      return text.backgroundTarget(`${project.backgrounds.find(background => background.id === target.backgroundId)?.name}`)
    case 'music':
      return text.musicTarget(`${project.music.find(track => track.id === target.musicId)?.name}`)
    case 'sound':
      return text.soundTarget(`${project.sounds.find(sound => sound.id === target.soundId)?.name}`)
    case 'illustration':
      return text.illustrationTarget(`${project.illustrations.find(illustration => illustration.id === target.illustrationId)?.name}`)
    case 'video':
      return text.videoTarget(`${project.videos.find(video => video.id === target.videoId)?.name}`)
    case 'frame':
      return text.frameTarget(target.frame)
    case 'captions':
      return text.captionsTarget(`${project.videos.find(video => video.id === target.videoId)?.name}`)
    case 'font':
      return text.fontTarget(`${project.fonts.find(font => font.id === target.fontId)?.name}`)
    case 'expression': {
      const character = project.characters.find(candidate => candidate.id === target.characterId)
      return `${character?.name}, ${character?.expressions.find(expression => expression.id === target.expressionId)?.name}`
    }
  }
}
