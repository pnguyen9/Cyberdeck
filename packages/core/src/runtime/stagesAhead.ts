import type { PlayableStory } from './playableStory'
import type { StageState } from './stageState'
import { StoryRuntime, type RuntimeState } from './storyRuntime'

/** How far ahead the player looks: stops in all, every option of a choice sharing them. */
const STOPS_AHEAD = 12

/**
 * The stages of the next stops after the one `state` is at, nearest first, every option of a choice
 * followed: what the player prepares the pictures of, so that each shows the moment it is needed.
 * Names and numbers asked are taken as proposed; a grid or the end is as far as a path looks.
 */
export function stagesAhead(
  story: PlayableStory,
  state: RuntimeState,
  memory: { memoryIds: readonly string[]; endingIds: readonly string[] },
  stops = STOPS_AHEAD,
): StageState[] {
  const runtimeAt = (at: RuntimeState) => {
    const runtime = new StoryRuntime(story)
    runtime.useMemory(memory)
    runtime.restoreState(at)
    return runtime
  }
  const stages: StageState[] = []
  const queue = [runtimeAt(state)]
  for (let next = 0; next < queue.length && stages.length < stops; next++) {
    const runtime = queue[next]!
    const step = runtime.snapshot.step
    const moved: StoryRuntime[] = []
    if (step.type === 'choice') {
      const here = runtime.exportState()
      for (const option of step.choice.options) {
        const branched = runtimeAt(here)
        branched.choose(option.id)
        moved.push(branched)
      }
    } else if (step.type === 'page') {
      runtime.next()
      moved.push(runtime)
    } else if (step.type === 'ask') {
      runtime.answer('')
      moved.push(runtime)
    } else if (step.type === 'askNumber') {
      runtime.answerNumber(null)
      moved.push(runtime)
    }
    queue.push(...moved)
    stages.push(...moved.map(reached => reached.snapshot.stage))
  }
  return stages.slice(0, stops)
}
