/**
 * Properties a named style is made of. The player turns them into its own presentation: authors
 * choose among them and never write CSS, which a downloaded game must not carry.
 */
export const STYLE_PROPERTIES = ['italic', 'bold', 'small', 'large', 'grey', 'red', 'blue', 'green', 'gold', 'shaking'] as const

export type StyleProperty = typeof STYLE_PROPERTIES[number]

/** A property as written, `Gray` or `grey`; null when it is none of them. */
export function readStyleProperty(word: string): StyleProperty | null {
  const lowerCaseWord = word.toLowerCase() === 'gray' ? 'grey' : word.toLowerCase()
  return (STYLE_PROPERTIES as readonly string[]).includes(lowerCaseWord) ? lowerCaseWord as StyleProperty : null
}
