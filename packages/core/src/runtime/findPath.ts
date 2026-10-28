import { testedIdsOf } from '../format/storyFormat'
import type { PlayableStory } from './playableStory'
import { StoryRuntime, type PlayerStep, type RuntimeState } from './storyRuntime'

/** Stops visited in all before the search gives up: deep enough for any story, quick enough for a click. */
const MAXIMUM_STOPS = 50_000

export interface FoundPath {
  /** The state on reaching the node, as a save holds it. */
  state: RuntimeState
  /** The options picked on the way. */
  optionIds: string[]
}

function nodeIdOf(step: PlayerStep): string | null {
  return step.type === 'page' ? step.page.id : step.type === 'choice' ? step.choice.id : step.type === 'ask' ? step.ask.id : null
}

/**
 * The shortest way to reach a page or choice when playing the story, for previewing from it: the
 * stage then shows what a player would see there. Paths are tried breadth first, each choice reached
 * with given values of the decisions and counters conditions test being explored once, so that loops
 * end, and a loop counting up for ever does not hide the way out. Each option goes on from the state at its choice, so that the
 * story is played once, not again for every option. Null when no path reaches the node.
 */
export function findPathTo(story: PlayableStory, nodeId: string, memory: { memoryIds: readonly string[]; endingIds: readonly string[] } = { memoryIds: [], endingIds: [] }): FoundPath | null {
  const explored = new Set<string>()
  let budget = MAXIMUM_STOPS
  const testedIds = testedIdsOf(story.chapters)
  const tested = (values: Readonly<Record<string, unknown>>) => JSON.stringify(Object.entries(values).filter(([id]) => testedIds.has(id)).sort(([first], [second]) => first.localeCompare(second)))

  try {
    const first = new StoryRuntime(story)
    first.useMemory(memory)
    first.start()
    const queue = [{ runtime: first, optionIds: [] as string[] }]
    for (let next = 0; next < queue.length; next++) {
      const { runtime, optionIds } = queue[next]!
      // Pages are read on; names asked for are left to their defaults.
      for (let step = runtime.snapshot.step; budget-- > 0 && (step.type === 'page' || step.type === 'ask') && nodeIdOf(step) !== nodeId; step = runtime.snapshot.step) {
        if (step.type === 'page') {
          runtime.next()
        } else {
          runtime.answer('')
        }
      }
      const step = runtime.snapshot.step
      if (nodeIdOf(step) === nodeId) {
        return { state: runtime.exportState(), optionIds }
      }
      if (budget <= 0) {
        return null
      }
      if (step.type !== 'choice') {
        continue
      }
      // A choice of a scene leads elsewhere from each play of it: where it was played from counts.
      // So do memories gained on the way: they open pages a path without them never reaches.
      const state = runtime.exportState()
      const gainedMemoryIds = runtime.memoryIds
      const key = `${step.choice.id}:${JSON.stringify(state.page?.playedFrom ?? [])}:${tested(state.decisions)}:${tested(state.counters)}:${[...gainedMemoryIds].sort().join(',')}`
      if (explored.has(key)) {
        continue
      }
      explored.add(key)
      for (const option of step.choice.options) {
        const branch = new StoryRuntime(story)
        branch.useMemory({ memoryIds: [...new Set([...memory.memoryIds, ...gainedMemoryIds])], endingIds: memory.endingIds })
        branch.restoreState(state)
        branch.choose(option.id)
        budget--
        queue.push({ runtime: branch, optionIds: [...optionIds, option.id] })
      }
    }
    return null
  } catch {
    // A story that loops without showing anything has no path to offer.
    return null
  }
}
