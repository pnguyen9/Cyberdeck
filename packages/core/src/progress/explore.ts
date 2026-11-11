import type { PlayableStory } from '../runtime/playableStory'
import { StoryRuntime, type RuntimeState } from '../runtime/storyRuntime'
import { toSave } from '../saves/saveData'
import { decisionsTestedFrom, emptyProgress, pointKeyOf, type PendingOption, type ProgressData, type ProgressTarget } from './progress'

/** States explored at most: past them, the map shows what was found and says it is not whole. */
const MAXIMUM_STATES = 5000
/**
 * States each choice is explored from at most: the values that matter ahead combine, and a story of
 * a dozen choices could be reached in thousands of ways. Every option of every choice is explored all
 * the same; the map then says it is not whole.
 */
const STATES_PER_CHOICE = 8
/** Stops visited at most, pages and choices together: a story that never ends stops being explored. */
const MAXIMUM_STOPS = 60_000
/** Every point explored is dated alike: the exploration is the story's, not a player's. */
const EXPLORED_AT = '1970-01-01T00:00:00.000Z'

/**
 * Every path of the story, as if a player had taken every option of every choice from the start: a
 * map for the author. Each choice is one point wherever it is reached from (in a scene, from each play
 * of it), holding the state of the first path to reach it, to preview from; each option leads to
 * where its first path went. Each state a choice is reached in is explored once, so that loops end,
 * a few states per choice at most: the values that matter ahead combine. Pages are read on, names and
 * numbers asked for left to what is proposed; a grid of picture buttons, a board to play rather than a
 * choice to map, ends a path. A part played as a game, `[game mode]`, makes no points: its options are
 * explored all the same, the paths out of it linked to the choice before it. `isWhole` is false when
 * states were left unexplored: the map shows what was found, an ending missing may need values no
 * path explored gathered.
 */
export function exploreStory(story: PlayableStory, memory: { memoryIds: readonly string[]; endingIds: readonly string[] } = { memoryIds: [], endingIds: [] }): { progress: ProgressData; isWhole: boolean } {
  let progress = emptyProgress(story)
  let stops = MAXIMUM_STOPS
  let isWhole = true
  const exploredStates = new Set<string>()
  const statesByChoice = new Map<string, number>()
  const first = new StoryRuntime(story)
  first.useMemory(memory)
  // The same draws at every exploration, so that the map is drawn the same way each time.
  first.start(0)
  const queue: { runtime: StoryRuntime; arrivedBy: PendingOption | null }[] = [{ runtime: first, arrivedBy: null }]
  const branch = (runtime: StoryRuntime, state: RuntimeState, optionId: string, arrivedBy: PendingOption | null) => {
    const branched = new StoryRuntime(story)
    branched.useMemory({ memoryIds: [...new Set([...memory.memoryIds, ...runtime.memoryIds])], endingIds: memory.endingIds })
    branched.restoreState(state)
    branched.choose(optionId)
    stops--
    queue.push({ runtime: branched, arrivedBy })
  }
  /** An option leads where its first path went: the others are drawn from their own points. */
  const link = (arrivedBy: PendingOption | null, target: ProgressTarget) => {
    if (arrivedBy === null) {
      return
    }
    progress = {
      ...progress,
      points: progress.points.map(point => point.key !== arrivedBy.pointKey || point.taken.some(option => option.optionId === arrivedBy.optionId)
        ? point
        : { ...point, taken: [...point.taken, { optionId: arrivedBy.optionId, next: target }] }),
    }
  }

  /** Plays on to the next choice or end: pages read on, questions left to what is proposed. */
  const playOn = (runtime: StoryRuntime) => {
    for (let step = runtime.snapshot.step; stops > 0; step = runtime.snapshot.step) {
      if (step.type === 'page') {
        runtime.next()
      } else if (step.type === 'askNumber') {
        runtime.answerNumber(null)
      } else if (step.type === 'ask') {
        runtime.answer('')
      } else {
        break
      }
      stops--
    }
  }
  /** Draws a choice reached, a point of its own wherever it is reached from; returns its key. */
  const recordPoint = (state: RuntimeState, choiceId: string): string => {
    const pointKey = `${choiceId}:${JSON.stringify(state.page?.playedFrom ?? [])}`
    if (!progress.points.some(point => point.key === pointKey)) {
      progress = { ...progress, points: [...progress.points, { key: pointKey, chapterId: state.page!.chapterId, choiceId, reachedAt: EXPLORED_AT, save: toSave(story, state, EXPLORED_AT), taken: [] }] }
    }
    return pointKey
  }
  const recordEnd = (endingId: string | null, arrivedBy: PendingOption | null) => {
    if (endingId !== null && !progress.endingIds.includes(endingId)) {
      progress = { ...progress, endingIds: [...progress.endingIds, endingId] }
    }
    link(arrivedBy, { type: 'end', endingId })
  }

  for (let next = 0; next < queue.length; next++) {
    const { runtime, arrivedBy } = queue[next]!
    try {
      playOn(runtime)
    } catch {
      // A path that loops without showing anything ends here.
      continue
    }
    if (stops <= 0) {
      isWhole = false
      break
    }
    const step = runtime.snapshot.step
    if (step.type === 'end') {
      recordEnd(step.endingId, arrivedBy)
      continue
    }
    if (step.type !== 'choice') {
      isWhole = isWhole && step.type !== 'grid'
      continue
    }
    const state = runtime.exportState()
    const save = toSave(story, state, EXPLORED_AT)
    // Each state a choice is reached in, by the values that may still change what follows, once.
    const stateKey = pointKeyOf(step.choice.id, save, decisionsTestedFrom(story, step.choice.id))
    const choiceAt = `${step.choice.id}:${JSON.stringify(state.page?.playedFrom ?? [])}`
    const statesHere = statesByChoice.get(choiceAt) ?? 0
    const isNewState = !exploredStates.has(stateKey) && statesHere < STATES_PER_CHOICE
    if (!exploredStates.has(stateKey) && statesHere >= STATES_PER_CHOICE) {
      isWhole = false
    }
    if (isNewState) {
      exploredStates.add(stateKey)
      statesByChoice.set(choiceAt, statesHere + 1)
    }
    if (exploredStates.size > MAXIMUM_STATES) {
      isWhole = false
      break
    }
    if (runtime.snapshot.stage.gameMode !== null) {
      if (isNewState) {
        step.choice.options.forEach(option => branch(runtime, state, option.id, arrivedBy))
      }
      continue
    }
    const pointKey = recordPoint(state, step.choice.id)
    link(arrivedBy, { type: 'point', key: pointKey })
    if (isNewState) {
      step.choice.options.forEach(option => branch(runtime, state, option.id, { pointKey, optionId: option.id }))
    }
  }

  return { progress, isWhole }

}
