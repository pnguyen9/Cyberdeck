import { alwaysStops, readingFlow } from '../format/readingFlow'
import { commandsOf, flattenStoredNodes, type ChapterDocument, type ProjectDocument, type StoredCondition, type StoredNode } from '../format/storyFormat'
import { normalizeName } from '../importer/storyNodes'
import { placeholdersIn } from '../format/textValues'
import { isPropertyAlone, RESERVED_STYLE_NAMES } from '../format/textStyles'
import { storyboardEntries } from '../storyboard/storyboard'
import { ENGLISH_STORY_WORDS, type StoryWords } from '../storyboard/storyWords'

const RESERVED_NAMES: ReadonlySet<string> = new Set(Object.values(RESERVED_STYLE_NAMES))

/**
 * Every name of a project and every place it is used: what the Index lists, what "In this view"
 * shows of the cards on screen, and what tells an edit which values are still needed elsewhere.
 */

export type NameKind = 'decision' | 'counter' | 'memory' | 'ending' | 'style' | 'scene'

/**
 * How a place uses a name: a decision is declared, given a value by a choice or a `[set]`, emptied by
 * `[unset]`, tested by a condition; a counter declared, changed by `[add]` or `[set]`, tested; a
 * memory remembered, forgotten or tested; an ending reached or tested; a style declared or used by a page; a
 * scene played. A decision or a counter is also shown by a text, `{Mood}`.
 */
export type UseRole = 'declared' | 'chosen' | 'set' | 'unset' | 'changed' | 'tested' | 'shown' | 'remembered' | 'forgotten' | 'reached' | 'used' | 'played'

export interface NameUse {
  role: UseRole
  documentId: string
  /** Null for the condition of a whole chapter, `[only if]`. */
  nodeId: string | null
  /** The value of a decision concerned, when one is: the option picked, the value set or tested. */
  valueId?: string
  /** A test in a block with an `[else]`: the decision's other values lead there. */
  withElse?: true
}

export interface IndexedName {
  kind: NameKind
  id: string
  name: string
  uses: NameUse[]
}

/** The story as it plays: what no path reaches, the loops nothing leaves, and whether each scene always ends. */
export interface StoryFlow {
  unreachableIds: ReadonlySet<string>
  endlessLoopIds: ReadonlySet<string>
  /** Whether a `[play]` never comes back, its scene always ending. */
  playStops: (play: StoredNode) => boolean
}

/** Over the whole story: an ending in one chapter can leave the next one unread, a scene that always ends what follows its plays. */
export function storyFlow(chapters: readonly ChapterDocument[], scenes: readonly ChapterDocument[]): StoryFlow {
  const scenesById = new Map(scenes.map(scene => [scene.id, scene]))
  const stopsById = new Map<string, boolean>()
  const playStops = (play: StoredNode): boolean => {
    const sceneId = play.type === 'play' ? play.sceneId : ''
    if (!stopsById.has(sceneId)) {
      // The import refuses scenes playing themselves; were one there, it is taken to come back.
      stopsById.set(sceneId, false)
      const scene = scenesById.get(sceneId)
      stopsById.set(sceneId, scene !== undefined && alwaysStops(scene.nodes, playStops))
    }
    return stopsById.get(sceneId)!
  }
  const flow = readingFlow(chapters.map(chapter => chapter.nodes), {
    scenes: scenes.map(scene => scene.nodes),
    playStops,
    conditionalChapters: new Set(chapters.flatMap((chapter, index) => chapter.condition === undefined ? [] : [index])),
  })
  return {
    unreachableIds: new Set([...flow.unreachable].map(node => node.id)),
    endlessLoopIds: new Set([...flow.endlessLoops].map(node => node.id)),
    playStops,
  }
}

