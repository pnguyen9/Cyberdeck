import { flattenStoredNodes, type StoredChoice, type StoredCondition } from '../format/storyFormat'
import { chaptersInOrder, scenesOf, type PlayableStory } from '../runtime/playableStory'
import type { RuntimeState } from '../runtime/storyRuntime'
import { parseSave, toSave, type SaveData } from '../saves/saveData'

/**
 * What a profile has seen of a game over every playthrough: the choices reached, where each option
 * taken led, the endings, and the pages read. It feeds the map and skipping; the story never reads it.
 *
 * A point of the map is a choice reached with a given stage and given values of the decisions the
 * story still tests from there on. Two paths reaching the same choice that agree on those merge
 * into one point; otherwise they stay apart, so that characters react the same way to everything
 * ahead whichever path is resumed from the point.
 */
export interface ProgressData {
  progressFormat: 1
  game: { id: string; name: string }
  points: ProgressPoint[]
  /** Named endings reached, by identifier. */
  endingIds: string[]
  /** What the profile remembers, by identifier: `[remember]` reached in any playthrough. */
  memoryIds: string[]
  /** Pages shown at least once, for skipping text already read. */
  readPageIds: string[]
  /** Illustrations seen in any playthrough, for the gallery. */
  illustrationIds: string[]
}

export interface ProgressPoint {
  key: string
  chapterId: string
  choiceId: string
  reachedAt: string
  /** The state when the choice was reached, as a save holds it: playing from the point loads it. */
  save: SaveData
  /** Options picked here, with what they led to once known. */
  taken: { optionId: string; next: ProgressTarget | null }[]
}

/** Where an option led: the next choice reached, or an end of the story (`endingId` null for the plain end). */
export type ProgressTarget = { type: 'point'; key: string } | { type: 'end'; endingId: string | null }

/** The option just picked, waiting to learn where it leads. */
export interface PendingOption {
  pointKey: string
  optionId: string
}

export function emptyProgress(story: PlayableStory): ProgressData {
  return { progressFormat: 1, game: { id: story.project.id, name: story.project.name }, points: [], endingIds: [], memoryIds: [], readPageIds: [], illustrationIds: [] }
}

/** Adds what the profile now remembers; unchanged progress is returned as is. */
export function recordIllustrationSeen(progress: ProgressData, illustrationId: string | null): ProgressData {
  return illustrationId === null || progress.illustrationIds.includes(illustrationId) ? progress : { ...progress, illustrationIds: [...progress.illustrationIds, illustrationId] }
}

export function recordMemories(progress: ProgressData, memoryIds: readonly string[]): ProgressData {
  const added = memoryIds.filter(memoryId => !progress.memoryIds.includes(memoryId))
  return added.length === 0 ? progress : { ...progress, memoryIds: [...progress.memoryIds, ...added] }
}

/** Unchanged progress is returned as is, so that callers can skip writing it. */
export function recordPageRead(progress: ProgressData, pageId: string): ProgressData {
  return progress.readPageIds.includes(pageId) ? progress : { ...progress, readPageIds: [...progress.readPageIds, pageId] }
}

/** Records the choice shown in `state`, and the option that led to it; returns the point's key. */
export function recordChoiceReached(
  progress: ProgressData,
  story: PlayableStory,
  state: RuntimeState,
  arrivedBy: PendingOption | null,
  now: string,
): { progress: ProgressData; pointKey: string } {
  if (state.page === null) {
    throw new Error('No choice is shown')
  }
  const save = toSave(story, state, now)
  const pointKey = pointKeyOf(state.page.nodeId, save, decisionsTestedFrom(story, state.page.nodeId))
  const points = progress.points.some(point => point.key === pointKey)
    ? progress.points
    : [...progress.points, { key: pointKey, chapterId: state.page.chapterId, choiceId: state.page.nodeId, reachedAt: now, save, taken: [] }]
  return { progress: linkOption({ ...progress, points }, arrivedBy, { type: 'point', key: pointKey }), pointKey }
}

export function recordEndReached(progress: ProgressData, endingId: string | null, arrivedBy: PendingOption | null): ProgressData {
  const endingIds = endingId === null || progress.endingIds.includes(endingId) ? progress.endingIds : [...progress.endingIds, endingId]
  return linkOption({ ...progress, endingIds }, arrivedBy, { type: 'end', endingId })
}

/**
 * The key of a point: its choice, stage and the decisions that matter ahead, whatever the order
 * they were written in, and for a choice in a scene, where the scene was played from.
 */
export function pointKeyOf(choiceId: string, save: SaveData, decisionsThatMatter: ReadonlySet<string>): string {
  const decisions = Object.keys(save.decisions).filter(name => decisionsThatMatter.has(name)).sort()
    .map(name => [name, [...(save.decisions[name] ?? [])].sort()])
  const characters = [...save.stage.characters].sort((first, second) => first.name.localeCompare(second.name))
  const playedFrom = save.page?.playedFrom ?? []
  const { background, music, cover, tint, text, illustration } = save.stage
  return `${choiceId}:${fingerprint(JSON.stringify({ decisions, background, music, characters, cover, tint, text, illustration, playedFrom }))}`
}

const testedDecisionsByStory = new WeakMap<PlayableStory, Map<string, ReadonlySet<string>>>()

