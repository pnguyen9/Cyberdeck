import { describeCondition, type ChapterDocument, type ProjectDocument, type StoredNode, type StoredPage, type StoryWords } from '@cyberdeck/core'

/**
 * The whole story as a map, laid out by itself: chapters one under the other, each block forking into
 * its branches side by side and joining again under them, loops as frames with their way back, endings
 * where routes stop, scenes in a column apart, linked to each play that calls them.
 */

export type GraphBoxKind = 'chapter' | 'scene' | 'pages' | 'choice' | 'fork' | 'branch' | 'loop' | 'ending' | 'play' | 'break' | 'join'

export interface GraphBox {
  id: string
  kind: GraphBoxKind
  x: number
  y: number
  width: number
  height: number
  label: string
  lines: string[]
  /** What a click opens: the document, and the node in it (null for the document itself). */
  documentId: string
  nodeId: string | null
  /** For a fork's branch: the block and the branch, which may be moved. */
  conditionId?: string
  branchId?: string
  /** For a branch: whether it is the block's [else], which stays last. */
  isElse?: boolean
}

export interface GraphEdge {
  /** Points of a line drawn through them, in order. */
  points: { x: number; y: number }[]
  kind: 'flow' | 'back' | 'play'
}

export interface StoryGraph {
  boxes: GraphBox[]
  edges: GraphEdge[]
  width: number
  height: number
}

export interface GraphWords extends Pick<StoryWords, 'untitledChapter' | 'scene' | 'loop' | 'outOfTheLoop'> {
  pages: (count: number) => string
  onlyIf: (condition: string) => string
  otherwise: string
  elseIf: (condition: string) => string
  ifCondition: (condition: string) => string
  choice: (decision: string) => string
}

const BOX_WIDTH = 240
const LINE_HEIGHT = 18
const GAP = 26
const COLUMN_GAP = 34
const PADDING = 16
const MAXIMUM_OPTIONS_SHOWN = 4

/** A part of the map laid out at its own origin: where flows come in at its top and leave at its bottom. */
interface Block {
  width: number
  height: number
  boxes: GraphBox[]
  edges: GraphEdge[]
  /** The x of the flow in and out, relative to the block. */
  centre: number
  /** Whether every way through ends inside: nothing goes on under it. */
  stops: boolean
  /** Plays inside, for the lines to their scenes. */
  plays: { boxId: string; sceneId: string }[]
}

function shifted(block: Block, dx: number, dy: number): Block {
  return {
    ...block,
    boxes: block.boxes.map(box => ({ ...box, x: box.x + dx, y: box.y + dy })),
    edges: block.edges.map(edge => ({ ...edge, points: edge.points.map(point => ({ x: point.x + dx, y: point.y + dy })) })),
  }
}

function single(box: Omit<GraphBox, 'x' | 'y' | 'width' | 'height'> & { height?: number }, stops = false): Block {
  const height = box.height ?? PADDING + LINE_HEIGHT * (1 + box.lines.length)
  return { width: BOX_WIDTH, height, boxes: [{ ...box, x: 0, y: 0, width: BOX_WIDTH, height }], edges: [], centre: BOX_WIDTH / 2, stops, plays: [] }
}

/** Blocks one under the other, centred, the flow drawn from each to the next unless one stops it. */
function stack(blocks: readonly Block[]): Block {
  const width = Math.max(BOX_WIDTH, ...blocks.map(block => block.width))
  const centre = width / 2
  const result: Block = { width, height: 0, boxes: [], edges: [], centre, stops: false, plays: [] }
  let previousBottom: number | null = null
  for (const block of blocks) {
    const placed = shifted(block, centre - block.centre, result.height)
    if (previousBottom !== null && !result.stops) {
      result.edges.push({ kind: 'flow', points: [{ x: centre, y: previousBottom }, { x: centre, y: result.height }] })
    }
    result.boxes.push(...placed.boxes)
    result.edges.push(...placed.edges)
    result.plays.push(...placed.plays)
    result.height += block.height
    previousBottom = result.height
    result.height += GAP
    result.stops ||= block.stops
  }
  result.height = Math.max(0, result.height - GAP)
  return result
}

const shortText = (text: string, length = 34) => text.length > length ? `${text.slice(0, length - 1)}…` : text

/** What every part of the layout reads: the project, its names found by identifier, and the words to show. */
interface Layout {
  project: ProjectDocument
  decisionNames: ReadonlyMap<string, string>
  endingNames: ReadonlyMap<string, string>
  words: GraphWords
}

