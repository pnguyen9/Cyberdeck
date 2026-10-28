import { alwaysStops } from '../format/readingFlow'
import { ENGLISH_STORY_WORDS } from './storyWords'
import { flattenStoredNodes, innerListsOf, type ChapterDocument, type ProjectDocument, type StoredConditionNode, type StoredLoop, type StoredNode } from '../format/storyFormat'
import { moveNodes, storyboardEntries, type DropSlot, type StoryboardEntry, type StoryboardOptions } from './storyboard'

/**
 * The storyboard grid shows a chapter one level at a time: its pages and markers, and each
 * condition or loop as one block that moves as a whole. A block shows its branches (a loop, its
 * body) inside its frame, or, holding more pages than the author's limit, as a single card.
 * Entering a block shows them as lanes, a level of their own.
 */
export type LevelElement =
  | {
    kind: 'entry'
    id: string
    entry: Extract<StoryboardEntry, { type: 'card' | 'marker' }>
    containerId: string | null
    index: number
    /** Every path before it ends: playing never gets there. */
    isUnreachable: boolean
  }
  | {
    kind: 'block'
    id: string
    node: StoredConditionNode | StoredLoop
    containerId: string | null
    index: number
    /** Pages and choices in all its branches. */
    pageCount: number
    /** Too many pages to show inside the frame: one card stands for the block. */
    isCollapsed: boolean
    isUnreachable: boolean
    /** Branches that stop inside the block, at an ending, never coming out of it; none for a loop. */
    endingRouteCount: number
    /** Every branch stops, an `else` among them: nothing after the block is reached from it. */
    allRoutesEnd: boolean
    /** A loop that nothing inside can leave: the player would be stuck in it. */
    isEndless: boolean
    /** Pages and choices inside that no path reaches, hidden when the block shows as one card. */
    unreachablePageCount: number
    /** The numbers of the main line it spans, branch letters aside: `7–9`; empty when it holds no page. */
    numbers: string
    branches: LevelLane[]
  }

/** A list of nodes shown together: the chapter's own, or one branch of the block entered. */
export interface LevelLane {
  containerId: string | null
  /** `if Answer is Truth`, `else`, `repeats until a break`; null for the chapter. */
  text: string | null
  /** Branch letters, for colours: `a`, `ab`; empty for the chapter. */
  branch: string
  /** Playing this list always stops before its end. */
  stops: boolean
  elements: LevelElement[]
}

export interface StoryboardLevel {
  /** The blocks entered, outermost first, with their condition: what the path above the grid shows. */
  path: { id: string; kind: 'condition' | 'loop'; text: string }[]
  lanes: LevelLane[]
}

export interface LevelOptions extends Pick<StoryboardOptions, 'sceneNames' | 'words'> {
  /** Blocks holding more pages than this show as one card. */
  blockPageLimit: number
  /** Nodes never reached, and loops nothing leaves: `readingFlow` over the story's chapters in playing order. */
  unreachableIds?: ReadonlySet<string>
  endlessLoopIds?: ReadonlySet<string>
  /** Whether a `[play]` never comes back, its scene always ending: the play ends routes too. */
  playStops?: (play: StoredNode) => boolean
}

/** The level inside the block `blockId`, or the chapter's own when null; null when the block no longer exists. */
export function storyboardLevel(chapter: ChapterDocument, project: ProjectDocument, blockId: string | null, options: LevelOptions): StoryboardLevel | null {
  const entries = storyboardEntries(chapter, project, options)
  const words = options.words ?? ENGLISH_STORY_WORDS
  const entriesById = new Map(entries.map(entry => [entry.id, entry]))
  const isUnreachable = (nodeId: string) => options.unreachableIds?.has(nodeId) ?? false

  const branchText = (node: StoredConditionNode, branchIndex: number) => {
    const branch = node.branches[branchIndex]!
    const entry = entriesById.get(branchIndex === 0 ? node.id : `${node.id}/${branch.id}`)
    const text = entry !== undefined && 'text' in entry ? entry.text : ''
    return branchIndex === 0 ? `if ${text}` : text
  }
  const branchLetters = (node: StoredConditionNode, branchIndex: number) => {
    const branch = node.branches[branchIndex]!
    return entriesById.get(branchIndex === 0 ? node.id : `${node.id}/${branch.id}`)?.branch ?? ''
  }
  /** The lanes of a block: a condition's branches, a loop's body. */
  const lanesOf = (block: StoredConditionNode | StoredLoop, showElements: boolean): LevelLane[] => block.type === 'loop'
    ? [{
        containerId: block.id,
        text: words.repeatsUntilBreak,
        branch: entriesById.get(block.id)?.branch ?? '',
        stops: alwaysStops(block.nodes, options.playStops),
        elements: showElements ? elementsOf(block.nodes, block.id) : [],
      }]
    : block.branches.map((branch, branchIndex) => ({
        containerId: branch.id,
        text: branchText(block, branchIndex),
        branch: branchLetters(block, branchIndex),
        stops: alwaysStops(branch.nodes, options.playStops),
        elements: showElements ? elementsOf(branch.nodes, branch.id) : [],
      }))

  const elementsOf = (nodes: readonly StoredNode[], containerId: string | null): LevelElement[] => nodes.flatMap((node, index): LevelElement[] => {
    if (node.type !== 'condition' && node.type !== 'loop') {
      const entry = entriesById.get(node.id)
      return entry?.type === 'card' || entry?.type === 'marker' ? [{ kind: 'entry', id: node.id, entry, containerId, index, isUnreachable: isUnreachable(node.id) }] : []
    }
    const cards = flattenStoredNodes(innerListsOf(node).flatMap(list => list.nodes)).filter(inner => inner.type === 'page' || inner.type === 'choice')
    const numbers = cards.map(card => Number.parseInt((entriesById.get(card.id) as { number?: string } | undefined)?.number ?? '', 10)).filter(Number.isFinite)
    const [first, last] = [Math.min(...numbers), Math.max(...numbers)]
    const isCollapsed = cards.length > options.blockPageLimit
    return [{
      kind: 'block',
      id: node.id,
      node,
      containerId,
      index,
      pageCount: cards.length,
      isCollapsed,
      isUnreachable: isUnreachable(node.id),
      endingRouteCount: node.type === 'loop' ? 0 : node.branches.filter(branch => alwaysStops(branch.nodes, options.playStops)).length,
      allRoutesEnd: node.type === 'condition' && alwaysStops([node], options.playStops),
      isEndless: options.endlessLoopIds?.has(node.id) ?? false,
      unreachablePageCount: cards.filter(card => isUnreachable(card.id)).length,
      numbers: numbers.length === 0 ? '' : first === last ? String(first) : `${first}–${last}`,
      branches: lanesOf(node, !isCollapsed),
    }]
  })

  if (blockId === null) {
    return { path: [], lanes: [{ containerId: null, text: null, branch: '', stops: alwaysStops(chapter.nodes, options.playStops), elements: elementsOf(chapter.nodes, null) }] }
  }
  const ancestors = blockPath(chapter.nodes, blockId)
  const block = ancestors?.at(-1)
  if (ancestors === null || block === undefined) {
    return null
  }
  return {
    path: ancestors.map(ancestor => ancestor.type === 'loop'
      ? { id: ancestor.id, kind: 'loop', text: words.loop }
      : { id: ancestor.id, kind: 'condition', text: branchText(ancestor, 0) }),
    lanes: lanesOf(block, true),
  }
}

