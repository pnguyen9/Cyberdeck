import { flattenStoredNodes, defaultEnvironment, innerListsOf, type ChapterDocument, type Environment, type ProjectDocument, type StoredNode } from '../format/storyFormat'
import { storeImport } from '../format/storeImport'
import type { ImportProblem } from '../importer/importTypes'
import type { PageLayout } from '../pagination/paginate'
import { insertNodes, removeNodes, replaceNode, type DropSlot } from '../storyboard/storyboard'
import { previewImport, type ImportPreview } from './projectEdits'

/**
 * Editing in the storyboard: a page (or a marker) is edited as the text that imports into it, and
 * new pages are written the same way. The text may become several nodes: a page grown too long is
 * cut as an import would, a new name creates a character.
 */
export type NodeEditTarget = { type: 'replace'; nodeId: string } | { type: 'insert'; slot: DropSlot }

/** Whether the place edited lies inside a loop, where `[break]` belongs. */
function editsInsideLoop(chapter: ChapterDocument, target: NodeEditTarget): boolean {
  const search = (nodes: readonly StoredNode[], isInLoop: boolean): boolean | null => {
    for (const node of nodes) {
      if (target.type === 'replace' && node.id === target.nodeId) {
        return isInLoop
      }
      for (const list of innerListsOf(node)) {
        const isListInLoop = isInLoop || node.type === 'loop'
        if (target.type === 'insert' && list.id === target.slot.containerId) {
          return isListInLoop
        }
        const found = search(list.nodes, isListInLoop)
        if (found !== null) {
          return found
        }
      }
    }
    return null
  }
  return search(chapter.nodes, false) ?? false
}

/** Previews the text against the project; `chapters` are its documents, scenes included. */
export function previewNodeEdit(
  text: string,
  project: ProjectDocument,
  chapters: readonly ChapterDocument[],
  chapterId: string,
  target: NodeEditTarget,
  layout: PageLayout,
): ImportPreview {
  const chapter = chapters.find(candidate => candidate.id === chapterId)
  const preview = previewImport(text, project, layout, { isInsideLoop: chapter !== undefined && editsInsideLoop(chapter, target), scenes: chapters })
  // A page edited lies inside a chapter: a heading or a condition on the whole chapter has no place there.
  const onlyIfLine = preview.result.chapters.some(edited => edited.condition !== undefined)
    ? text.split('\n').findIndex(line => /\[\s*only if\s*:/i.test(line))
    : -1
  if (onlyIfLine !== -1) {
    const misplaced: ImportProblem = { severity: 'error', code: 'onlyIfMisplaced', line: onlyIfLine + 1 }
    return { ...preview, problems: [...preview.problems, misplaced].sort((first, second) => first.line - second.line), hasErrors: true }
  }
  const headingLine = text.split('\n').findIndex(line => line.trimStart().startsWith('#'))
  if (headingLine === -1) {
    return preview
  }
  const heading: ImportProblem = { severity: 'error', code: 'chapterHeadingInEdit', line: headingLine + 1 }
  return { ...preview, problems: [...preview.problems, heading].sort((first, second) => first.line - second.line), hasErrors: true }
}

/**
 * Stores the edit in the chapter. The first node keeps the identifier of the one it replaces when
 * it is of the same kind, so that saves on that page stay valid.
 */
export function applyNodeEdit(
  preview: ImportPreview,
  project: ProjectDocument,
  chapters: readonly ChapterDocument[],
  chapterId: string,
  target: NodeEditTarget,
  environment: Environment = defaultEnvironment,
): { project: ProjectDocument; chapter: ChapterDocument; nodeIds: string[] } {
  if (preview.hasErrors) {
    throw new Error('The text has errors: fix them first')
  }
  const chapter = chapters.find(candidate => candidate.id === chapterId)
  if (chapter === undefined) {
    throw new Error(`No chapter ${chapterId} in the project`)
  }
  const now = environment.now()
  const stored = storeImport(preview.result, project, { fileName: null }, environment, preview.knownScenes)
  let nodes: StoredNode[] = stored.chapters.flatMap(storedChapter => storedChapter.nodes)

  let edited: ChapterDocument
  if (target.type === 'replace') {
    const replaced = flattenStoredNodes(chapter.nodes).find(node => node.id === target.nodeId)
    const [first, ...others] = nodes
    if (first !== undefined && first.type === replaced?.type) {
      nodes = [{ ...first, id: replaced.id }, ...others]
    }
    edited = replaceNode(chapter, target.nodeId, nodes, now)
  } else {
    edited = insertNodes(chapter, target.slot, nodes, now)
  }
  return {
    project: { ...stored.project, chapterOrder: project.chapterOrder, updatedAt: now },
    chapter: edited,
    nodeIds: nodes.map(node => node.id),
  }
}