function layoutNodes(nodes: readonly StoredNode[], documentId: string, layout: Layout): Block {
  const { words } = layout
  const blocks: Block[] = []
  let run: StoredNode[] = []
  const flushRun = () => {
    const pages = run.filter((node): node is StoredPage => node.type === 'page')
    const first = pages[0]
    if (first !== undefined) {
      blocks.push(single({ id: `${documentId}/${first.id}`, kind: 'pages', label: words.pages(pages.length), lines: [shortText(first.text)], documentId, nodeId: first.id }))
    }
    run = []
  }
  for (const node of nodes) {
    switch (node.type) {
      case 'page':
      case 'stage':
      case 'set':
      case 'unset':
      case 'count':
      case 'ask':
      case 'askNumber':
      case 'remember':
      case 'definition':
        run.push(node)
        break
      case 'choice': {
        flushRun()
        const shown = node.options.filter(option => option.timeout !== true).map(option => `› ${shortText(option.text, 30)}`)
        const lines = shown.length > MAXIMUM_OPTIONS_SHOWN ? [...shown.slice(0, MAXIMUM_OPTIONS_SHOWN), '…'] : shown
        blocks.push(single({ id: `${documentId}/${node.id}`, kind: 'choice', label: words.choice(layout.decisionNames.get(node.decisionId) ?? '?'), lines, documentId, nodeId: node.id }))
        break
      }
      case 'ending':
        flushRun()
        blocks.push(single({ id: `${documentId}/${node.id}`, kind: 'ending', label: `★ ${layout.endingNames.get(node.endingId) ?? '?'}`, lines: [], documentId, nodeId: node.id }, true))
        break
      case 'break':
        flushRun()
        blocks.push(single({ id: `${documentId}/${node.id}`, kind: 'break', label: words.outOfTheLoop, lines: [], documentId, nodeId: node.id }, true))
        break
      case 'play': {
        flushRun()
        const id = `${documentId}/${node.id}`
        // Named after the scene it plays once the scenes are laid out.
        const block = single({ id, kind: 'play', label: '▷', lines: [], documentId, nodeId: node.id })
        blocks.push({ ...block, plays: [{ boxId: id, sceneId: node.sceneId }] })
        break
      }
      case 'loop': {
        flushRun()
        const body = layoutNodes(node.nodes, documentId, layout)
        const header = LINE_HEIGHT + PADDING
        const width = body.width + 2 * PADDING
        const frame: GraphBox = { id: `${documentId}/${node.id}`, kind: 'loop', x: 0, y: 0, width, height: header + body.height + 2 * PADDING, label: `↻ ${words.loop}`, lines: [], documentId, nodeId: node.id }
        const inner = shifted(body, PADDING, header + PADDING)
        const left = PADDING / 2
        blocks.push({
          width,
          height: frame.height,
          boxes: [frame, ...inner.boxes],
          edges: [
            ...inner.edges,
            // The way back: from the end of the body to its start.
            { kind: 'back', points: [{ x: PADDING + body.centre, y: header + PADDING + body.height }, { x: left, y: header + PADDING + body.height }, { x: left, y: header + PADDING }, { x: PADDING + body.centre, y: header + PADDING }] },
          ],
          centre: width / 2,
          stops: false,
          plays: inner.plays,
        })
        break
      }
      case 'condition': {
        flushRun()
        blocks.push(layoutCondition(node, documentId, layout))
        break
      }
    }
  }
  flushRun()
  return stack(blocks)
}

