/** A part of a page in a style, with the properties of that style and the class its CSS gives it. */
export interface StyledPart {
  start: number
  end: number
  properties: readonly string[]
  /** `author-<class>`: the project's CSS for this style, when it has some. */
  authorClass?: string
}

/**
 * The text cut wherever a style begins or ends and where the typewriter is: each run has the
 * properties of the styles over it as classes, and is shown or only laid out.
 */
export function textRuns(text: string, visibleLength: number, styles: readonly StyledPart[]) {
  const cuts = [...new Set([0, text.length, Math.min(visibleLength, text.length), ...styles.flatMap(span => [span.start, span.end])])]
    .filter(cut => cut >= 0 && cut <= text.length)
    .sort((first, second) => first - second)
  return cuts.slice(0, -1).map((start, index) => {
    const end = cuts[index + 1]!
    const over = styles.filter(span => span.start <= start && span.end >= end)
    const properties = [...new Set(over.flatMap(span => span.properties))]
    const authorClasses = [...new Set(over.flatMap(span => span.authorClass === undefined ? [] : [span.authorClass]))]
    return { start, text: text.slice(start, end), classes: [...properties.map(property => `style-${property}`), ...authorClasses, { 'not-yet-shown': start >= visibleLength }] }
  })
}
