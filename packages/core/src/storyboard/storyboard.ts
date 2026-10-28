import {
  innerListsOf,
  mapInnerLists,
  type ChapterDocument,
  type ProjectDocument,
  type StoredBreak,
  type StoredPlay,
  type StoredChoice,
  type StoredConditionNode,
  type StoredEnding,
  type StoredLoop,
  type StoredNode,
  type StoredPage,
  type StoredRemember,
  type StoredSet,
  type StoredUnset,
  type StoredDefinition,
  type StoredStage,
} from '../format/storyFormat'
import { describeAssignment, describeCondition, describeDefinition, describeStageCommand, describeUnset } from './describeNodes'
import { ENGLISH_STORY_WORDS, type StoryWords } from './storyWords'

/**
 * A chapter laid out as the storyboard shows it: one entry after another, read left to right and
 * top to bottom. Pages and choices are numbered cards; pages inside branches carry the branch
 * letters (12a, 12b, 12ab when nested), the main line resuming after the longest branch. Endings,
 * memories, breaks, plays of scenes, assignments and staging are markers between cards; a condition opens with its
 * test, each further branch with `else`, and closes with an end entry; a loop likewise.
 *
 * Each entry tells where nodes dropped right after it go: its `slot`.
 */
export type StoryboardEntry =
  | { type: 'card'; id: string; node: StoredPage | StoredChoice; number: string; branch: string; slot: DropSlot }
  | { type: 'marker'; id: string; node: StoredStage | StoredSet | StoredUnset | StoredDefinition | StoredEnding | StoredRemember | StoredBreak | StoredPlay; text: string; branch: string; slot: DropSlot }
  | { type: 'conditionStart'; id: string; node: StoredConditionNode; text: string; branch: string; slot: DropSlot }
  | { type: 'branchStart'; id: string; node: StoredConditionNode; branchIndex: number; text: string; branch: string; slot: DropSlot }
  | { type: 'conditionEnd'; id: string; node: StoredConditionNode; branch: string; slot: DropSlot }
  | { type: 'loopStart'; id: string; node: StoredLoop; branch: string; slot: DropSlot }
  | { type: 'loopEnd'; id: string; node: StoredLoop; branch: string; slot: DropSlot }

/** A position in a list of nodes: the chapter's own (`containerId` null) or a branch's. */
export interface DropSlot {
  containerId: string | null
  index: number
}

export const CHAPTER_START: DropSlot = { containerId: null, index: 0 }

export interface StoryboardOptions {
  /** Names of the project's scenes by identifier, for the plays. */
  sceneNames?: ReadonlyMap<string, string>
  /** The words around names, in the editor's language. */
  words?: StoryWords
}

