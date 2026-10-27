/**
 * What is selected in the storyboard grid: side by side elements of one list, so that they always
 * move as one piece. Selecting next to the selection extends it; selecting further away starts
 * again from that element.
 */
export interface GridSelection {
  containerId: string | null
  /** In the order of the list. */
  ids: readonly string[]
}

/** An element of the grid where it stands: its list and its place in it. */
export interface PlacedElement {
  id: string
  containerId: string | null
}

export const NO_SELECTION: GridSelection = { containerId: null, ids: [] }

export function only(element: PlacedElement): GridSelection {
  return { containerId: element.containerId, ids: [element.id] }
}

/**
 * Space, or Ctrl+click: a neighbour of the selection joins it, an end of it leaves it, anything
 * else becomes the whole selection. `siblings` are the elements of the element's list, in order.
 */
export function toggle(selection: GridSelection, element: PlacedElement, siblings: readonly PlacedElement[]): GridSelection {
  if (selection.ids.length === 0 || selection.containerId !== element.containerId) {
    return only(element)
  }
  const order = siblings.map(sibling => sibling.id)
  const first = order.indexOf(selection.ids[0]!)
  const last = order.indexOf(selection.ids.at(-1)!)
  const position = order.indexOf(element.id)
  if (selection.ids.includes(element.id)) {
    if (position !== first && position !== last) {
      return only(element)
    }
    const remaining = selection.ids.filter(id => id !== element.id)
    return remaining.length === 0 ? NO_SELECTION : { containerId: selection.containerId, ids: remaining }
  }
  if (position === first - 1 || position === last + 1) {
    return { containerId: selection.containerId, ids: order.slice(Math.min(first, position), Math.max(last, position) + 1) }
  }
  return only(element)
}

/** Shift with a move or a click: everything from the anchor to the element, when they share a list. */
export function rangeTo(anchor: PlacedElement | null, element: PlacedElement, siblings: readonly PlacedElement[]): GridSelection {
  if (anchor === null || anchor.containerId !== element.containerId) {
    return only(element)
  }
  const order = siblings.map(sibling => sibling.id)
  const [from, to] = [order.indexOf(anchor.id), order.indexOf(element.id)].sort((first, second) => first - second)
  return from === -1 ? only(element) : { containerId: element.containerId, ids: order.slice(from, to! + 1) }
}

/** Empty branches get a stand-in, so that the keyboard can reach them and add pages there. */
export const emptyLaneId = (containerId: string | null) => `lane:${containerId ?? 'chapter'}`
