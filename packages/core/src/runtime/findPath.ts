import type { PlayableStory } from './playableStory'
import { StoryRuntime, type RuntimeState } from './storyRuntime'

/** Stops visited in all before the search gives up: deep enough for any story, quick enough for a click. */
const MAXIMUM_STOPS = 50_000

export interface FoundPath {
  /** The state on reaching the node, as a save holds it. */
  state: RuntimeState
  /** The options picked on the way. */
  optionIds: string[]
}

/**
 * A way to reach a page or choice when playing the story, for previewing from it: the stage then
 * shows what a player would see there. Options are tried depth first, each choice reached with
 * given decisions being explored once, so that loops end. Each option goes on from the state at its
 * choice, so that the story is played once, not again for every option. Null when no path reaches
 * the node.
 */
export function findPathTo(story: PlayableStory, nodeId: string, memory: { memoryIds: readonly string[]; endingIds: readonly string[] } = { memoryIds: [], endingIds: [] }): FoundPath | null {
  const explored = new Set<string>()
  let budget = MAXIMUM_STOPS

  const explore = (runtime: StoryRuntime, optionIds: string[]): FoundPath | null => {
    while (budget-- > 0) {
      const step = runtime.snapshot.step
      if ((step.type === 'page' && step.page.id === nodeId) || (step.type === 'choice' && step.choice.id === nodeId)) {
        return { state: runtime.exportState(), optionIds }
      }
      if (step.type === 'page') {
        runtime.next()
        continue
      }
      if (step.type !== 'choice') {
        return null
      }
      // A choice of a scene leads elsewhere from each play of it: where it was played from counts.
      // So do memories gained on the way: they open pages a path without them never reaches.
      const state = runtime.exportState()
      const gainedMemoryIds = runtime.memoryIds
      const key = `${step.choice.id}:${JSON.stringify(state.page?.playedFrom ?? [])}:${JSON.stringify(state.decisions)}:${[...gainedMemoryIds].sort().join(',')}`
      if (explored.has(key)) {
        return null
      }
      explored.add(key)
      for (const option of step.choice.options) {
        const branch = new StoryRuntime(story)
        branch.useMemory({ memoryIds: [...new Set([...memory.memoryIds, ...gainedMemoryIds])], endingIds: memory.endingIds })
        branch.restoreState(state)
        branch.choose(option.id)
        const found = explore(branch, [...optionIds, option.id])
        if (found !== null) {
          return found
        }
      }
      return null
    }
    return null
  }

  try {
    const runtime = new StoryRuntime(story)
    runtime.useMemory(memory)
    runtime.start()
    return explore(runtime, [])
  } catch {
    // A story that loops without showing anything has no path to offer.
    return null
  }
}