/** Every decision, counter, memory, ending, style and scene of the project, in the project's order, each with its uses in the documents. */
export function indexNames(project: ProjectDocument, documents: readonly ChapterDocument[]): IndexedName[] {
  const names = new Map<string, IndexedName>()
  const add = (kind: NameKind, entries: readonly { id: string; name: string }[]) => entries.forEach(entry => names.set(`${kind}:${entry.id}`, { kind, id: entry.id, name: entry.name, uses: [] }))
  add('decision', project.decisions)
  add('counter', project.counters)
  add('memory', project.memories)
  add('ending', project.endings)
  add('style', project.styles)
  add('scene', documents.filter(document => project.sceneOrder.includes(document.id)).map(scene => ({ id: scene.id, name: scene.title ?? '' })))

  const use = (kind: NameKind, id: string, entry: NameUse) => names.get(`${kind}:${id}`)?.uses.push(entry)
  // `{…}` names a decision or a counter as written; a name asked for, also shown so, is no name of the index.
  const shownNames = new Map<string, { kind: NameKind; id: string }>([
    ...project.decisions.map(decision => [normalizeName(decision.name), { kind: 'decision' as const, id: decision.id }] as const),
    ...project.counters.map(counter => [normalizeName(counter.name), { kind: 'counter' as const, id: counter.id }] as const),
  ])
  const shown = (texts: readonly string[], documentId: string, nodeId: string) => {
    for (const name of new Set(texts.flatMap(placeholdersIn).map(normalizeName))) {
      const target = shownNames.get(name)
      if (target !== undefined) {
        use(target.kind, target.id, { role: 'shown', documentId, nodeId })
      }
    }
  }
  const tested = (condition: StoredCondition, documentId: string, nodeId: string | null, withElse = false): void => {
    switch (condition.type) {
      case 'is':
        use('decision', condition.decisionId, { role: 'tested', documentId, nodeId, valueId: condition.valueId, ...(withElse ? { withElse: true as const } : {}) })
        break
      case 'counter':
        use('counter', condition.counterId, { role: 'tested', documentId, nodeId })
        break
      case 'remembered':
        use('memory', condition.memoryId, { role: 'tested', documentId, nodeId })
        break
      case 'endingSeen':
        use('ending', condition.endingId, { role: 'tested', documentId, nodeId })
        break
      case 'and':
      case 'or':
        condition.conditions.forEach(part => tested(part, documentId, nodeId, withElse))
    }
  }

  for (const document of documents) {
    const documentId = document.id
    if (document.condition !== undefined) {
      tested(document.condition, documentId, null)
    }
    for (const node of flattenStoredNodes(document.nodes)) {
      const nodeId = node.id
      // A picture chosen by a decision's value shows that value.
      for (const command of commandsOf(node)) {
        if ((command.type === 'enter' || command.type === 'expression' || command.type === 'background' || command.type === 'illustration') && command.from !== undefined) {
          use('decision', command.from, { role: 'shown', documentId, nodeId })
        }
      }
      switch (node.type) {
        case 'definition':
          use(node.kind, node.definedId, { role: 'declared', documentId, nodeId })
          break
        case 'choice':
          shown(node.options.map(option => option.text), documentId, nodeId)
          for (const option of node.options) {
            use('decision', node.decisionId, { role: 'chosen', documentId, nodeId, valueId: option.valueId })
            if (option.condition !== null) {
              tested(option.condition, documentId, nodeId)
            }
          }
          break
        case 'condition': {
          const hasElse = node.branches.some(branch => branch.condition === null)
          node.branches.forEach(branch => branch.condition !== null && tested(branch.condition, documentId, nodeId, hasElse))
          break
        }
        case 'set':
          use('decision', node.decisionId, { role: 'set', documentId, nodeId, valueId: node.valueId })
          break
        case 'count':
          use('counter', node.counterId, { role: 'changed', documentId, nodeId })
          break
        case 'copy':
          use('decision', node.decisionId, { role: 'set', documentId, nodeId })
          use('decision', node.fromDecisionId, { role: 'tested', documentId, nodeId })
          break
        case 'draw':
          use('decision', node.decisionId, { role: 'set', documentId, nodeId })
          if (node.notInDecisionId !== null) {
            use('decision', node.notInDecisionId, { role: 'tested', documentId, nodeId })
          }
          break
        case 'askNumber':
          use('counter', node.counterId, { role: 'changed', documentId, nodeId })
          for (const bound of [node.minimum, node.maximum]) {
            if (bound?.type === 'counter') {
              use('counter', bound.counterId, { role: 'shown', documentId, nodeId })
            }
          }
          break
        case 'unset':
          use('decision', node.decisionId, { role: 'unset', documentId, nodeId, ...(node.valueId === null ? {} : { valueId: node.valueId }) })
          break
        case 'ending':
          use('ending', node.endingId, { role: 'reached', documentId, nodeId })
          break
        case 'remember':
          use('memory', node.memoryId, { role: node.forget === true ? 'forgotten' : 'remembered', documentId, nodeId })
          break
        case 'play':
          use('scene', node.sceneId, { role: 'played', documentId, nodeId })
          break
        case 'page':
          shown([node.text], documentId, nodeId)
          for (const styleId of new Set((node.styles ?? []).map(span => span.styleId))) {
            use('style', styleId, { role: 'used', documentId, nodeId })
          }
          break
      }
    }
  }
  return [...names.values()]
}

