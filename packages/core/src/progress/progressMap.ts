import type { StoredChoice } from '../format/storyFormat'
import type { PlayableStory } from '../runtime/playableStory'
import { choicesOf, type ProgressData, type ProgressPoint, type ProgressTarget } from './progress'

/**
 * The map of what a profile has explored, laid out left to right: each point one column after the
 * furthest point leading to it, each option taken on its own lane where there is room. Options
 * not taken yet are listed on their point, without saying where they lead.
 */
export type MapNode =
  | {
    type: 'point'
    key: string
    column: number
    row: number
    point: ProgressPoint
    chapterTitle: string | null
    decisionName: string
    options: { optionId: string; text: string; next: string | null; isTaken: boolean }[]
  }
  | { type: 'end'; key: string; column: number; row: number; endingName: string | null }

export interface MapEdge {
  from: string
  optionId: string
  to: string
}

export interface ProgressMap {
  nodes: MapNode[]
  edges: MapEdge[]
  columnCount: number
  rowCount: number
  endingsReached: number
  endingsTotal: number
}

export function layOutProgressMap(progress: ProgressData, story: PlayableStory): ProgressMap {
  const choices = choicesOf(story)
  const points = [...progress.points].sort((first, second) => first.reachedAt.localeCompare(second.reachedAt))
  const targetKey = (target: ProgressTarget) => target.type === 'point' ? target.key : `end:${target.endingId ?? ''}`
  const knownKeys = new Set(points.map(point => point.key))
  const edges: MapEdge[] = points.flatMap(point => point.taken.flatMap(option =>
    option.next === null || (option.next.type === 'point' && !knownKeys.has(option.next.key)) ? [] : [{ from: point.key, optionId: option.optionId, to: targetKey(option.next) }]))
  const endKeys = [...new Set(edges.map(edge => edge.to).filter(key => key.startsWith('end:')))]

  // Depth-first from the points nobody leads to, the earliest first; edges back to a point being visited close a loop and are left out of the layering.
  const outgoing = new Map<string, MapEdge[]>()
  edges.forEach(edge => outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]))
  const hasIncoming = new Set(edges.map(edge => edge.to))
  const order: string[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const forward: MapEdge[] = []
  const visit = (key: string) => {
    state.set(key, 'visiting')
    for (const edge of outgoing.get(key) ?? []) {
      if (state.get(edge.to) !== 'visiting') {
        forward.push(edge)
      }
      if (!state.has(edge.to)) {
        visit(edge.to)
      }
    }
    state.set(key, 'done')
    order.unshift(key)
  }
  for (const key of [...points.filter(point => !hasIncoming.has(point.key)).map(point => point.key), ...points.map(point => point.key), ...endKeys]) {
    if (!state.has(key)) {
      visit(key)
    }
  }

  const columns = new Map<string, number>(order.map(key => [key, 0]))
  for (const key of order) {
    for (const edge of forward.filter(candidate => candidate.from === key)) {
      columns.set(edge.to, Math.max(columns.get(edge.to) ?? 0, (columns.get(key) ?? 0) + 1))
    }
  }

  const rows = new Map<string, number>()
  const takenRows = new Map<number, Set<number>>()
  const place = (key: string, wanted: number) => {
    const column = columns.get(key) ?? 0
    const taken = takenRows.get(column) ?? new Set<number>()
    let row = Math.max(0, wanted)
    while (taken.has(row)) {
      row++
    }
    taken.add(row)
    takenRows.set(column, taken)
    rows.set(key, row)
  }
  let nextRootRow = 0
  for (const key of [...order].sort((first, second) => (columns.get(first) ?? 0) - (columns.get(second) ?? 0))) {
    const parents = forward.filter(edge => edge.to === key && rows.has(edge.from))
    if (parents.length === 0) {
      place(key, nextRootRow)
    } else {
      const parent = parents[0]!
      const lane = (outgoing.get(parent.from) ?? []).indexOf(parent)
      place(key, (rows.get(parent.from) ?? 0) + Math.max(0, lane))
    }
    nextRootRow = Math.max(nextRootRow, (rows.get(key) ?? 0) + 1)
  }

  untangle(forward, columns, rows, points, choices)

  const chapterTitles = new Map(story.chapters.map(chapter => [chapter.id, chapter.title]))
  const nodes: MapNode[] = [
    ...points.map((point): MapNode => {
      const choice = choices.get(point.choiceId)
      const decision = story.project.decisions.find(candidate => candidate.id === choice?.decisionId)
      return {
        type: 'point',
        key: point.key,
        column: columns.get(point.key) ?? 0,
        row: rows.get(point.key) ?? 0,
        point,
        chapterTitle: chapterTitles.get(point.chapterId) ?? null,
        decisionName: decision?.name ?? '?',
        options: (choice?.options ?? []).map(option => {
          const taken = point.taken.find(candidate => candidate.optionId === option.id)
          return { optionId: option.id, text: option.text, next: taken?.next == null ? null : targetKey(taken.next), isTaken: taken !== undefined }
        }),
      }
    }),
    ...endKeys.map((key): MapNode => ({
      type: 'end',
      key,
      column: columns.get(key) ?? 0,
      row: rows.get(key) ?? 0,
      endingName: story.project.endings.find(ending => `end:${ending.id}` === key)?.name ?? null,
    })),
  ]
  return {
    nodes,
    edges,
    columnCount: Math.max(0, ...nodes.map(node => node.column + 1)),
    rowCount: Math.max(0, ...nodes.map(node => node.row + 1)),
    endingsReached: progress.endingIds.filter(endingId => story.project.endings.some(ending => ending.id === endingId)).length,
    endingsTotal: story.project.endings.length,
  }
}