export function storyboardEntries(chapter: ChapterDocument, project: ProjectDocument, options: StoryboardOptions = {}): StoryboardEntry[] {
  const entries: StoryboardEntry[] = []
  const words = options.words ?? ENGLISH_STORY_WORDS

  /** Lays out a list of nodes; returns the number of the last card. */
  const layOut = (nodes: readonly StoredNode[], containerId: string | null, branch: string, previousNumber: number): number => {
    let number = previousNumber
    for (const [index, node] of nodes.entries()) {
      const slot = { containerId, index: index + 1 }
      switch (node.type) {
        case 'page':
        case 'choice':
          number++
          entries.push({ type: 'card', id: node.id, node, number: `${number}${branch}`, branch, slot })
          break
        case 'stage':
          entries.push({ type: 'marker', id: node.id, node, text: node.commands.map(command => describeStageCommand(command, project)).join(', '), branch, slot })
          break
        case 'set':
          entries.push({ type: 'marker', id: node.id, node, text: describeAssignment(node.decisionId, node.valueId, project), branch, slot })
          break
        case 'unset':
          entries.push({ type: 'marker', id: node.id, node, text: describeUnset(node.decisionId, node.valueId, project, words), branch, slot })
          break
        case 'ending':
          entries.push({ type: 'marker', id: node.id, node, text: project.endings.find(ending => ending.id === node.endingId)?.name ?? '?', branch, slot })
          break
        case 'remember':
          entries.push({ type: 'marker', id: node.id, node, text: project.memories.find(memory => memory.id === node.memoryId)?.name ?? '?', branch, slot })
          break
        case 'definition':
          entries.push({ type: 'marker', id: node.id, node, text: describeDefinition(node.kind, node.definedId, project, words), branch, slot })
          break
        case 'break':
          entries.push({ type: 'marker', id: node.id, node, text: words.outOfTheLoop, branch, slot })
          break
        case 'play':
          entries.push({ type: 'marker', id: node.id, node, text: options.sceneNames?.get(node.sceneId) ?? '?', branch, slot })
          break
        case 'loop':
          entries.push({ type: 'loopStart', id: node.id, node, branch, slot: { containerId: node.id, index: 0 } })
          number = layOut(node.nodes, node.id, branch, number)
          entries.push({ type: 'loopEnd', id: `${node.id}/end`, node, branch, slot })
          break
        case 'condition': {
          let longest = number
          for (const [branchIndex, conditionBranch] of node.branches.entries()) {
            const letters = `${branch}${branchLetter(branchIndex)}`
            const branchSlot = { containerId: conditionBranch.id, index: 0 }
            if (branchIndex === 0) {
              entries.push({ type: 'conditionStart', id: node.id, node, text: conditionBranch.condition === null ? 'always' : describeCondition(conditionBranch.condition, project), branch: letters, slot: branchSlot })
            } else {
              const text = conditionBranch.condition === null ? 'else' : `else if ${describeCondition(conditionBranch.condition, project)}`
              entries.push({ type: 'branchStart', id: `${node.id}/${conditionBranch.id}`, node, branchIndex, text, branch: letters, slot: branchSlot })
            }
            longest = Math.max(longest, layOut(conditionBranch.nodes, conditionBranch.id, letters, number))
          }
          entries.push({ type: 'conditionEnd', id: `${node.id}/end`, node, branch, slot })
          number = longest
          break
        }
      }
    }
    return number
  }

  layOut(chapter.nodes, null, '', 0)
  return entries
}

/**
 * Moves nodes to a slot, keeping their reading order. Nodes inside a moved condition move with it;
 * a condition cannot go inside itself, and such a move leaves the chapter unchanged.
 */
export function moveNodes(chapter: ChapterDocument, nodeIds: readonly string[], slot: DropSlot, now: string): ChapterDocument {
  const moved = topmostNodes(chapter.nodes, new Set(nodeIds))
  if (moved.length === 0 || (slot.containerId !== null && moved.some(node => containsContainer(node, slot.containerId!)))) {
    return chapter
  }
  // A `[break]` leaves the loop around it: out of every loop, it would have nothing to leave.
  if (hasLooseBreak(moved) && !isListInLoop(chapter.nodes, slot.containerId)) {
    return chapter
  }
  const movedIds = new Set(moved.map(node => node.id))
  const containerNodes = slot.containerId === null ? chapter.nodes : findContainer(chapter.nodes, slot.containerId)
  if (containerNodes === null) {
    return chapter
  }
  const index = slot.index - containerNodes.slice(0, slot.index).filter(node => movedIds.has(node.id)).length
  const withoutMoved = removeFrom(chapter.nodes, movedIds)
  const nodes = slot.containerId === null
    ? [...withoutMoved.slice(0, index), ...moved, ...withoutMoved.slice(index)]
    : insertInto(withoutMoved, slot.containerId, index, moved)
  return { ...chapter, nodes, updatedAt: now }
}

