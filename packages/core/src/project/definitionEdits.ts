import { globalDefinitionLines } from '../export/exportText'
import { storeImport } from '../format/storeImport'
import { defaultEnvironment, flattenStoredNodes, type ChapterDocument, type Environment, type ProjectDocument } from '../format/storyFormat'
import type { ImportProblem } from '../importer/importTypes'
import { flattenNodes, normalizeName } from '../importer/storyNodes'
import type { PageLayout } from '../pagination/paginate'
import type { KnownNames } from '../importer/checkReferences'
import { homeOf, indexNames, type IndexedName } from './nameIndex'
import { previewImport, type ImportPreview } from './projectEdits'

/**
 * The project's own definitions, those of no chapter, edited as the text that declares them: one
 * `[decision: …]`, `[counter: …]` or `[style: Name = …]` per line. What a chapter declares stays in that chapter.
 */

/** The text of the project's definitions, as the Definitions tab shows it. */
export function definitionsText(project: ProjectDocument, documents: readonly ChapterDocument[]): string {
  return globalDefinitionLines(project, documents).join('\n')
}

export interface DefinitionsPreview extends ImportPreview {
  /** Definitions of the project left out of the text, and used nowhere: saving takes them out. */
  removedIds: DefinitionIds
}

type DefinitionIds = Record<'decisions' | 'counters' | 'styles', string[]>

const KIND_LISTS = { decision: 'decisions', counter: 'counters', style: 'styles' } as const

/** Names declared by a text, decisions, counters and styles apart, ignoring case. */
function declaredNamesIn(text: string): Record<keyof DefinitionIds, Set<string>> {
  const namesOf = (pattern: RegExp) => new Set([...text.matchAll(pattern)].map(match => normalizeName(match[1]!)))
  return {
    decisions: namesOf(/\[\s*decision(?:\s+multi)?\s*:([^=\]]+)=/gi),
    counters: namesOf(/\[\s*counter\s*:([^=\]]+)[=\]]/gi),
    styles: namesOf(/\[\s*style\s*:([^=\]]+)=/gi),
  }
}

/**
 * The text of the definitions against the project. `baseText` is the text the author started from:
 * a definition is taken out only when they deleted its line, never because it arrived in the
 * definitions after they started (moved from a chapter, for instance). `knownNames` and `index`,
 * when given, spare working them out again on every key typed.
 */
export function previewDefinitions(
  text: string,
  project: ProjectDocument,
  documents: readonly ChapterDocument[],
  layout: PageLayout,
  options: { baseText?: string; knownNames?: KnownNames; index?: readonly IndexedName[] } = {},
): DefinitionsPreview {
  const preview = previewImport(text, project, layout, { scenes: documents, documents, ...(options.knownNames === undefined ? {} : { knownNames: options.knownNames }) })
  const problems: ImportProblem[] = [...preview.problems]
  const { result } = preview
  for (const node of [...result.chapters, ...result.scenes].flatMap(document => flattenNodes(document.nodes))) {
    if (node.type !== 'definition') {
      problems.push({ severity: 'error', code: 'notADefinition', line: node.sourceLine })
    }
  }
  for (const heading of [...result.chapters, ...result.scenes].filter(document => document.title !== null)) {
    problems.push({ severity: 'error', code: 'notADefinition', line: heading.sourceLine })
  }

  const index = options.index ?? indexNames(project, documents)
  const namesOf = (declarations: readonly { name: string }[]) => new Set(declarations.map(declaration => normalizeName(declaration.name)))
  const declared = { decisions: namesOf(result.decisions), counters: namesOf(result.counters), styles: namesOf(result.styles) }
  const started = declaredNamesIn(options.baseText ?? definitionsText(project, documents))
  const removedIds: DefinitionIds = { decisions: [], counters: [], styles: [] }
  for (const name of index) {
    if (name.kind !== 'decision' && name.kind !== 'counter' && name.kind !== 'style') {
      continue
    }
    const kind = KIND_LISTS[name.kind]
    const key = normalizeName(name.name)
    if (homeOf(name, project).type !== 'definitions' || declared[kind].has(key) || !started[kind].has(key)) {
      continue
    }
    if (name.uses.some(entry => entry.role !== 'declared')) {
      problems.push({ severity: 'error', code: 'definitionStillUsed', line: 0, subject: name.name })
    } else {
      removedIds[kind].push(name.id)
    }
  }
  problems.sort((first, second) => first.line - second.line)
  return { ...preview, problems, hasErrors: problems.some(problem => problem.severity === 'error'), removedIds }
}

/** Gives the project the definitions of the text: those declared again keep their identifiers, those left out and unused go. */
export function applyDefinitions(preview: DefinitionsPreview, project: ProjectDocument, environment: Environment = defaultEnvironment): ProjectDocument {
  if (preview.hasErrors) {
    throw new Error('The definitions have errors: fix them first')
  }
  const stored = storeImport(preview.result, project, { fileName: null }, environment, preview.knownScenes)
  const removedDecisions = new Set(preview.removedIds.decisions)
  const removedCounters = new Set(preview.removedIds.counters)
  const removedStyles = new Set(preview.removedIds.styles)
  return {
    ...stored.project,
    // The text is written in no chapter: whatever storing it opened is not kept.
    chapterOrder: project.chapterOrder,
    sceneOrder: project.sceneOrder,
    decisions: stored.project.decisions.filter(decision => !removedDecisions.has(decision.id)),
    counters: stored.project.counters.filter(counter => !removedCounters.has(counter.id)),
    styles: stored.project.styles.filter(style => !removedStyles.has(style.id)),
    updatedAt: environment.now(),
  }
}

/** The definitions a chapter declares, which removing it moves to the project's definitions. */
export function definitionsOf(chapter: ChapterDocument, project: ProjectDocument): string[] {
  return flattenStoredNodes(chapter.nodes).flatMap(node => {
    if (node.type !== 'definition') {
      return []
    }
    const named = node.kind === 'decision' ? project.decisions.find(decision => decision.id === node.definedId)
      : node.kind === 'counter' ? project.counters.find(counter => counter.id === node.definedId)
        : project.styles.find(style => style.id === node.definedId)
    return named === undefined ? [] : [named.name]
  })
}
