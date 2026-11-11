import { flattenStoredNodes } from '../format/storyFormat'
import type { PlayableStory } from '../runtime/playableStory'
import { makesMapPoints } from '../runtime/stageState'
import type { RuntimeState, StoryRuntime } from '../runtime/storyRuntime'
import { toSave } from '../saves/saveData'
import { findGuidedPath } from './guidedSearch'
import { branchFrom, EXPLORED_AT, playToNextStop, startedRuntime, stateKeyOf, type ExploringMemory, type StopBudget } from './playing'
import { emptyProgress, type PendingOption, type ProgressData, type ProgressPoint, type ProgressTarget } from './progress'

/** States explored at most, all choices together: past them, the broad exploration stops. */
const MAXIMUM_STATES = 5000
/**
 * States each choice is explored from at most: the values that matter ahead combine, and a story of
 * a dozen choices could be reached in thousands of ways. Every option of every choice is explored all
 * the same; what only some values open is then searched for.
 */
const STATES_PER_CHOICE = 8
/** Stops visited at most by the broad exploration, pages and choices together: a story that never ends stops being explored. */
const MAXIMUM_STOPS = 60_000
/** Stops a path found by a search may take to be drawn, played again from the start. */
const STOPS_TO_DRAW_A_PATH = 5_000
/** Searching for what the broad exploration missed stops after this long, so that the editor answers. */
const SEARCH_MILLISECONDS = 2000

/**
 * Every path of the story, as if a player had taken every option of every choice from the start: a
 * map for the author. Each choice is one point wherever it is reached from (in a scene, from each play
 * of it), holding the state of the first path to reach it, to preview from; each option leads to
 * where its first path went. Each state a choice is reached in is explored once, so that loops end,
 * a few states per choice at most: the values that matter ahead combine. Pages are read on, names and
 * numbers asked for left to what is proposed; a grid of picture buttons, a board to play rather than a
 * choice to map, ends a path. A part played as a game, `[game mode]`, makes no points: its options are
 * explored all the same, the paths out of it linked to the choice before it. A choice or an ending
 * still missing is then searched for, the paths nearest to the values that open it first, and its way
 * drawn. `isWhole` is false when some choice or ending is not on the map: past a grid, or opened by
 * values no search gathered in time.
 */