/** Puts nodes at a slot. */
export function insertNodes(chapter: ChapterDocument, slot: DropSlot, nodes: readonly StoredNode[], now: string): ChapterDocument {
  const inserted = slot.containerId === null
    ? [...chapter.nodes.slice(0, slot.index), ...nodes, ...chapter.nodes.slice(slot.index)]
    : insertInto(chapter.nodes, slot.containerId, slot.index, nodes)
  return { ...chapter, nodes: inserted, updatedAt: now }
}

/** Puts nodes in place of one, wherever it is; none removes it. */
export function replaceNode(chapter: ChapterDocument, nodeId: string, replacement: readonly StoredNode[], now: string): ChapterDocument {
  const replaceIn = (nodes: readonly StoredNode[]): StoredNode[] => nodes.flatMap(node => node.id === nodeId
    ? [...replacement]
    : [mapInnerLists(node, list => replaceIn(list.nodes))])
  return { ...chapter, nodes: replaceIn(chapter.nodes), updatedAt: now }
}

export function removeNodes(chapter: ChapterDocument, nodeIds: readonly string[], now: string): ChapterDocument {
  return { ...chapter, nodes: removeFrom(chapter.nodes, new Set(nodeIds)), updatedAt: now }
}

/** Letters of branches: a to z, then aa, ab… for conditions with more branches than letters. */
function branchLetter(index: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return index < letters.length ? letters[index]! : `${letters[Math.floor(index / letters.length) - 1]}${letters[index % letters.length]}`
}

/** Breaks among the nodes, those of their own loops aside. */
function hasLooseBreak(nodes: readonly StoredNode[]): boolean {
  return nodes.some(node => node.type === 'break' || (node.type === 'condition' && node.branches.some(branch => hasLooseBreak(branch.nodes))))
}

/** Whether the list of that identifier lies inside a loop; the chapter's own never does. */
function isListInLoop(nodes: readonly StoredNode[], containerId: string | null): boolean {
  if (containerId === null) {
    return false
  }
  const search = (inner: readonly StoredNode[], insideLoop: boolean): boolean | null => {
    for (const node of inner) {
      for (const list of innerListsOf(node)) {
        const listInLoop = insideLoop || node.type === 'loop'
        if (list.id === containerId) {
          return listInLoop
        }
        const found = search(list.nodes, listInLoop)
        if (found !== null) {
          return found
        }
      }
    }
    return null
  }
  return search(nodes, false) ?? false
}

/** The nodes asked for, in reading order, leaving out those inside another one asked for. */
function topmostNodes(nodes: readonly StoredNode[], ids: ReadonlySet<string>): StoredNode[] {
  return nodes.flatMap(node => ids.has(node.id) ? [node] : innerListsOf(node).flatMap(list => topmostNodes(list.nodes, ids)))
}

function containsContainer(node: StoredNode, containerId: string): boolean {
  return innerListsOf(node).some(list => list.id === containerId || list.nodes.some(inner => containsContainer(inner, containerId)))
}

function findContainer(nodes: readonly StoredNode[], containerId: string): readonly StoredNode[] | null {
  for (const node of nodes) {
    for (const list of innerListsOf(node)) {
      if (list.id === containerId) {
        return list.nodes
      }
      const inner = findContainer(list.nodes, containerId)
      if (inner !== null) {
        return inner
      }
    }
  }
  return null
}

function removeFrom(nodes: readonly StoredNode[], ids: ReadonlySet<string>): StoredNode[] {
  return nodes.filter(node => !ids.has(node.id)).map(node => mapInnerLists(node, list => removeFrom(list.nodes, ids)))
}

function insertInto(nodes: readonly StoredNode[], containerId: string, index: number, inserted: readonly StoredNode[]): StoredNode[] {
  return nodes.map(node => mapInnerLists(node, list => list.id === containerId
    ? [...list.nodes.slice(0, index), ...inserted, ...list.nodes.slice(index)]
    : insertInto(list.nodes, containerId, index, inserted)))
}