function layoutCondition(node: Extract<StoredNode, { type: 'condition' }>, documentId: string, layout: Layout): Block {
  const { project, words } = layout
  const conditions = node.branches.map(branch => branch.condition === null ? null : describeCondition(branch.condition, project))
  const head = single({ id: `${documentId}/${node.id}`, kind: 'fork', label: words.ifCondition(conditions[0] ?? ''), lines: [], documentId, nodeId: node.id })
  const hasElse = conditions.includes(null)
  const lanes = node.branches.map((branch, index) => {
    const condition = conditions[index] ?? null
    const label = condition === null ? words.otherwise : index === 0 ? words.ifCondition(condition) : words.elseIf(condition)
    const title = single({ id: `${documentId}/${node.id}/${branch.id}`, kind: 'branch', label: shortText(label, 36), lines: [], documentId, nodeId: node.id, conditionId: node.id, branchId: branch.id, isElse: condition === null })
    const body = layoutNodes(branch.nodes, documentId, layout)
    return branch.nodes.length === 0 ? title : stack([title, body])
  })
  const lanesWidth = lanes.reduce((total, lane) => total + lane.width, 0) + COLUMN_GAP * Math.max(0, lanes.length - 1) + (hasElse ? 0 : COLUMN_GAP)
  const width = Math.max(BOX_WIDTH, lanesWidth)
  const centre = width / 2
  const lanesTop = head.height + GAP
  const lanesHeight = Math.max(0, ...lanes.map(lane => lane.height))
  const joinY = lanesTop + lanesHeight + GAP
  const result: Block = { width, height: joinY, boxes: [], edges: [], centre, stops: false, plays: [] }
  const placedHead = shifted(head, centre - head.centre, 0)
  result.boxes.push(...placedHead.boxes)
  let x = (width - lanesWidth) / 2
  for (const lane of lanes) {
    const placed = shifted(lane, x, lanesTop)
    const laneCentre = x + lane.centre
    result.boxes.push(...placed.boxes)
    result.edges.push(...placed.edges)
    result.plays.push(...placed.plays)
    result.edges.push({ kind: 'flow', points: [{ x: centre, y: head.height }, { x: centre, y: head.height + GAP / 2 }, { x: laneCentre, y: head.height + GAP / 2 }, { x: laneCentre, y: lanesTop }] })
    if (!lane.stops) {
      result.edges.push({ kind: 'flow', points: [{ x: laneCentre, y: lanesTop + lane.height }, { x: laneCentre, y: joinY - GAP / 2 }, { x: centre, y: joinY - GAP / 2 }, { x: centre, y: joinY }] })
    }
    x += lane.width + COLUMN_GAP
  }
  // Without an [else], the story may pass the block by: a way round it, on its right.
  if (!hasElse) {
    const bypass = x - COLUMN_GAP / 2
    result.edges.push({ kind: 'flow', points: [{ x: centre, y: head.height }, { x: centre, y: head.height + GAP / 2 }, { x: bypass, y: head.height + GAP / 2 }, { x: bypass, y: joinY - GAP / 2 }, { x: centre, y: joinY - GAP / 2 }, { x: centre, y: joinY }] })
  }
  result.stops = hasElse && lanes.every(lane => lane.stops)
  return result
}

/** The map of the story: its chapters in playing order on the left, its scenes in a column on the right. */
export function layOutStoryGraph(project: ProjectDocument, chapters: readonly ChapterDocument[], scenes: readonly ChapterDocument[], words: GraphWords): StoryGraph {
  const layout: Layout = {
    project,
    decisionNames: new Map(project.decisions.map(decision => [decision.id, decision.name])),
    endingNames: new Map(project.endings.map(ending => [ending.id, ending.name])),
    words,
  }
  const documentBlock = (document: ChapterDocument, kind: 'chapter' | 'scene') => {
    const title = kind === 'scene' ? words.scene(document.title ?? '') : document.title ?? words.untitledChapter
    const lines = document.condition === undefined ? [] : [shortText(words.onlyIf(describeCondition(document.condition, project)), 36)]
    const header = single({ id: document.id, kind, label: shortText(title), lines, documentId: document.id, nodeId: null })
    return document.nodes.length === 0 ? header : stack([header, layoutNodes(document.nodes, document.id, layout)])
  }
  // Chapters follow one another: a chapter whose routes all end still hands over to the next, for other routes.
  const story = stack(chapters.map(chapter => ({ ...documentBlock(chapter, 'chapter'), stops: false })))
  const sceneColumn = stack(scenes.map(scene => ({ ...documentBlock(scene, 'scene'), stops: true })))
  const sceneX = story.width + COLUMN_GAP * 3
  const placedScenes = shifted(sceneColumn, sceneX, 0)
  const boxes = [...story.boxes, ...placedScenes.boxes]
  const edges = [...story.edges, ...placedScenes.edges]
  const boxesById = new Map(boxes.map(box => [box.id, box]))
  for (const play of [...story.plays, ...placedScenes.plays]) {
    const from = boxesById.get(play.boxId)
    const to = boxesById.get(play.sceneId)
    if (from !== undefined && to !== undefined) {
      from.label = `▷ ${to.label}`
      edges.push({ kind: 'play', points: [{ x: from.x + from.width, y: from.y + from.height / 2 }, { x: to.x, y: to.y + to.height / 2 }] })
    }
  }
  return {
    boxes,
    edges,
    width: scenes.length === 0 ? story.width : sceneX + sceneColumn.width,
    height: Math.max(story.height, sceneColumn.height),
  }
}