/**
 * Reorders each column so that lines cross as little as they may: a point goes level with the
 * average of what leads to it, then of what it leads to, a few times over, each line leaving a point
 * in the order of its options. Each keeps the row it would have unless the order asks it to go lower,
 * so that a path with no branch stays a straight line.
 */
function untangle(forward: readonly MapEdge[], columns: ReadonlyMap<string, number>, rows: Map<string, number>, points: readonly ProgressPoint[], choices: ReadonlyMap<string, StoredChoice>) {
  const optionRank = new Map(points.flatMap(point => (choices.get(point.choiceId)?.options ?? []).map((option, rank) => [`${point.key} ${option.id}`, rank] as const)))
  const columnCount = Math.max(0, ...columns.values()) + 1
  // Each column's points, and each point's lines in and out, gathered once for every sweep.
  const grouped = <Key, Item>(items: Iterable<Item>, keyOf: (item: Item) => Key) => {
    const groups = new Map<Key, Item[]>()
    for (const item of items) {
      const group = groups.get(keyOf(item))
      if (group === undefined) {
        groups.set(keyOf(item), [item])
      } else {
        group.push(item)
      }
    }
    return groups
  }
  const keysByColumn = grouped(columns, ([, column]) => column)
  const keysIn = (column: number) => (keysByColumn.get(column) ?? []).map(([key]) => key)
  const linesInto = grouped(forward, edge => edge.to)
  const linesFrom = grouped(forward, edge => edge.from)
  const level = (keys: readonly string[], barycentre: (key: string) => number | null) => {
    const sorted = keys
      .map(key => ({ key, at: barycentre(key) ?? rows.get(key) ?? 0 }))
      .sort((first, second) => first.at - second.at || (rows.get(first.key) ?? 0) - (rows.get(second.key) ?? 0))
    let next = 0
    for (const { key, at } of sorted) {
      const row = Math.max(next, Math.floor(at))
      rows.set(key, row)
      next = row + 1
    }
  }
  const mean = (values: readonly number[]) => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
  const fromParents = (key: string) => mean((linesInto.get(key) ?? [])
    .map(edge => (rows.get(edge.from) ?? 0) + (optionRank.get(`${edge.from} ${edge.optionId}`) ?? 0) / 100))
  const fromChildren = (key: string) => mean((linesFrom.get(key) ?? []).map(edge => rows.get(edge.to) ?? 0))
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let column = 1; column < columnCount; column++) {
      level(keysIn(column), fromParents)
    }
    if (sweep < 3) {
      for (let column = columnCount - 2; column >= 0; column--) {
        level(keysIn(column), fromChildren)
      }
    }
  }
  // Back to the top, should the sweeps have left the first rows empty.
  const top = Math.min(...rows.values())
  if (Number.isFinite(top) && top > 0) {
    rows.forEach((row, key) => rows.set(key, row - top))
  }
}