/** Where a declared decision, counter or style lives: in a chapter, at its definition node; in the project's definitions; or nowhere, made by use alone. */
export type DefinitionHome = { type: 'chapter'; documentId: string; nodeId: string } | { type: 'definitions' } | { type: 'implicit' }

export function homeOf(name: IndexedName, project: ProjectDocument): DefinitionHome {
  const declared = name.uses.find(entry => entry.role === 'declared')
  if (declared !== undefined && declared.nodeId !== null) {
    return { type: 'chapter', documentId: declared.documentId, nodeId: declared.nodeId }
  }
  const definition = name.kind === 'decision' ? project.decisions.find(decision => decision.id === name.id)
    : name.kind === 'counter' ? project.counters.find(counter => counter.id === name.id)
      : project.styles.find(style => style.id === name.id)
  const isNamedAfterProperty = definition !== undefined && 'properties' in definition && isPropertyAlone(definition)
  return definition?.implicit === true || isNamedAfterProperty ? { type: 'implicit' } : { type: 'definitions' }
}

export type NameWarningCode =
  | 'declaredNeverUsed'
  | 'testedNeverGiven'
  | 'valueTestedNeverGiven'
  | 'givenNeverTested'
  | 'valueGivenNeverTested'
  | 'counterTestedNeverChanged'
  | 'counterChangedNeverTested'
  | 'memoryTestedNeverRemembered'
  | 'memoryNeverTested'
  | 'endingNeverReached'
  | 'styleNeverUsed'
  | 'sceneNeverPlayed'

/**
 * What looks forgotten, as an IDE would point it out. A `warning` changes how the story plays (a
 * condition that never holds, an ending no player reaches); a `notice` is only unused.
 */
export interface NameWarning {
  severity: 'warning' | 'notice'
  code: NameWarningCode
  name: IndexedName
  /** The value concerned, for a decision. */
  valueName?: string
}

