import type { PlayableStory } from '../runtime/playableStory'
import { StoryRuntime, type RuntimeState } from '../runtime/storyRuntime'
import { savedValues } from '../saves/saveData'
import { decisionsTestedFrom, pointKeyOf } from './progress'

/** What a story is played with when it is explored: what the profile remembers and the endings it has seen. */
export interface ExploringMemory {
  memoryIds: readonly string[]
  endingIds: readonly string[]
}

/** Stops a walk may still make, pages and choices together, shared by every path it plays. */
export interface StopBudget {
  stops: number
}

/** Explored maps and searches are dated alike: they are the story's, not a player's. */
export const EXPLORED_AT = '1970-01-01T00:00:00.000Z'

/** A runtime at the start of the story, the same draws each time so that a walk finds the same paths. */
export function startedRuntime(story: PlayableStory, memory: ExploringMemory): StoryRuntime {
  const runtime = new StoryRuntime(story)
  runtime.useMemory(memory)
  runtime.start(0)
  return runtime
}

/** Plays on to the next choice, end or grid: pages read on, names and numbers asked left to what is proposed. */
export function playToNextStop(runtime: StoryRuntime, budget: StopBudget) {
  for (let step = runtime.snapshot.step; budget.stops > 0; step = runtime.snapshot.step) {
    if (step.type === 'page') {
      runtime.next()
    } else if (step.type === 'askNumber') {
      runtime.answerNumber(null)
    } else if (step.type === 'ask') {
      runtime.answer('')
    } else {
      return
    }
    budget.stops--
  }
}

/** A path going on from a choice by one of its options, remembering what the path so far gained. */
export function branchFrom(story: PlayableStory, memory: ExploringMemory, runtime: StoryRuntime, state: RuntimeState, optionId: string, budget: StopBudget): StoryRuntime {
  const branched = new StoryRuntime(story)
  branched.useMemory({ memoryIds: [...new Set([...memory.memoryIds, ...runtime.memoryIds])], endingIds: memory.endingIds })
  branched.restoreState(state)
  branched.choose(optionId)
  budget.stops--
  return branched
}

/** The state a choice is reached in, by the values that may still change what follows: each explored once. */
export function stateKeyOf(story: PlayableStory, state: RuntimeState, choiceId: string): string {
  return pointKeyOf(choiceId, { ...savedValues(story, state), page: state.page }, decisionsTestedFrom(story, choiceId))
}
