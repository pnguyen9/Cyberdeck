/**
 * The ordinary words core puts around names and story syntax in what the editor shows: places in a
 * chapter, and a few on markers. English unless the editor gives those of its language; the syntax
 * itself, `[set: …]` or `else`, is the same in every language.
 */
export interface StoryWords {
  page: (number: string) => string
  choice: (number: string) => string
  after: (number: string) => string
  atTheStart: string
  untitledChapter: string
  scene: (title: string) => string
  /** Between a name and what it holds: `: `, or in French a non-breaking space before it. */
  colon: string
  /** After the name of a decision several values of which can hold at once. */
  several: string
  /** What a counter holds before anything changes it. */
  startsAt: (amount: number) => string
  /** In place of the properties of a style drawn by the CSS alone. */
  fromTheCss: string
  /** A decision with every value taken away. */
  none: string
  noMore: (value: string) => string
  outOfTheLoop: string
  repeatsUntilBreak: string
  loop: string
}

export const ENGLISH_STORY_WORDS: StoryWords = {
  page: number => `page ${number}`,
  choice: number => `choice ${number}`,
  after: number => `after ${number}`,
  atTheStart: 'at the start',
  untitledChapter: 'Untitled chapter',
  scene: title => `Scene: ${title}`,
  colon: ': ',
  several: 'several',
  startsAt: amount => `starts at ${amount}`,
  fromTheCss: 'from the CSS',
  none: 'none',
  noMore: value => `no more ${value}`,
  outOfTheLoop: 'out of the loop',
  repeatsUntilBreak: 'repeats until a break',
  loop: 'loop',
}
