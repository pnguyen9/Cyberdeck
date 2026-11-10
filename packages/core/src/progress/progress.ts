import { flattenStoredNodes, innerListsOf, testedIdsIn, type StoredChoice, type StoredNode } from '../format/storyFormat'
import { chaptersInOrder, scenesOf, type PlayableStory } from '../runtime/playableStory'
import type { LastingValues, RuntimeState } from '../runtime/storyRuntime'
import { parseSave, toSave, type SaveData } from '../saves/saveData'

/**
 * What a profile has seen of a game over every playthrough: the choices reached, where each option
 * taken led, the endings, and the pages read. It feeds the map and skipping; the story never reads it.
 *
 * A point of the map is a choice reached with a given stage and given values of the decisions and
 * counters the story still tests from there on. Two paths reaching the same choice that agree on those merge
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
  /** What the decisions and counters declared `lasting` held when the profile last played. Since 2.0. */
  lasting?: LastingValues
  /** The language the profile plays a game of several languages in. Since 2.0. */
  language?: string
  /** When the profile last played the game, refreshed as it plays: what `time away` counts from. Since 2.1. */
  lastPlayedAt?: string
}

/** How long ago the profile last played, in minutes; 0 the first time. */
export function minutesAway(progress: ProgressData, now: Date): number {
  const last = progress.lastPlayedAt === undefined ? Number.NaN : Date.parse(progress.lastPlayedAt)
  return Number.isNaN(last) ? 0 : Math.max(0, Math.floor((now.getTime() - last) / 60_000))
}

/** Notes that the profile plays now; refreshed at most once a minute, so that playing writes no more for it. */
export function recordPlaying(progress: ProgressData, now: Date): ProgressData {
  return minutesAway(progress, now) < 1 && progress.lastPlayedAt !== undefined ? progress : { ...progress, lastPlayedAt: now.toISOString() }
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
  return emptyProgressOf({ id: story.project.id, name: story.project.name })
}

/** The progress of a game nothing was played of yet. */
export function emptyProgressOf(game: { id: string; name: string }): ProgressData {
  return { progressFormat: 1, game, points: [], endingIds: [], memoryIds: [], readPageIds: [], illustrationIds: [] }
}

/** Adds an illustration seen; unchanged progress is returned as is. */
export function recordIllustrationSeen(progress: ProgressData, illustrationId: string | null): ProgressData {
  return illustrationId === null || progress.illustrationIds.includes(illustrationId) ? progress : { ...progress, illustrationIds: [...progress.illustrationIds, illustrationId] }
}

/** Keeps what the lasting decisions and counters hold now; a story with none keeps nothing. */
export function recordLasting(progress: ProgressData, values: LastingValues): ProgressData {
  const isEmpty = Object.keys(values.decisions).length === 0 && Object.keys(values.counters).length === 0
  if (isEmpty && progress.lasting === undefined) {
    return progress
  }
  return progress.lasting !== undefined && sameLastingValues(progress.lasting, values) ? progress : { ...progress, lasting: values }
}

function sameLastingValues(first: LastingValues, second: LastingValues): boolean {
  const same = <Value>(left: Readonly<Record<string, Value>>, right: Readonly<Record<string, Value>>, equal: (one: Value, other: Value) => boolean) =>
    Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => Object.hasOwn(right, key) && equal(value, right[key]!))
  return same(first.counters, second.counters, (one, other) => one === other)
    && same(first.decisions, second.decisions, (one, other) => one.length === other.length && one.every((value, index) => value === other[index]))
}

