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
