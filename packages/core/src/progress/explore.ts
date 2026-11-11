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
 * A choice asked again on the same path, by a loop (a second stop of the afternoon), starts a new
 * round: it and every choice after it in the same chapter, the scenes it plays included, are points
 * of their own, up to this many rounds; past them, the last round leads back to itself.
 */
const MAXIMUM_ROUNDS = 3

/** How many times each choice place was reached on a path so far, and the chapter or play it is in. */
type Repeats = ReadonlyMap<string, { times: number; scope: string }>

/**
 * Every path of the story, as if a player had taken every option of every choice from the start: a
 * map for the author. Each choice is one point wherever it is reached from (in a scene, from each play
 * of it, and asked again by a loop, each time), holding the state of the first path to reach it, to
 * preview from, and for each option the state of a path that offered it; each option leads to every
 * place its paths went. Each state a choice is reached in is explored once, so that loops end,
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
  /** The chapter each `[play]` is written in: a scene's choices count in the chapter that played it. */
  const chapterOfPlay = new Map(story.chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes).flatMap(node => node.type === 'play' ? [[node.id, chapter.id] as const] : [])))
  /**
   * Where a choice is on a path: its place, and the round of its chapter, the most times a choice of
   * that chapter, or of a scene it played, was reached on the path.
   */
  const reached = (state: RuntimeState, choiceId: string, repeats: Repeats) => {
    const place = choicePlaceOf(state, choiceId)
    const outermostPlay = state.page?.playedFrom?.[0]
    const scope = (outermostPlay === undefined ? undefined : chapterOfPlay.get(outermostPlay)) ?? state.page?.chapterId ?? ''
    const times = Math.min((repeats.get(place)?.times ?? 0) + 1, MAXIMUM_ROUNDS)
    const next = new Map(repeats).set(place, { times, scope })
    const round = Math.max(...[...next.values()].filter(entry => entry.scope === scope).map(entry => entry.times))
    return { pointKey: `${place}#${round}`, repeats: next }
  }
  /** Draws a choice reached, with the options it offers in this state. */
  const recordPoint = (state: RuntimeState, choiceId: string, pointKey: string, offered: readonly { id: string }[]) => {
    let point = points.get(pointKey)
    if (point === undefined) {
      point = { key: pointKey, chapterId: state.page!.chapterId, choiceId, reachedAt: EXPLORED_AT, save: toSave(story, state, EXPLORED_AT), taken: [], offeredIn: {} }
      points.set(pointKey, point)
    }
    const offeredIn = point.offeredIn ?? {}
    const newlyOffered = offered.filter(option => !Object.hasOwn(offeredIn, option.id))
    if (newlyOffered.length > 0) {
      const save = Object.keys(offeredIn).length === 0 ? point.save : toSave(story, state, EXPLORED_AT)
      point.offeredIn = { ...offeredIn, ...Object.fromEntries(newlyOffered.map(option => [option.id, save])) }
    }
  }
  /**
   * An option leads to each place its paths went: by the values gathered before, the same option may
   * lead to a scene's choice on one path and to the next chapter on another.
   */
  const link = (arrivedBy: PendingOption | null, target: ProgressTarget) => {
    const point = arrivedBy === null ? undefined : points.get(arrivedBy.pointKey)
    const leadsThere = (next: ProgressTarget | null) => next !== null && (next.type === 'point' ? target.type === 'point' && next.key === target.key : target.type === 'end' && next.endingId === target.endingId)
    if (point !== undefined && !point.taken.some(option => option.optionId === arrivedBy!.optionId && leadsThere(option.next))) {
      point.taken = [...point.taken, { optionId: arrivedBy!.optionId, next: target }]
    }
  }
  const recordEnd = (endingId: string | null, arrivedBy: PendingOption | null) => {
    if (endingId !== null && !endingIds.includes(endingId)) {
      endingIds.push(endingId)
    }
    link(arrivedBy, { type: 'end', endingId })
  }

  const queue: ({ runtime: StoryRuntime; arrivedBy: PendingOption | null; repeats: Repeats } | undefined)[] = [{ runtime: startedRuntime(story, memory), arrivedBy: null, repeats: new Map() }]
  for (let next = 0; next < queue.length && budget.stops > 0; next++) {
    const { runtime, arrivedBy, repeats } = queue[next]!
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
    const here = reached(state, step.choice.id, repeats)
    const stateKey = `${here.pointKey} ${stateKeyOf(story, state, step.choice.id)}`
    const statesHere = statesByChoice.get(here.pointKey) ?? 0
    const isNewState = !exploredStates.has(stateKey) && statesHere < STATES_PER_CHOICE
    if (isNewState) {
      exploredStates.add(stateKey)
      statesByChoice.set(here.pointKey, statesHere + 1)
    }
    if (exploredStates.size > MAXIMUM_STATES) {
      break
    }
    const branch = (optionId: string, from: PendingOption | null) => queue.push({ runtime: branchFrom(story, memory, runtime, state, optionId, budget), arrivedBy: from, repeats: here.repeats })
    if (!makesMapPoints(runtime.snapshot.stage)) {
      gameChoiceIds.add(step.choice.id)
      if (isNewState) {
        step.choice.options.forEach(option => branch(option.id, arrivedBy))
      }
      continue
    }
    const pointKey = here.pointKey
    recordPoint(state, step.choice.id, pointKey, step.choice.options)
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
    let repeats: Repeats = new Map()
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
        const state = runtime.exportState()
        const here = reached(state, step.choice.id, repeats)
        const pointKey = here.pointKey
        repeats = here.repeats
        recordPoint(state, step.choice.id, pointKey, step.choice.options)
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