export function nameWarnings(index: readonly IndexedName[], project: ProjectDocument, flow: Pick<StoryFlow, 'unreachableIds'>): NameWarning[] {
  const warnings: NameWarning[] = []
  const has = (name: IndexedName, ...roles: UseRole[]) => name.uses.some(entry => roles.includes(entry.role))
  for (const name of index) {
    const usedBeyondDeclaration = name.uses.some(entry => entry.role !== 'declared')
    switch (name.kind) {
      case 'decision': {
        if (!usedBeyondDeclaration) {
          warnings.push({ severity: 'notice', code: 'declaredNeverUsed', name })
          break
        }
        const isGiven = has(name, 'chosen', 'set')
        if (has(name, 'tested') && !isGiven) {
          warnings.push({ severity: 'warning', code: 'testedNeverGiven', name })
          break
        }
        if (isGiven && !has(name, 'tested', 'shown')) {
          warnings.push({ severity: 'notice', code: 'givenNeverTested', name })
        }
        const decision = project.decisions.find(candidate => candidate.id === name.id)
        const givenValueIds = new Set(name.uses.filter(entry => entry.role === 'chosen' || entry.role === 'set').map(entry => entry.valueId))
        const testedValueIds = new Set(name.uses.filter(entry => entry.role === 'tested').map(entry => entry.valueId))
        // Of a decision holding one value, those an `[else]` takes need no test of their own.
        const isTested = has(name, 'tested') && !(decision?.multiple !== true && name.uses.some(entry => entry.role === 'tested' && entry.withElse === true))
        for (const value of decision?.values ?? []) {
          if (isGiven && testedValueIds.has(value.id) && !givenValueIds.has(value.id)) {
            warnings.push({ severity: 'warning', code: 'valueTestedNeverGiven', name, valueName: value.name })
          }
          // A decision tested as a whole may still have values nothing tests: an option renamed, a value left over.
          if (isTested && givenValueIds.has(value.id) && !testedValueIds.has(value.id)) {
            warnings.push({ severity: 'notice', code: 'valueGivenNeverTested', name, valueName: value.name })
          }
        }
        break
      }
      case 'counter':
        if (!usedBeyondDeclaration) {
          warnings.push({ severity: 'notice', code: 'declaredNeverUsed', name })
        } else if (!has(name, 'changed')) {
          // Shown and never changed, it shows what it starts at: nothing forgotten.
          if (has(name, 'tested')) {
            warnings.push({ severity: 'warning', code: 'counterTestedNeverChanged', name })
          }
        } else if (!has(name, 'tested', 'shown')) {
          warnings.push({ severity: 'notice', code: 'counterChangedNeverTested', name })
        }
        break
      case 'memory':
        if (!has(name, 'remembered')) {
          warnings.push({ severity: 'warning', code: 'memoryTestedNeverRemembered', name })
        } else if (!has(name, 'tested')) {
          warnings.push({ severity: 'notice', code: 'memoryNeverTested', name })
        }
        break
      case 'ending': {
        const reached = name.uses.filter(entry => entry.role === 'reached')
        if (reached.every(entry => entry.nodeId !== null && flow.unreachableIds.has(entry.nodeId))) {
          warnings.push({ severity: 'warning', code: 'endingNeverReached', name })
        }
        break
      }
      case 'style':
        // The reserved styles are drawn on title cards and the end screen, not on pages.
        if (!has(name, 'used') && !RESERVED_NAMES.has(normalizeName(name.name))) {
          warnings.push({ severity: 'notice', code: 'styleNeverUsed', name })
        }
        break
      case 'scene':
        if (!name.uses.some(entry => entry.role === 'played' && (entry.nodeId === null || !flow.unreachableIds.has(entry.nodeId)))) {
          warnings.push({ severity: 'warning', code: 'sceneNeverPlayed', name })
        }
        break
    }
  }
  return warnings
}

/**
 * Labels of the places of a chapter or scene, as the storyboard numbers them: `page 7a`,
 * `choice 6`, and for what lies between cards, `after 7a` or `at the start`.
 */
export function placeLabels(document: ChapterDocument, project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): Map<string, string> {
  const labels = new Map<string, string>()
  let lastNumber: string | null = null
  for (const entry of storyboardEntries(document, project, { words })) {
    if (entry.type === 'card') {
      labels.set(entry.node.id, entry.node.type === 'page' ? words.page(entry.number) : words.choice(entry.number))
      lastNumber = entry.number
    } else if (!labels.has(entry.node.id)) {
      labels.set(entry.node.id, lastNumber === null ? words.atTheStart : words.after(lastNumber))
    }
  }
  return labels
}

/**
 * Says where a place is, `Chapter 2 — Rooftop · page 7a`, or the chapter alone for its `[only if]`;
 * the labels of a chapter are made the first time one of its places is asked for.
 */
export function placeDescriber(documents: readonly ChapterDocument[], project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): (documentId: string, nodeId: string | null) => string {
  const labelsByDocument = new Map<string, Map<string, string>>()
  return (documentId, nodeId) => {
    const document = documents.find(candidate => candidate.id === documentId)
    if (document === undefined) {
      return '?'
    }
    if (nodeId === null) {
      return documentLabel(document, project, words)
    }
    if (!labelsByDocument.has(documentId)) {
      labelsByDocument.set(documentId, placeLabels(document, project, words))
    }
    return `${documentLabel(document, project, words)} · ${labelsByDocument.get(documentId)?.get(nodeId) ?? ''}`
  }
}

/** `Chapter 2 — Rooftop`, `Scene: Caught`, `Untitled chapter`. */
export function documentLabel(document: ChapterDocument, project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): string {
  return project.sceneOrder.includes(document.id) ? words.scene(document.title ?? '') : document.title ?? words.untitledChapter
}
