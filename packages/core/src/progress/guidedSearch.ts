import { flattenStoredNodes, type ChapterDocument, type StoredCondition, type StoredNode } from '../format/storyFormat'
import type { PlayableStory } from '../runtime/playableStory'
import { StoryRuntime, type RuntimeState } from '../runtime/storyRuntime'
import { toSave } from '../saves/saveData'
import { decisionsTestedFrom, pointKeyOf } from './progress'

/** Stops visited at most by one search, pages and choices together. */
const MAXIMUM_STOPS = 40_000
const SEARCHED_AT = '1970-01-01T00:00:00.000Z'

/** What a target needs: counters to reach, decisions to hold a value. */
type Requirement =
  | { type: 'counter'; counterId: string; operator: '=' | '!=' | '<' | '<=' | '>' | '>='; amount: number }
  | { type: 'decision'; decisionId: string; valueId: string }

/**
 * A way to a choice or an ending that only some values open, `[if: MikaBond >= 2]` before it, or an
 * option offered only then: the options to take from the start, null when none was found. The search
 * plays the paths whose values come nearest to what the target needs first, each state once.
 */
export function findGuidedPath(story: PlayableStory, targetNodeId: string, memory: { memoryIds: readonly string[]; endingIds: readonly string[] } = { memoryIds: [], endingIds: [] }): string[] | null {
  const requirements = requirementsOf(story, targetNodeId)
  const target = story.chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes)).find(node => node.id === targetNodeId)
  if (target === undefined) {
    return null
  }
  const isTarget = (runtime: StoryRuntime) => {
    const step = runtime.snapshot.step
    return target.type === 'ending' ? step.type === 'end' && step.endingId === target.endingId
      : step.type === 'choice' && step.choice.id === targetNodeId
  }
  let stops = MAXIMUM_STOPS
  const playOn = (runtime: StoryRuntime) => {
    for (let step = runtime.snapshot.step; stops > 0; step = runtime.snapshot.step) {
      if (step.type === 'page') {
        runtime.next()
      } else if (step.type === 'askNumber') {
        runtime.answerNumber(null)
      } else if (step.type === 'ask') {
        runtime.answer('')
      } else {
        return
      }
      stops--
    }
  }
  const scoreOf = (state: RuntimeState) => requirements.reduce((score, requirement) => score + nearness(requirement, state), 0)

  const first = new StoryRuntime(story)
  first.useMemory(memory)
  first.start(0)
  const explored = new Set<string>()
  let waiting: { runtime: StoryRuntime; optionIds: string[]; score: number }[] = [{ runtime: first, optionIds: [], score: 0 }]
  try {
    while (waiting.length > 0 && stops > 0) {
      // The most promising path first; of two alike, the shorter.
      waiting.sort((first, second) => second.score - first.score || first.optionIds.length - second.optionIds.length)
      const { runtime, optionIds } = waiting.shift()!
      playOn(runtime)
      if (isTarget(runtime)) {
        return optionIds
      }
      const step = runtime.snapshot.step
      if (step.type !== 'choice') {
        continue
      }
      const state = runtime.exportState()
      const key = pointKeyOf(step.choice.id, toSave(story, state, SEARCHED_AT), decisionsTestedFrom(story, step.choice.id))
      if (explored.has(key)) {
        continue
      }
      explored.add(key)
      for (const option of step.choice.options) {
        const branch = new StoryRuntime(story)
        branch.useMemory({ memoryIds: [...new Set([...memory.memoryIds, ...runtime.memoryIds])], endingIds: memory.endingIds })
        branch.restoreState(state)
        branch.choose(option.id)
        stops--
        waiting.push({ runtime: branch, optionIds: [...optionIds, option.id], score: scoreOf(branch.exportState()) })
      }
      // Only the most promising paths are kept waiting: a story of many choices has too many.
      if (waiting.length > 400) {
        waiting = waiting.sort((first, second) => second.score - first.score).slice(0, 200)
      }
    }
  } catch {
    // A path that loops without showing anything ends the search.
  }
  return null
}

