import type { StoredChoice } from '../format/storyFormat'
import type { PlayableStory } from '../runtime/playableStory'
import { withValues } from '../format/textValues'
import { stateFromSave, type SaveData } from '../saves/saveData'
import { valuesReader } from '../runtime/storyValues'
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
    /**
     * `offeredIn`, on a map explored for the author: the state of a path offering an option the
     * point's own state does not, to play it from there.
     */
    options: { optionId: string; text: string; next: string | null; isTaken: boolean; offeredIn: SaveData | null }[]
  }
  | { type: 'end'; key: string; column: number; row: number; endingName: string | null }

/**
 * A line of the map, from an option taken to where it led. `label`: where its point branches, the
 * option it follows, as `optionLabel` shortens it. `under`: the row it runs under, a point being in
 * its way on its own rows (a straight line would cross it); null when nothing is.
 */
export interface MapEdge {
  from: string
  optionId: string
  to: string
  label: string | null
  under: number | null
}

/** The longest option text a line carries; longer, it carries the option's value, cut to this length if need be. */
export const LINE_LABEL_LENGTH = 14

/** What a line says of the option it follows: its text, or its value when the text is long. */
export function optionLabel(text: string, value: string): string {
  if ([...text].length <= LINE_LABEL_LENGTH) {
    return text
  }
  const characters = [...value]
  return characters.length <= LINE_LABEL_LENGTH ? value : `${characters.slice(0, LINE_LABEL_LENGTH - 1).join('')}…`
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
    option.next === null || (option.next.type === 'point' && !knownKeys.has(option.next.key)) ? [] : [{ from: point.key, optionId: option.optionId, to: targetKey(option.next), label: null, under: null }]))
  const endKeys = [...new Set(edges.map(edge => edge.to).filter(key => key.startsWith('end:')))]

  // Depth-first from the points nobody leads to, the earliest first; edges back to a point being visited close a loop and are left out of the layering.
  const outgoing = grouped(edges, edge => edge.from)
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

  const forwardFrom = grouped(forward, edge => edge.from)
  const forwardTo = grouped(forward, edge => edge.to)
  const columns = new Map<string, number>(order.map(key => [key, 0]))
  for (const key of order) {
    for (const edge of forwardFrom.get(key) ?? []) {
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
    const parents = (forwardTo.get(key) ?? []).filter(edge => rows.has(edge.from))
    if (parents.length === 0) {
      place(key, nextRootRow)
    } else {
      const parent = parents[0]!
      const lane = (outgoing.get(parent.from) ?? []).indexOf(parent)
      place(key, (rows.get(parent.from) ?? 0) + Math.max(0, lane))
    }
    nextRootRow = Math.max(nextRootRow, (rows.get(key) ?? 0) + 1)
  }

  untangle(forwardFrom, forwardTo, columns, rows, points, choices)

  const chapterTitles = new Map(story.chapters.map(chapter => [chapter.id, chapter.title]))
  // An option shows the values its point held, as the choice did then: `Everything: 1,000.00 dollars`.
  const readValues = valuesReader(story.project)
  // Where a point branches (more than one line leaves it), each line carries the option it follows, by `<point key> <option id>`.
  const labels = new Map<string, string>()
  const nodes: MapNode[] = [
    ...points.map((point): MapNode => {
      const choice = choices.get(point.choiceId)
      const decision = story.project.decisions.find(candidate => candidate.id === choice?.decisionId)
      const valueOf = (choice?.options ?? []).some(option => option.text.includes('{')) ? readValues(stateFromSave(story, point.save)) : null
      return {
        type: 'point',
        key: point.key,
        column: columns.get(point.key) ?? 0,
        row: rows.get(point.key) ?? 0,
        point,
        chapterTitle: chapterTitles.get(point.chapterId) ?? null,
        decisionName: decision?.name ?? '?',
        options: (choice?.options ?? []).map(option => {
          const text = valueOf === null ? option.text : withValues(option.text, valueOf)
          if ((outgoing.get(point.key)?.length ?? 0) >= 2) {
            labels.set(`${point.key} ${option.id}`, optionLabel(text, decision?.values.find(value => value.id === option.valueId)?.name ?? text))
          }
          const taken = point.taken.find(candidate => candidate.optionId === option.id)
          const offeredIn = point.offeredIn?.[option.id]
          return { optionId: option.id, text, next: taken?.next == null ? null : targetKey(taken.next), isTaken: taken !== undefined, offeredIn: offeredIn === undefined || offeredIn === point.save ? null : offeredIn }
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
  const nodesByKey = new Map(nodes.map(node => [node.key, node]))
  const nodesByColumn = grouped(nodes, node => node.column)
  return {
    nodes,
    edges: edges.map(edge => ({ ...edge, label: labels.get(`${edge.from} ${edge.optionId}`) ?? null, under: rowUnder(edge, nodesByKey, nodesByColumn) })),
    columnCount: Math.max(0, ...nodes.map(node => node.column + 1)),
    rowCount: Math.max(0, ...nodes.map(node => node.row + 1)),
    endingsReached: progress.endingIds.filter(endingId => story.project.endings.some(ending => ending.id === endingId)).length,
    endingsTotal: story.project.endings.length,
  }
}

/**
 * The row a line skipping columns runs under, when a point (or end) of a column it crosses stands on
 * the rows it spans, from the one it leaves to the one it reaches: the lowest such row, so that the
 * line steps down below it, runs between the rows, where nothing stands, and comes back up.
 */
function rowUnder(edge: MapEdge, nodesByKey: ReadonlyMap<string, MapNode>, nodesByColumn: ReadonlyMap<number, readonly MapNode[]>): number | null {
  const from = nodesByKey.get(edge.from)
  const to = nodesByKey.get(edge.to)
  if (from === undefined || to === undefined || to.column <= from.column + 1) {
    return null
  }
  const top = Math.min(from.row, to.row)
  const bottom = Math.max(from.row, to.row)
  let lowest: number | null = null
  for (let column = from.column + 1; column < to.column; column++) {
    for (const node of nodesByColumn.get(column) ?? []) {
      if (node.row >= top && node.row <= bottom && (lowest === null || node.row > lowest)) {
        lowest = node.row
      }
    }
  }
  return lowest
}

/** Items in groups by a key, each group in the items' order. */
function grouped<Key, Item>(items: Iterable<Item>, keyOf: (item: Item) => Key): Map<Key, Item[]> {
  const groups = new Map<Key, Item[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [item])
    } else {
      group.push(item)
    }
  }
  return groups
}

/**
 * Reorders each column so that lines cross as little as they may: a point goes level with the
 * average of what leads to it, then of what it leads to, a few times over, each line leaving a point
 * in the order of its options. Each keeps the row it would have unless the order asks it to go lower,
 * so that a path with no branch stays a straight line.
 */
function untangle(
  linesFrom: ReadonlyMap<string, readonly MapEdge[]>,
  linesInto: ReadonlyMap<string, readonly MapEdge[]>,
  columns: ReadonlyMap<string, number>,
  rows: Map<string, number>,
  points: readonly ProgressPoint[],
  choices: ReadonlyMap<string, StoredChoice>,
) {
  const optionRank = new Map(points.flatMap(point => (choices.get(point.choiceId)?.options ?? []).map((option, rank) => [`${point.key} ${option.id}`, rank] as const)))
  const columnCount = Math.max(0, ...columns.values()) + 1
  // Each column's points, gathered once for every sweep.
  const keysByColumn = grouped(columns, ([, column]) => column)
  const keysIn = (column: number) => (keysByColumn.get(column) ?? []).map(([key]) => key)
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