export function exploreStory(story: PlayableStory, memory: ExploringMemory = { memoryIds: [], endingIds: [] }): { progress: ProgressData; isWhole: boolean } {
  const points = new Map<string, ProgressPoint>()
  const endingIds: string[] = []
  const budget: StopBudget = { stops: MAXIMUM_STOPS }
  const exploredStates = new Set<string>()
  const statesByChoice = new Map<string, number>()
  /** Choices reached in a part played as a game: they make no points, and are no less explored. */
  const gameChoiceIds = new Set<string>()

  /** Where a choice is: the choice, and in a scene, where the scene was played from. */
  const choicePlaceOf = (state: RuntimeState, choiceId: string) => `${choiceId}:${JSON.stringify(state.page?.playedFrom ?? [])}`
  /** Draws a choice reached, a point of its own wherever it is reached from; returns its key. */
  const recordPoint = (state: RuntimeState, choiceId: string): string => {
    const pointKey = choicePlaceOf(state, choiceId)
    if (!points.has(pointKey)) {
      points.set(pointKey, { key: pointKey, chapterId: state.page!.chapterId, choiceId, reachedAt: EXPLORED_AT, save: toSave(story, state, EXPLORED_AT), taken: [] })
    }
    return pointKey
  }
  /** An option leads where its first path went: the others are drawn from their own points. */
  const link = (arrivedBy: PendingOption | null, target: ProgressTarget) => {
    const point = arrivedBy === null ? undefined : points.get(arrivedBy.pointKey)
    if (point !== undefined && !point.taken.some(option => option.optionId === arrivedBy!.optionId)) {
      point.taken = [...point.taken, { optionId: arrivedBy!.optionId, next: target }]
    }
  }
  const recordEnd = (endingId: string | null, arrivedBy: PendingOption | null) => {
    if (endingId !== null && !endingIds.includes(endingId)) {
      endingIds.push(endingId)
    }
    link(arrivedBy, { type: 'end', endingId })
  }

  const queue: ({ runtime: StoryRuntime; arrivedBy: PendingOption | null } | undefined)[] = [{ runtime: startedRuntime(story, memory), arrivedBy: null }]
  for (let next = 0; next < queue.length && budget.stops > 0; next++) {
    const { runtime, arrivedBy } = queue[next]!
    // A path played is let go of: a large story explores thousands.
    queue[next] = undefined
    try {
      playToNextStop(runtime, budget)
    } catch {
      // A path that loops without showing anything ends here.
      continue
    }
    const step = runtime.snapshot.step
    if (step.type === 'end') {
      recordEnd(step.endingId, arrivedBy)
      continue
    }
    if (step.type !== 'choice') {
      continue
    }
    const state = runtime.exportState()
    const stateKey = stateKeyOf(story, state, step.choice.id)
    const choicePlace = choicePlaceOf(state, step.choice.id)
    const statesHere = statesByChoice.get(choicePlace) ?? 0
    const isNewState = !exploredStates.has(stateKey) && statesHere < STATES_PER_CHOICE
    if (isNewState) {
      exploredStates.add(stateKey)
      statesByChoice.set(choicePlace, statesHere + 1)
    }
    if (exploredStates.size > MAXIMUM_STATES) {
      break
    }
    const branch = (optionId: string, from: PendingOption | null) => queue.push({ runtime: branchFrom(story, memory, runtime, state, optionId, budget), arrivedBy: from })
    if (!makesMapPoints(runtime.snapshot.stage)) {
      gameChoiceIds.add(step.choice.id)
      if (isNewState) {
        step.choice.options.forEach(option => branch(option.id, arrivedBy))
      }
      continue
    }
    const pointKey = recordPoint(state, step.choice.id)
    link(arrivedBy, { type: 'point', key: pointKey })
    if (isNewState) {
      step.choice.options.forEach(option => branch(option.id, { pointKey, optionId: option.id }))
    }
  }

  // What the broad exploration missed, a choice or an ending some values open, is searched for on its
  // own, the paths nearest to those values first, and its way drawn.
  const nodes = story.chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes))
  const isMissing = (node: (typeof nodes)[number]) => (node.type === 'ending' && !endingIds.includes(node.endingId))
    || (node.type === 'choice' && !gameChoiceIds.has(node.id) && ![...points.values()].some(point => point.choiceId === node.id))
  const searchEndsAt = Date.now() + SEARCH_MILLISECONDS
  for (const target of nodes) {
    if (!isMissing(target)) {
      continue
    }
    if (Date.now() > searchEndsAt) {
      break
    }
    const optionIds = findGuidedPath(story, target.id, memory)
    if (optionIds !== null) {
      drawPath(optionIds)
    }
  }
  // Whole, for the author, when every choice and every ending of the story is on the map.
  const isWhole = !nodes.some(isMissing)
  return { progress: { ...emptyProgress(story), points: [...points.values()], endingIds }, isWhole }

  /** A way found, played from the start and drawn as the exploration draws. */
  function drawPath(optionIds: readonly string[]) {
    const runtime = startedRuntime(story, memory)
    const drawing: StopBudget = { stops: STOPS_TO_DRAW_A_PATH }
    let arrivedBy: PendingOption | null = null
    for (const optionId of [...optionIds, null]) {
      playToNextStop(runtime, drawing)
      const step = runtime.snapshot.step
      if (step.type === 'end') {
        recordEnd(step.endingId, arrivedBy)
        return
      }
      if (step.type !== 'choice') {
        return
      }
      if (makesMapPoints(runtime.snapshot.stage)) {
        const pointKey = recordPoint(runtime.exportState(), step.choice.id)
        link(arrivedBy, { type: 'point', key: pointKey })
        arrivedBy = optionId === null ? null : { pointKey, optionId }
      }
      if (optionId === null) {
        return
      }
      runtime.choose(optionId)
    }
  }
}
