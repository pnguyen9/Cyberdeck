import { checkReferences } from '../importer/checkReferences'
import { normalizeName } from '../importer/storyNodes'
import { importText } from '../importer/importText'
import type { ImportProblem, ImportResult } from '../importer/importTypes'
import type { PageLayout } from '../pagination/paginate'
import { storeImport, type StoredImport } from '../format/storeImport'
import {
  defaultEnvironment,
  flattenStoredNodes,
  mapInnerLists,
  type ChapterDocument,
  type Environment,
  type Facing,
  type GameDetails,
  type ProjectDocument,
  type StoredNode,
} from '../format/storyFormat'

/**
 * Changes an author makes to a project in Cyberdeck. Each returns new documents, with `updatedAt`
 * set on what changed; storing them is the caller's business.
 */

export interface ImportPreview {
  result: ImportResult
  /** Import and reference problems together, by line. */
  problems: ImportProblem[]
  hasErrors: boolean
  /** The project's scenes, which plays may name and the import's scenes replace. */
  knownScenes: { name: string; id: string }[]
}

/**
 * Where imported text goes: new chapters, the end of a chapter already in the project, or in place
 * of a chapter, edited outside Cyberdeck after a text export for instance.
 */
export type ImportTarget =
  | { type: 'newChapters' }
  | { type: 'endOfChapter'; chapterId: string }
  | { type: 'replaceChapter'; chapterId: string }

export interface AppliedImport {
  project: ProjectDocument
  /** The chapters created, extended or replaced, and the scenes written: to be stored. */
  chapters: ChapterDocument[]
  created: StoredImport['created']
}

/**
 * Imports text against what the project already has: its characters, positions, decisions,
 * endings, memories and scenes are known names. `scenes` are the documents of the project's scenes.
 */
export function previewImport(
  text: string,
  project: ProjectDocument,
  layout: PageLayout,
  options: { isInsideLoop?: boolean; scenes?: readonly ChapterDocument[] } = {},
): ImportPreview {
  const scenes = (options.scenes ?? []).filter(scene => project.sceneOrder.includes(scene.id))
  const result = importText(text, {
    ...(options.isInsideLoop === undefined ? {} : { isInsideLoop: options.isInsideLoop }),
    layout,
    locale: project.locale,
    knownCharacterNames: project.characters.map(character => character.name),
    knownPositionNames: project.positions.map(position => position.name),
  })
  const problems = [
    ...result.problems,
    ...checkReferences(result, {
      decisions: project.decisions.map(decision => ({ name: decision.name, values: decision.values.map(value => value.name) })),
      endings: project.endings.map(ending => ending.name),
      memories: project.memories.map(memory => memory.name),
      styles: project.styles.map(style => style.name),
      scenes: scenes.map(scene => ({ name: scene.title ?? '', plays: playedSceneNames(scene, scenes) })),
    }),
  ].sort((first, second) => first.line - second.line)
  return {
    result,
    problems,
    hasErrors: problems.some(problem => problem.severity === 'error'),
    knownScenes: scenes.map(scene => ({ name: scene.title ?? '', id: scene.id })),
  }
}

export function applyImport(
  preview: ImportPreview,
  project: ProjectDocument,
  chapters: readonly ChapterDocument[],
  target: ImportTarget,
  source: { fileName: string | null },
  environment: Environment = defaultEnvironment,
): AppliedImport {
  if (preview.hasErrors) {
    throw new Error('The text has errors: fix them before importing')
  }
  const now = environment.now()
  if (target.type === 'replaceChapter') {
    return replaceChapter(preview, project, chapters, target.chapterId, source, environment)
  }
  const stored = storeImport(preview.result, project, source, environment, preview.knownScenes)
  if (target.type === 'newChapters') {
    return { project: { ...stored.project, updatedAt: now }, chapters: [...stored.chapters, ...stored.scenes], created: stored.created }
  }
  const chapter = chapters.find(candidate => candidate.id === target.chapterId)
  if (chapter === undefined) {
    throw new Error(`No chapter ${target.chapterId} in the project`)
  }
  const newChapterIds = new Set(stored.chapters.map(storedChapter => storedChapter.id))
  return {
    project: { ...stored.project, chapterOrder: stored.project.chapterOrder.filter(chapterId => !newChapterIds.has(chapterId)), updatedAt: now },
    chapters: [{ ...chapter, nodes: [...chapter.nodes, ...stored.chapters.flatMap(storedChapter => storedChapter.nodes)], updatedAt: now }, ...stored.scenes],
    created: stored.created,
  }
}

