import type { StoryNode } from './importTypes'

/** Names written by people are compared ignoring case and spacing: `Rooftop  ending` is `rooftop ending`. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Every node, including those inside condition branches and loops, in reading order. */
export function flattenNodes(nodes: StoryNode[]): StoryNode[] {
  return nodes.flatMap(node => node.type === 'condition'
    ? [node, ...node.branches.flatMap(branch => flattenNodes(branch.nodes))]
    : node.type === 'loop' ? [node, ...flattenNodes(node.nodes)] : [node])
}