/** Adds what the profile now remembers, and takes away what it forgot; unchanged progress is returned as is. */
export function recordMemories(progress: ProgressData, memoryIds: readonly string[], forgottenIds: readonly string[] = []): ProgressData {
  const kept = progress.memoryIds.filter(memoryId => !forgottenIds.includes(memoryId))
  const added = memoryIds.filter(memoryId => !kept.includes(memoryId) && !forgottenIds.includes(memoryId))
  return added.length === 0 && kept.length === progress.memoryIds.length ? progress : { ...progress, memoryIds: [...kept, ...added] }
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
 * The key of a point: its choice, stage and the decisions and counters that matter ahead, whatever
 * the order they were written in, and for a choice in a scene, where the scene was played from.
 * Counters count only when some matter: points of stories without them keep the keys they had.
 */
export function pointKeyOf(choiceId: string, save: SaveData, namesThatMatter: ReadonlySet<string>): string {
  const decisions = Object.keys(save.decisions).filter(name => namesThatMatter.has(name)).sort()
    .map(name => [name, [...(save.decisions[name] ?? [])].sort()])
  const counters = Object.keys(save.counters ?? {}).filter(name => namesThatMatter.has(name)).sort()
    .map(name => [name, save.counters?.[name]])
  const characters = [...save.stage.characters].sort((first, second) => first.name.localeCompare(second.name))
  const playedFrom = save.page?.playedFrom ?? []
  const { background, music, cover, tint, text, illustration } = save.stage
  return `${choiceId}:${fingerprint(JSON.stringify({ decisions, ...(counters.length === 0 ? {} : { counters }), background, music, characters, cover, tint, text, illustration, playedFrom }))}`
}

const testedDecisionsByStory = new WeakMap<PlayableStory, Map<string, ReadonlySet<string>>>()

/** A test of a decision or counter, and where the value it reads was last given along the way to it. */
interface ValueRead {
  id: string
  /** The chapters, read in order, are one sequence; each scene is one of its own. */
  sequence: string
  /** Positions in the sequence, in reading order. */
  at: number
  /** Where the story last gave it a new value before the test, on every way there; null when it may come from anywhere before. */
  lastSetAt: number | null
}

const valueReadsByStory = new WeakMap<PlayableStory, readonly ValueRead[]>()

/**
 * Every test of the story, with where its value was last given on the way to it: a counter drawn
 * just before each test of it, a decision set or chosen right before. Read along the story's lists,
 * a branch starting from what its block had given; a loop's body runs at least once, so what it gives
 * before anything that may leave it holds after it; a scene starts from nothing given.
 */
function valueReads(story: PlayableStory): readonly ValueRead[] {
  const known = valueReadsByStory.get(story)
  if (known !== undefined) {
    return known
  }
  const singleDecisionIds = new Set(story.project.decisions.filter(decision => !decision.multiple).map(decision => decision.id))
  const reads: ValueRead[] = []
  const leavesLoop = (node: StoredNode): boolean => node.type === 'break' || node.type === 'ending' || innerListsOf(node).some(list => list.nodes.some(leavesLoop))
  const readSequence = (sequence: string, documents: readonly { nodes: StoredNode[] }[]) => {
    const positions = new Map(documents.flatMap(document => flattenStoredNodes(document.nodes)).map((node, index) => [node.id, index]))
    const read = (ids: readonly string[], node: StoredNode, given: ReadonlyMap<string, number>) => {
      for (const id of ids) {
        reads.push({ id, sequence, at: positions.get(node.id) ?? 0, lastSetAt: given.get(id) ?? null })
      }
    }
    /** Walks a list, knowing where each value was last given; returns that as the list ends. */
    const walk = (nodes: readonly StoredNode[], givenAtStart: ReadonlyMap<string, number>): Map<string, number> => {
      const given = new Map(givenAtStart)
      const give = (id: string, node: StoredNode) => given.set(id, positions.get(node.id) ?? 0)
      for (const node of nodes) {
        switch (node.type) {
          case 'count':
            if (node.operation === 'add') {
              read([node.counterId], node, given)
            } else {
              give(node.counterId, node)
            }
            break
          case 'askNumber':
            give(node.counterId, node)
            break
          case 'copy':
            read([node.fromDecisionId], node, given)
            if (singleDecisionIds.has(node.decisionId)) {
              give(node.decisionId, node)
            }
            break
          case 'draw':
            if (node.notInDecisionId !== null) {
              read([node.notInDecisionId], node, given)
            }
            if (singleDecisionIds.has(node.decisionId)) {
              give(node.decisionId, node)
            }
            break
          case 'set':
            if (singleDecisionIds.has(node.decisionId)) {
              give(node.decisionId, node)
            }
            break
          case 'choice':
            node.options.forEach(option => option.condition !== null && read(testedIdsIn(option.condition), node, given))
            if (singleDecisionIds.has(node.decisionId)) {
              give(node.decisionId, node)
            }
            break
          case 'condition':
            node.branches.forEach(branch => branch.condition !== null && read(testedIdsIn(branch.condition), node, given))
            node.branches.forEach(branch => walk(branch.nodes, given))
            break
          case 'loop': {
            walk(node.nodes, given)
            const beforeLeaving = node.nodes.findIndex(leavesLoop)
            walk(beforeLeaving === -1 ? node.nodes : node.nodes.slice(0, beforeLeaving), given).forEach((at, id) => given.set(id, at))
            break
          }
          default:
            break
        }
      }
      return given
    }
    documents.forEach(document => walk(document.nodes, new Map()))
  }
  const chapters = chaptersInOrder(story)
  readSequence('chapters', chapters)
  for (const chapter of chapters) {
    if (chapter.condition !== undefined) {
      testedIdsIn(chapter.condition).forEach(id => reads.push({ id, sequence: 'chapters', at: 0, lastSetAt: null }))
    }
  }
  for (const [sceneId, scene] of scenesOf(story)) {
    readSequence(sceneId, [scene])
  }
  valueReadsByStory.set(story, reads)
  return reads
}

/**
 * Names of the decisions and counters whose value at a choice may still change what follows: tested
 * ahead (to offer options, choose branches, play chapters, in the scenes, which may be played ahead)
 * before the story gives them a new value after the choice. A loop around the choice may test anything
 * again: every name tested then counts.
 */
export function decisionsTestedFrom(story: PlayableStory, choiceId: string): ReadonlySet<string> {
  const cache = testedDecisionsByStory.get(story) ?? new Map<string, ReadonlySet<string>>()
  testedDecisionsByStory.set(story, cache)
  const cached = cache.get(choiceId)
  if (cached !== undefined) {
    return cached
  }
  const chapterNodes = chaptersInOrder(story).flatMap(chapter => flattenStoredNodes(chapter.nodes))
  const scenes = [...scenesOf(story)]
  const sceneOfChoice = scenes.find(([, scene]) => flattenStoredNodes(scene.nodes).some(node => node.id === choiceId))
  const sequence = sceneOfChoice?.[0] ?? 'chapters'
  const sequenceNodes = sceneOfChoice === undefined ? chapterNodes : flattenStoredNodes(sceneOfChoice[1].nodes)
  const choiceAt = sequenceNodes.findIndex(node => node.id === choiceId)
  // The outermost loop around the choice, by the positions it spans: its body comes round again.
  const loop = sequenceNodes.flatMap((node, at) => node.type === 'loop' && flattenStoredNodes(node.nodes).some(inner => inner.id === choiceId)
    ? [{ start: at, end: at + flattenStoredNodes(node.nodes).length }]
    : [])[0] ?? null
  // A test ahead finds what the paths to the choice left, unless the story gives it a new value after
  // the choice, on the way to the test. Every scene may be played ahead, and the chapters after a
  // scene's choice too, but a test there whose value is given on the way to it never finds what came before.
  const matters = (read: ValueRead) => {
    if (read.sequence !== sequence) {
      return read.lastSetAt === null
    }
    if (choiceAt === -1) {
      return true
    }
    if (read.at > choiceAt) {
      return read.lastSetAt === null || read.lastSetAt < choiceAt
    }
    // Before the choice, a test is only ahead on the loop's next round: the value counts unless the
    // loop gives it again, on that round, before the test.
    return loop !== null && read.at >= loop.start && read.at <= loop.end
      && !(read.lastSetAt !== null && read.lastSetAt > loop.start && read.lastSetAt < read.at)
  }
  const testedIds = new Set(valueReads(story).filter(matters).map(read => read.id))
  // The clock's counters change by themselves: a point of the map is the same whatever the hour.
  const names = new Set([...story.project.decisions, ...story.project.counters.filter(counter => counter.clock === undefined)]
    .filter(named => testedIds.has(named.id)).map(named => named.name))
  cache.set(choiceId, names)
  return names
}

/** The choices of the story by identifier, for showing their options on the map. */
export function choicesOf(story: PlayableStory): Map<string, StoredChoice> {
  // Scenes included: a choice made in one is a point of the map too.
  return new Map(story.chapters
    .flatMap(chapter => flattenStoredNodes(chapter.nodes))
    .flatMap(node => node.type === 'choice' ? [[node.id, node] as const] : []))
}

/**
 * Progress brought from elsewhere (another computer, another build) joined to the profile's: what
 * either reached is reached, each point's options taken together. The values that last and the
 * language are the brought ones', the player carrying on from where they played last.
 */
export function mergeProgress(own: ProgressData, brought: ProgressData): ProgressData {
  const union = (first: readonly string[], second: readonly string[]) => [...new Set([...first, ...second])]
  const points = new Map(own.points.map(point => [point.key, point]))
  for (const point of brought.points) {
    const known = points.get(point.key)
    if (known === undefined) {
      points.set(point.key, point)
      continue
    }
    const taken = new Map(known.taken.map(option => [option.optionId, option]))
    for (const option of point.taken) {
      // An option whose outcome one of them learned keeps it.
      if (taken.get(option.optionId)?.next == null) {
        taken.set(option.optionId, option)
      }
    }
    points.set(point.key, { ...known, taken: [...taken.values()] })
  }
  return {
    ...own,
    points: [...points.values()],
    endingIds: union(own.endingIds, brought.endingIds),
    memoryIds: union(own.memoryIds, brought.memoryIds),
    readPageIds: union(own.readPageIds, brought.readPageIds),
    illustrationIds: union(own.illustrationIds, brought.illustrationIds),
    ...(brought.lasting === undefined ? {} : { lasting: brought.lasting }),
    ...(brought.language === undefined ? {} : { language: brought.language }),
    ...(brought.lastPlayedAt === undefined ? {} : { lastPlayedAt: brought.lastPlayedAt }),
  }
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
  const lasting = parseLasting(fields.lasting)
  const language = typeof fields.language === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/.test(fields.language) ? fields.language : null
  const lastPlayedAt = typeof fields.lastPlayedAt === 'string' && !Number.isNaN(Date.parse(fields.lastPlayedAt)) ? fields.lastPlayedAt : null
  return { progressFormat: 1, game: { id: game.id, name: game.name }, points, endingIds: strings(fields.endingIds), memoryIds: strings(fields.memoryIds), readPageIds: strings(fields.readPageIds), illustrationIds: strings(fields.illustrationIds), ...(lasting === null ? {} : { lasting }), ...(language === null ? {} : { language }), ...(lastPlayedAt === null ? {} : { lastPlayedAt }) }
}

/** Lasting values as a progress file holds them, every field checked: anything else is left out. */
function parseLasting(value: unknown): LastingValues | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const fields = value as Record<string, unknown>
  const entries = (record: unknown) => typeof record === 'object' && record !== null && !Array.isArray(record) ? Object.entries(record) : []
  return {
    decisions: Object.fromEntries(entries(fields.decisions).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(item => typeof item === 'string'))),
    counters: Object.fromEntries(entries(fields.counters).filter((entry): entry is [string, number] => Number.isSafeInteger(entry[1]))),
  }
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
