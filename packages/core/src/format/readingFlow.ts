/** What the reading order needs to know of a node: imported and stored nodes both have it. */
export interface FlowNode {
  readonly type: string
  readonly branches?: readonly { readonly condition: unknown; readonly nodes: readonly FlowNode[] }[]
  /** The body of a loop. */
  readonly nodes?: readonly FlowNode[]
}

export interface ReadingFlow<Node> {
  /**
   * Nodes that playing never reaches: those after an ending or a break, after a block whose
   * branches all stop, an `else` among them (a block without `else` can always be passed by), or
   * after a loop no `[break]` leaves.
   */
  unreachable: Set<Node>
  /** Loops played that nothing inside can leave: no break or ending. The player would be stuck. */
  endlessLoops: Set<Node>
}

export interface FlowOptions<Node> {
  /** Scenes, each read from its start: they are played from wherever a `[play]` is. */
  scenes?: readonly (readonly Node[])[]
  /** Whether a `[play]` never comes back, its scene always ending; it comes back when not told. */
  playStops?: (play: Node) => boolean
  /** Indexes of the chapters played only on a condition: like a block without `else`, they can be passed by. */
  conditionalChapters?: ReadonlySet<number>
}

/** Follows the chapters in playing order: one whose every path stops leaves the next one unreached. */
export function readingFlow<Node extends FlowNode>(chapters: readonly (readonly Node[])[], options: FlowOptions<Node> = {}): ReadingFlow<Node> {
  const flow: ReadingFlow<FlowNode> = { unreachable: new Set(), endlessLoops: new Set() }
  const playStops = options.playStops as ((play: FlowNode) => boolean) | undefined
  chapters.reduce((isReached, nodes, index) => {
    const goesOn = playThrough(nodes, isReached, flow, playStops).goesOn
    return goesOn || (isReached && (options.conditionalChapters?.has(index) ?? false))
  }, true)
  for (const scene of options.scenes ?? []) {
    playThrough(scene, true, flow, playStops)
  }
  return flow as ReadingFlow<Node>
}

export function unreachableNodes<Node extends FlowNode>(chapters: readonly (readonly Node[])[], options: FlowOptions<Node> = {}): Set<Node> {
  return readingFlow(chapters, options).unreachable
}

/** Whether playing the nodes always stops before their end, at an ending: a branch, or a scene, that ends. */
export function alwaysStops<Node extends FlowNode>(nodes: readonly Node[], playStops?: (play: Node) => boolean): boolean {
  const passage = playThrough(nodes, true, { unreachable: new Set(), endlessLoops: new Set() }, playStops as ((play: FlowNode) => boolean) | undefined)
  return !passage.goesOn && !passage.breaks
}

/** Whether the end of the list is reached, and whether a `[break]` leaves the loop holding it. */
interface Passage {
  goesOn: boolean
  breaks: boolean
}

function playThrough(nodes: readonly FlowNode[], isReached: boolean, flow: ReadingFlow<FlowNode>, playStops: ((play: FlowNode) => boolean) | undefined): Passage {
  let isReachedHere = isReached
  let breaks = false
  for (const node of nodes) {
    // A definition plays nothing: wherever it stands, nothing is lost.
    if (!isReachedHere && node.type !== 'definition') {
      flow.unreachable.add(node)
    }
    if (node.branches !== undefined) {
      const passages = node.branches.map(branch => playThrough(branch.nodes, isReachedHere, flow, playStops))
      breaks ||= passages.some(passage => passage.breaks)
      isReachedHere = passages.some(passage => passage.goesOn) || (isReachedHere && !node.branches.some(branch => branch.condition === null))
    } else if (node.type === 'loop') {
      const body = node.nodes ?? []
      const passage = playThrough(body, isReachedHere, flow, playStops)
      if (isReachedHere && !passage.breaks && !hasWayOut(body, playStops)) {
        flow.endlessLoops.add(node)
      }
      isReachedHere = passage.breaks
    } else if (node.type === 'break') {
      breaks ||= isReachedHere
      isReachedHere = false
    } else if (node.type === 'ending' || (node.type === 'play' && playStops?.(node) === true)) {
      isReachedHere = false
    }
  }
  return { goesOn: isReachedHere, breaks }
}

/** An ending anywhere inside, or a scene that always ends: the loop may stop the story rather than repeat for ever. */
function hasWayOut(nodes: readonly FlowNode[], playStops: ((play: FlowNode) => boolean) | undefined): boolean {
  return nodes.some(node => node.type === 'ending'
    || (node.type === 'play' && playStops?.(node) === true)
    || (node.branches?.some(branch => hasWayOut(branch.nodes, playStops)) ?? false)
    || (node.type === 'loop' && hasWayOut(node.nodes ?? [], playStops)))
}
