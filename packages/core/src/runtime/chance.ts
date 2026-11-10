import { flattenStoredNodes, type ChapterDocument } from '../format/storyFormat'

/** Whether the story draws numbers, `[set: X = random 1 6]`: only then do its saves keep the seed. */
export function drawsNumbers(documents: readonly ChapterDocument[]): boolean {
  return documents.some(document => flattenStoredNodes(document.nodes).some(node => (node.type === 'count' && node.operation === 'random') || node.type === 'draw'))
}

/** A seed for the draws of a new game. */
export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/** A draw between 0 and 1 from the seed, and the seed of the next one (mulberry32): the same seed always draws the same. */
export function drawFrom(seed: number): { fraction: number; seed: number } {
  const next = (seed + 0x6d2b79f5) >>> 0
  let mixed = Math.imul(next ^ (next >>> 15), next | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  return { fraction: ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32, seed: next }
}