/** The imported chapter takes the place and identifier of the replaced one, so that saves inside it resume at its start. */
function replaceChapter(
  preview: ImportPreview,
  project: ProjectDocument,
  chapters: readonly ChapterDocument[],
  chapterId: string,
  source: { fileName: string | null },
  environment: Environment,
): AppliedImport {
  const now = environment.now()
  const replaced = chapters.find(chapter => chapter.id === chapterId)
  if (replaced === undefined) {
    throw new Error(`No chapter ${chapterId} in the project`)
  }
  const stored = storeImport(preview.result, project, source, environment, preview.knownScenes)
  const [first, ...more] = stored.chapters
  if (first === undefined) {
    throw new Error('The text holds no chapter')
  }
  const imported = [{ ...first, id: chapterId, createdAt: replaced.createdAt }, ...more]

  return {
    project: {
      ...stored.project,
      chapterOrder: project.chapterOrder.flatMap(candidate => candidate === chapterId ? imported.map(chapter => chapter.id) : [candidate]),
      updatedAt: now,
    },
    chapters: [...imported, ...stored.scenes],
    created: stored.created,
  }
}

/** Names of the scenes a scene plays, for finding scenes that would play themselves. */
function playedSceneNames(scene: ChapterDocument, scenes: readonly ChapterDocument[]): string[] {
  return flattenStoredNodes(scene.nodes).flatMap(node => node.type === 'play'
    ? [scenes.find(candidate => candidate.id === node.sceneId)?.title ?? '']
    : [])
}

/** Removes a chapter, or a scene. */
export function removeChapter(project: ProjectDocument, chapterId: string, now: string): ProjectDocument {
  return {
    ...project,
    chapterOrder: project.chapterOrder.filter(candidate => candidate !== chapterId),
    sceneOrder: project.sceneOrder.filter(candidate => candidate !== chapterId),
    updatedAt: now,
  }
}

/** Chapters and scenes playing a scene: they would play nothing if it were removed. */
export function playsOf(chapters: readonly ChapterDocument[], sceneId: string): ChapterDocument[] {
  return chapters.filter(chapter => chapter.id !== sceneId && flattenStoredNodes(chapter.nodes).some(node => node.type === 'play' && node.sceneId === sceneId))
}

export function moveChapter(project: ProjectDocument, chapterId: string, toIndex: number, now: string): ProjectDocument {
  const others = project.chapterOrder.filter(candidate => candidate !== chapterId)
  if (others.length === project.chapterOrder.length) {
    return project
  }
  const index = Math.max(0, Math.min(toIndex, others.length))
  return { ...project, chapterOrder: [...others.slice(0, index), chapterId, ...others.slice(index)], updatedAt: now }
}

export function renameChapter(chapter: ChapterDocument, title: string, now: string): ChapterDocument {
  const trimmedTitle = title.trim()
  return { ...chapter, title: trimmedTitle === '' ? null : trimmedTitle, updatedAt: now }
}

export function renameProject(project: ProjectDocument, name: string, now: string): ProjectDocument {
  const trimmedName = name.trim()
  if (trimmedName === '') {
    throw new Error('A project needs a name')
  }
  return { ...project, name: trimmedName, updatedAt: now }
}

export function updateDetails(project: ProjectDocument, details: Partial<GameDetails>, now: string): ProjectDocument {
  return { ...project, details: { ...project.details, ...details }, updatedAt: now }
}

export function setDrawnFacing(project: ProjectDocument, characterId: string, drawnFacing: Facing | null, now: string): ProjectDocument {
  return {
    ...project,
    characters: project.characters.map(character => character.id === characterId ? { ...character, drawnFacing } : character),
    updatedAt: now,
  }
}

/** Assets no entry uses any more, replaced by another file for instance: their files can be deleted. */
export function unusedAssetIds(project: ProjectDocument): string[] {
  const used = new Set<string | null>([
    project.details.coverAssetId,
    ...project.backgrounds.map(background => background.assetId),
    ...project.music.map(track => track.assetId),
    ...project.sounds.map(sound => sound.assetId),
    ...project.illustrations.map(illustration => illustration.assetId),
    ...project.characters.flatMap(character => character.expressions.map(expression => expression.assetId)),
  ])
  return project.assets.filter(asset => !used.has(asset.id)).map(asset => asset.id)
}

export function withoutAssets(project: ProjectDocument, assetIds: readonly string[]): ProjectDocument {
  return assetIds.length === 0 ? project : { ...project, assets: project.assets.filter(asset => !assetIds.includes(asset.id)) }
}