/** Where a node is: the list holding it (null for the chapter's) and its place there. */
export function locateNode(chapter: ChapterDocument, nodeId: string): { containerId: string | null; index: number } | null {
  const search = (nodes: readonly StoredNode[], containerId: string | null): { containerId: string | null; index: number } | null => {
    for (const [index, node] of nodes.entries()) {
      if (node.id === nodeId) {
        return { containerId, index }
      }
      for (const list of innerListsOf(node)) {
        const found = search(list.nodes, list.id)
        if (found !== null) {
          return found
        }
      }
    }
    return null
  }
  return search(chapter.nodes, null)
}

/** The block whose branch (or body) is the container, which is the level showing it; null for the chapter. */
export function blockOfContainer(chapter: ChapterDocument, containerId: string | null): string | null {
  if (containerId === null) {
    return null
  }
  return flattenStoredNodes(chapter.nodes).find(node => innerListsOf(node).some(list => list.id === containerId))?.id ?? null
}

/**
 * Moves side by side nodes of one list one place back or forth. At the start or end of a branch,
 * they leave the block, landing before or after it: the way out of a block with the keyboard.
 */
export function stepNodes(chapter: ChapterDocument, nodeIds: readonly string[], direction: -1 | 1, now: string): ChapterDocument {
  const places = nodeIds.map(nodeId => locateNode(chapter, nodeId)).filter(place => place !== null)
  if (places.length === 0 || places.some(place => place.containerId !== places[0]!.containerId)) {
    return chapter
  }
  const containerId = places[0]!.containerId
  const first = Math.min(...places.map(place => place.index))
  const last = Math.max(...places.map(place => place.index))
  const length = containerNodes(chapter, containerId)?.length ?? 0
  let slot: DropSlot | null = null
  if (direction === -1 && first > 0) {
    slot = { containerId, index: first - 1 }
  } else if (direction === 1 && last < length - 1) {
    slot = { containerId, index: last + 2 }
  } else {
    const block = blockOfContainer(chapter, containerId)
    const blockPlace = block === null ? null : locateNode(chapter, block)
    if (blockPlace !== null) {
      slot = { containerId: blockPlace.containerId, index: blockPlace.index + (direction === 1 ? 1 : 0) }
    }
  }
  return slot === null ? chapter : moveNodes(chapter, nodeIds, slot, now)
}

function containerNodes(chapter: ChapterDocument, containerId: string | null): readonly StoredNode[] | null {
  if (containerId === null) {
    return chapter.nodes
  }
  for (const node of flattenStoredNodes(chapter.nodes)) {
    const list = innerListsOf(node).find(candidate => candidate.id === containerId)
    if (list !== undefined) {
      return list.nodes
    }
  }
  return null
}

/** The blocks from the chapter down to the one asked for, or null when it is nowhere. */
function blockPath(nodes: readonly StoredNode[], blockId: string): (StoredConditionNode | StoredLoop)[] | null {
  for (const node of nodes) {
    if (node.type !== 'condition' && node.type !== 'loop') {
      continue
    }
    if (node.id === blockId) {
      return [node]
    }
    for (const list of innerListsOf(node)) {
      const inner = blockPath(list.nodes, blockId)
      if (inner !== null) {
        return [node, ...inner]
      }
    }
  }
  return null
}
