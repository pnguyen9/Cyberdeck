/**
 * Properties a named style is made of, which the player draws itself. Anything else a style looks
 * like comes from the project's CSS, which the player checks first.
 */
export const STYLE_PROPERTIES = ['italic', 'bold', 'small', 'large', 'grey', 'red', 'blue', 'green', 'gold', 'shaking', 'fade-in', 'rise', 'glow'] as const

/** Styles the player draws outside the text: a chapter's title card, and the ending's name on the end screen. */
export const RESERVED_STYLE_NAMES = { chapterTitle: 'chapter title', ending: 'ending' } as const

/** Those Datajack 1.0 (format 1.1) draws: it refuses a style with any other. */
export const STYLE_PROPERTIES_OF_1_1: readonly string[] = ['italic', 'bold', 'small', 'large', 'grey', 'red', 'blue', 'green', 'gold', 'shaking']

export type StyleProperty = typeof STYLE_PROPERTIES[number]

/** How much wider the `large` property draws text: its font size, in the player's textStyles.css. */
export const LARGE_WIDTH_SCALE = 1.15

/** Projects of 1.1 have styles named after their single property without the implicit mark. */
export function isPropertyAlone(style: { name: string; properties: readonly string[] }): boolean {
  return style.properties.length === 1 && style.properties[0] === style.name
}

/** A property as written, `Gray` or `grey`; null when it is none of them. */
export function readStyleProperty(word: string): StyleProperty | null {
  const lowerCaseWord = word.toLowerCase() === 'gray' ? 'grey' : word.toLowerCase()
  return (STYLE_PROPERTIES as readonly string[]).includes(lowerCaseWord) ? lowerCaseWord as StyleProperty : null
}