/** How near a state is to a requirement, from 0 to 1: a counter at 1 of the 2 it needs is halfway. */
function nearness(requirement: Requirement, state: RuntimeState): number {
  if (requirement.type === 'decision') {
    return (Object.hasOwn(state.decisions, requirement.decisionId) ? state.decisions[requirement.decisionId] ?? [] : []).includes(requirement.valueId) ? 1 : 0
  }
  const count = Object.hasOwn(state.counters, requirement.counterId) ? state.counters[requirement.counterId] ?? 0 : 0
  switch (requirement.operator) {
    case '>=':
    case '>': {
      const needed = requirement.operator === '>' ? requirement.amount + 1 : requirement.amount
      return needed <= 0 ? (count >= needed ? 1 : 0) : Math.max(0, Math.min(count / needed, 1))
    }
    case '<':
      return count < requirement.amount ? 1 : 0
    case '<=':
      return count <= requirement.amount ? 1 : 0
    case '=':
      return count === requirement.amount ? 1 : 0
    case '!=':
      return count !== requirement.amount ? 1 : 0
  }
}

/**
 * What opens a node: the conditions of the blocks around it and of its chapter, and for a decision
 * they test, the conditions of the options giving it that value (`Evening is Mika`, offered only
 * `[if: MikaBond >= 2]`).
 */
function requirementsOf(story: PlayableStory, targetNodeId: string): Requirement[] {
  const conditions: StoredCondition[] = []
  for (const document of story.chapters) {
    const around = conditionsAround(document.nodes, targetNodeId, [])
    if (around !== null) {
      conditions.push(...(document.condition === undefined ? [] : [document.condition]), ...around)
      break
    }
  }
  const requirements = conditions.flatMap(requirementsIn)
  const options = story.chapters.flatMap((document: ChapterDocument) => flattenStoredNodes(document.nodes))
    .flatMap(node => node.type === 'choice' ? node.options.map(option => ({ decisionId: node.decisionId, ...option })) : [])
  const opening = requirements.flatMap(requirement => requirement.type !== 'decision' ? [] : options
    .filter(option => option.decisionId === requirement.decisionId && option.valueId === requirement.valueId && option.condition !== null)
    .flatMap(option => requirementsIn(option.condition!)))
  return [...requirements, ...opening]
}

/** The conditions of the branches leading to a node, null when it is not in these nodes. */
function conditionsAround(nodes: readonly StoredNode[], targetNodeId: string, conditions: readonly StoredCondition[]): StoredCondition[] | null {
  for (const node of nodes) {
    if (node.id === targetNodeId) {
      return [...conditions]
    }
    if (node.type === 'condition') {
      for (const branch of node.branches) {
        const found = conditionsAround(branch.nodes, targetNodeId, branch.condition === null ? conditions : [...conditions, branch.condition])
        if (found !== null) {
          return found
        }
      }
    } else if (node.type === 'loop') {
      const found = conditionsAround(node.nodes, targetNodeId, conditions)
      if (found !== null) {
        return found
      }
    }
  }
  return null
}

/** The requirements a condition states: every part of an `and`, the first way of an `or`. */
function requirementsIn(condition: StoredCondition): Requirement[] {
  switch (condition.type) {
    case 'and':
      return condition.conditions.flatMap(requirementsIn)
    case 'or':
      return condition.conditions.length === 0 ? [] : requirementsIn(condition.conditions[0]!)
    case 'is':
      return condition.negated ? [] : [{ type: 'decision', decisionId: condition.decisionId, valueId: condition.valueId }]
    case 'counter':
      return condition.otherCounterId !== undefined ? [] : [{ type: 'counter', counterId: condition.counterId, operator: condition.operator, amount: condition.amount }]
    default:
      return []
  }
}