/**
 * Names of the decisions that conditions test from a choice on, in reading order, those deciding
 * which of its options are offered included, those of every scene, which may be played ahead, and
 * those deciding which chapters are played.
 * A loop around the choice, or a scene holding it, may test anything again: every decision tested
 * in the story then counts.
 */
export function decisionsTestedFrom(story: PlayableStory, choiceId: string): ReadonlySet<string> {
  const cache = testedDecisionsByStory.get(story) ?? new Map<string, ReadonlySet<string>>()
  testedDecisionsByStory.set(story, cache)
  const cached = cache.get(choiceId)
  if (cached !== undefined) {
    return cached
  }
  const nodes = chaptersInOrder(story).flatMap(chapter => flattenStoredNodes(chapter.nodes))
  const sceneNodes = [...scenesOf(story).values()].flatMap(scene => flattenStoredNodes(scene.nodes))
  const choiceIndex = nodes.findIndex(node => node.id === choiceId)
  const isInLoop = nodes.some(node => node.type === 'loop' && flattenStoredNodes(node.nodes).some(inner => inner.id === choiceId))
  const ahead = choiceIndex === -1 || isInLoop ? nodes : nodes.slice(choiceIndex)
  const chapterConditionIds = chaptersInOrder(story).flatMap(chapter => chapter.condition === undefined ? [] : decisionIdsIn(chapter.condition))
  const testedIds = [...chapterConditionIds, ...[...ahead, ...sceneNodes].flatMap(node => node.type === 'condition'
    ? node.branches.flatMap(branch => branch.condition === null ? [] : decisionIdsIn(branch.condition))
    : node.type === 'choice' ? node.options.flatMap(option => option.condition === null ? [] : decisionIdsIn(option.condition)) : [])]
  const names = new Set(story.project.decisions.filter(decision => testedIds.includes(decision.id)).map(decision => decision.name))
  cache.set(choiceId, names)
  return names
}

function decisionIdsIn(condition: StoredCondition): string[] {
  switch (condition.type) {
    case 'is':
      return [condition.decisionId]
    case 'remembered':
    case 'endingSeen':
      return []
    case 'and':
    case 'or':
      return condition.conditions.flatMap(decisionIdsIn)
  }
}

/** The choices of the story by identifier, for showing their options on the map. */
export function choicesOf(story: PlayableStory): Map<string, StoredChoice> {
  // Scenes included: a choice made in one is a point of the map too.
  return new Map(story.chapters
    .flatMap(chapter => flattenStoredNodes(chapter.nodes))
    .flatMap(node => node.type === 'choice' ? [[node.id, node] as const] : []))
}

/** Checks progress read back from a file; unreadable parts are dropped rather than failing the game. */
export function parseProgress(value: unknown): ProgressData | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const fields = value as Record<string, unknown>
  const game = fields.game as Record<string, unknown> | undefined
  if (fields.progressFormat !== 1 || typeof game?.id !== 'string' || typeof game.name !== 'string') {
    return null
  }
  const strings = (list: unknown) => Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []
  const points = (Array.isArray(fields.points) ? fields.points : []).flatMap((point: unknown): ProgressPoint[] => {
    const pointFields = typeof point === 'object' && point !== null ? point as Record<string, unknown> : {}
    const save = parseSave(pointFields.save)
    const { key, chapterId, choiceId, reachedAt } = pointFields
    if (save === null || typeof key !== 'string' || typeof chapterId !== 'string' || typeof choiceId !== 'string' || typeof reachedAt !== 'string') {
      return []
    }
    const taken = (Array.isArray(pointFields.taken) ? pointFields.taken : []).flatMap((option: unknown) => {
      const optionFields = typeof option === 'object' && option !== null ? option as Record<string, unknown> : {}
      return typeof optionFields.optionId === 'string' ? [{ optionId: optionFields.optionId, next: parseTarget(optionFields.next) }] : []
    })
    return [{ key, chapterId, choiceId, reachedAt, save, taken }]
  })
  return { progressFormat: 1, game: { id: game.id, name: game.name }, points, endingIds: strings(fields.endingIds), memoryIds: strings(fields.memoryIds), readPageIds: strings(fields.readPageIds), illustrationIds: strings(fields.illustrationIds) }
}

function parseTarget(value: unknown): ProgressTarget | null {
  const fields = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  if (fields.type === 'point' && typeof fields.key === 'string') {
    return { type: 'point', key: fields.key }
  }
  if (fields.type === 'end' && (fields.endingId === null || typeof fields.endingId === 'string')) {
    return { type: 'end', endingId: fields.endingId }
  }
  return null
}

function linkOption(progress: ProgressData, arrivedBy: PendingOption | null, target: ProgressTarget): ProgressData {
  if (arrivedBy === null) {
    return progress
  }
  return {
    ...progress,
    points: progress.points.map(point => point.key !== arrivedBy.pointKey ? point : {
      ...point,
      taken: [...point.taken.filter(option => option.optionId !== arrivedBy.optionId), { optionId: arrivedBy.optionId, next: target }],
    }),
  }
}

/** FNV-1a, twice with different seeds: 64 bits, so that distinct states never share a key in practice. */
function fingerprint(text: string): string {
  const hash = (seed: number) => {
    let value = seed
    for (const character of text) {
      value = Math.imul(value ^ character.codePointAt(0)!, 0x01000193) >>> 0
    }
    return value.toString(16).padStart(8, '0')
  }
  return `${hash(0x811c9dc5)}${hash(0x050c5d1f)}`
}
