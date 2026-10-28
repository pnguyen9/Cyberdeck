import { checkAuthorCss, styleClassName } from '../format/authorCss'
import { LARGE_WIDTH_SCALE } from '../format/textStyles'
import { checkReferences, type KnownNames } from '../importer/checkReferences'
import { homeOf, indexNames, placeDescriber } from './nameIndex'
import type { StoryWords } from '../storyboard/storyWords'
import { normalizeName } from '../importer/storyNodes'
import { importText } from '../importer/importText'
import type { ImportProblem, ImportResult } from '../importer/importTypes'
import type { PageLayout } from '../pagination/paginate'
import { storeImport, type StoredImport } from '../format/storeImport'
import {
  defaultEnvironment,
  flattenStoredNodes,
  FORMAT_VERSION,
  mapInnerLists,
  type ChapterDocument,
  type DefinitionKind,
  type Environment,
  type Facing,
  type GameDetails,
  type ProjectDocument,
  type StoredCondition,
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

/** How much wider each style of the project draws text, by class: its `large` property, and its CSS. */
export function styleWidthScales(project: ProjectDocument): Map<string, number> {
  const checked = checkAuthorCss(project.css)
  const scales = new Map(checked.widthScales)
  // A class drawn in one of the project's fonts is as much wider as that font is.
  for (const [className, family] of checked.fontFamilies) {
    const font = project.fonts.find(candidate => normalizeName(candidate.name) === normalizeName(family))
    if (font !== undefined) {
      scales.set(className, (scales.get(className) ?? 1) * font.widthScale)
    }
  }
  for (const style of project.styles) {
    const className = styleClassName(style.name)
    scales.set(className, Math.max(scales.get(className) ?? 1, style.properties.includes('large') ? LARGE_WIDTH_SCALE : 1))
  }
  return scales
}

/**
 * Whether every decision, value, counter and style a chapter refers to is still in the project: an older
 * version of a chapter, kept for undoing, may use one removed since.
 */
export function refersOnlyToKnownDefinitions(chapter: ChapterDocument, project: ProjectDocument): boolean {
  const valueIds = new Map(project.decisions.map(decision => [decision.id, new Set(decision.values.map(value => value.id))]))
  const counterIds = new Set(project.counters.map(counter => counter.id))
  const styleIds = new Set(project.styles.map(style => style.id))
  const knowsValue = (decisionId: string, valueId: string | null) => valueIds.get(decisionId)?.has(valueId ?? '') ?? false
  const knowsCondition = (condition: StoredCondition | null | undefined): boolean => {
    if (condition === null || condition === undefined) {
      return true
    }
    return condition.type === 'is' ? knowsValue(condition.decisionId, condition.valueId)
      : condition.type === 'counter' ? counterIds.has(condition.counterId)
      : condition.type === 'and' || condition.type === 'or' ? condition.conditions.every(knowsCondition)
        : true
  }
  return knowsCondition(chapter.condition) && flattenStoredNodes(chapter.nodes).every(node => {
    switch (node.type) {
      case 'choice':
        return node.options.every(option => knowsValue(node.decisionId, option.valueId) && knowsCondition(option.condition))
      case 'set':
        return knowsValue(node.decisionId, node.valueId)
      case 'unset':
        return valueIds.has(node.decisionId) && (node.valueId === null || knowsValue(node.decisionId, node.valueId))
      case 'count':
        return counterIds.has(node.counterId)
      case 'condition':
        return node.branches.every(branch => knowsCondition(branch.condition))
      case 'definition':
        return node.kind === 'decision' ? valueIds.has(node.definedId) : node.kind === 'counter' ? counterIds.has(node.definedId) : styleIds.has(node.definedId)
      case 'page':
        return (node.styles ?? []).every(span => styleIds.has(span.styleId))
      default:
        return true
    }
  })
}

/** What an edit or an import writes over: a whole chapter, or a node of it with all it holds. */
export interface ReplacedPart {
  documentId: string
  nodeId?: string
}

/**
 * The project's names as an import may use them. Given the documents, each decision, counter and style says
 * where it is declared, unless in the project's definitions or in the part replaced, where a new
 * declaration may take its place; and each decision which of its values are used elsewhere, which a
 * new declaration must keep.
 */
export function knownNamesFor(project: ProjectDocument, documents: readonly ChapterDocument[] | undefined, replacing?: ReplacedPart, words?: StoryWords): KnownNames {
  const endings = project.endings.map(ending => ending.name)
  const memories = project.memories.map(memory => memory.name)
  if (documents === undefined) {
    return {
      decisions: project.decisions.map(decision => ({ name: decision.name, values: decision.values.map(value => value.name), declaredIn: '' })),
      counters: project.counters.map(counter => ({ name: counter.name, declaredIn: '' })),
      endings,
      memories,
      styles: project.styles.map(style => style.name),
    }
  }
  const replacedDocument = documents.find(document => document.id === replacing?.documentId)
  const replacedNodeIds = replacing?.nodeId === undefined || replacedDocument === undefined
    ? null
    : new Set(flattenStoredNodes(flattenStoredNodes(replacedDocument.nodes).filter(node => node.id === replacing.nodeId)).map(node => node.id))
  const isReplaced = (documentId: string, nodeId: string | null) => documentId === replacing?.documentId
    && (replacedNodeIds === null || (nodeId !== null && replacedNodeIds.has(nodeId)))
  const placeOf = placeDescriber(documents, project, words)
  const index = indexNames(project, documents)
  const namesByKey = new Map(index.map(name => [`${name.kind}:${name.id}`, name]))
  const declaredIn = (kind: DefinitionKind, id: string): string | null => {
    const name = namesByKey.get(`${kind}:${id}`)
    const home = name === undefined ? null : homeOf(name, project)
    return home?.type === 'chapter' && !isReplaced(home.documentId, home.nodeId) ? placeOf(home.documentId, home.nodeId) : null
  }
  return {
    decisions: project.decisions.map(decision => {
      const uses = namesByKey.get(`decision:${decision.id}`)?.uses ?? []
      const usedValueIds = new Set(uses.filter(entry => entry.role !== 'declared' && entry.valueId !== undefined && !isReplaced(entry.documentId, entry.nodeId)).map(entry => entry.valueId))
      return {
        name: decision.name,
        values: decision.values.map(value => value.name),
        declaredIn: declaredIn('decision', decision.id),
        ...(decision.implicit === true ? { implicit: true } : {}),
        usedValues: decision.values.filter(value => usedValueIds.has(value.id)).map(value => value.name),
      }
    }),
    counters: project.counters.map(counter => ({ name: counter.name, declaredIn: declaredIn('counter', counter.id), ...(counter.implicit === true ? { implicit: true } : {}) })),
    endings,
    memories,
    styles: project.styles.map(style => ({ name: style.name, declaredIn: declaredIn('style', style.id), ...(style.implicit === true ? { implicit: true } : {}) })),
  }
}

/**
 * Imports text against what the project already has: its characters, positions, decisions,
 * endings, memories and scenes are known names. `scenes` are the documents of the project's scenes;
 * `documents`, all of them, tell where each definition lives and what is still used, apart from the
 * part `replacing` writes over.
 */
export function previewImport(
  text: string,
  project: ProjectDocument,
  layout: PageLayout,
  options: {
    isInsideLoop?: boolean
    scenes?: readonly ChapterDocument[]
    documents?: readonly ChapterDocument[]
    replacing?: ReplacedPart
    /** Worked out once by `knownNamesFor` for many previews of the same place, rather than on every key typed. */
    knownNames?: KnownNames
    /** The words of places named in problems, in the editor's language. */
    words?: StoryWords
  } = {},
): ImportPreview {
  const scenes = (options.scenes ?? []).filter(scene => project.sceneOrder.includes(scene.id))
  const result = importText(text, {
    ...(options.isInsideLoop === undefined ? {} : { isInsideLoop: options.isInsideLoop }),
    styleWidthScales: styleWidthScales(project),
    layout,
    locale: project.locale,
    knownCharacterNames: project.characters.map(character => character.name),
    knownPositionNames: project.positions.map(position => position.name),
  })
  const problems = [
    ...result.problems,
    ...checkReferences(result, {
      ...(options.knownNames ?? knownNamesFor(project, options.documents, options.replacing, options.words)),
      styleClasses: checkAuthorCss(project.css).classes,
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
/**
 * A chapter, or a scene, with no page yet: a story begun in Cyberdeck rather than imported, its pages
 * written in the storyboard. A chapter goes at the end of the story; a scene's name must be its own.
 */
export function addEmptyDocument(
  project: ProjectDocument,
  kind: 'chapter' | 'scene',
  title: string,
  environment: Environment = defaultEnvironment,
): { project: ProjectDocument; document: ChapterDocument } {
  const now = environment.now()
  const document: ChapterDocument = { formatVersion: FORMAT_VERSION, id: environment.createId(), title: title.trim() === '' ? null : title.trim(), nodes: [], createdAt: now, updatedAt: now }
  return {
    project: kind === 'chapter'
      ? { ...project, chapterOrder: [...project.chapterOrder, document.id], updatedAt: now }
      : { ...project, sceneOrder: [...project.sceneOrder, document.id], updatedAt: now },
    document,
  }
}

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
    ...project.videos.map(video => video.assetId),
    ...project.fonts.map(font => font.assetId),
    ...project.characters.flatMap(character => character.expressions.map(expression => expression.assetId)),
  ])
  return project.assets.filter(asset => !used.has(asset.id)).map(asset => asset.id)
}

export function withoutAssets(project: ProjectDocument, assetIds: readonly string[]): ProjectDocument {
  return assetIds.length === 0 ? project : { ...project, assets: project.assets.filter(asset => !assetIds.includes(asset.id)) }
}
