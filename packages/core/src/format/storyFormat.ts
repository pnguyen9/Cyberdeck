import type { StyleProperty } from './textStyles'
import { idsReadBy } from './lists'
/**
 * Version of the stored documents, shared by Cyberdeck projects and Datajack chips.
 *
 * A minor version adds optional things that older readers may ignore; a major version changes
 * the structure, and older readers must refuse the document.
 */
export const FORMAT_VERSION = '3.2'

/** True when this version of the code can read a document written in `version`: any version up to its own, every earlier major one included. */
export function isSupportedFormatVersion(version: string): boolean {
  const [currentMajor = 0, currentMinor = 0] = FORMAT_VERSION.split('.').map(Number)
  const parsedVersion = /^(\d+)\.(\d+)$/.exec(version)
  if (parsedVersion === null) {
    return false
  }
  const major = Number(parsedVersion[1])
  return major >= 1 && (major < currentMajor || (major === currentMajor && Number(parsedVersion[2]) <= currentMinor))
}

/** Dates are ISO 8601 strings, in UTC. */
export interface Audited {
  createdAt: string
  updatedAt: string
}

export interface DecisionValue {
  id: string
  name: string
}

/** Something the player decided. Renaming it or its values keeps every reference, which use identifiers. */
export interface Decision {
  id: string
  name: string
  /** Several values can hold at once (clues found), instead of exactly one (an answer). */
  multiple: boolean
  values: DecisionValue[]
  /**
   * Declared nowhere: a choice made it, with the values of its options, which later choices may
   * extend. A declared decision lives where its declaration is, a `definition` node of a chapter,
   * or in the project's definitions when no node declares it. Since 1.2.
   */
  implicit?: true
  /** Its values are kept by the profile from one playthrough to the next. Since 2.0. */
  lasting?: true
}

/**
 * A number the story counts with, `[counter: Trust = 2]`: added to, set, and compared. One never
 * changed holds `initial`. Since 1.3.
 */
/**
 * A numbered row of values under one name, `[list: Board = 16 × none]`, its places counted from 1:
 * names, as a decision's values are, read back as numbers by counters. Since 3.0.
 */
export interface StoryList {
  id: string
  name: string
  /** What it holds when a game starts. */
  initial: string[]
}

/** A place in a list: a number, or what a counter holds. */
export type ListPlace = { type: 'number'; number: number } | { type: 'counter'; counterId: string }

/** A value given to or tested in a list: written as such, or what a decision, a counter or another place holds. */
export type ListValue =
  | { type: 'text'; text: string }
  | { type: 'decision'; decisionId: string }
  | { type: 'counter'; counterId: string }
  | { type: 'item'; listId: string; place: ListPlace }

/** `[set: Board 3 = cat]`, `[add: Queue = {Cell}]`, `[shuffle: Board]`, `[unset: Board]`. Since 3.0. */
export interface StoredListChange {
  type: 'list'
  id: string
  listId: string
  change:
    | { type: 'set'; place: ListPlace; value: ListValue }
    | { type: 'add'; value: ListValue }
    | { type: 'shuffle' }
    | { type: 'clear' }
}

/** `[take: Cell = first of Queue]`: the first or last value of a list, taken out of it into a counter or a decision. Since 3.0. */
export interface StoredTake {
  type: 'take'
  id: string
  listId: string
  end: 'first' | 'last'
  into: { type: 'counter'; counterId: string } | { type: 'decision'; decisionId: string }
}

/** The largest grid: Minesweeper's expert board. */
export const MAXIMUM_GRID = { columns: 30, rows: 24 } as const

/**
 * `[choice: Cell grid 4 × 4 from Shown with tile]`: a choice shown as rows of picture buttons, numbered
 * from 1 left to right, top to bottom; each shows the picture of `characterId` named like the value
 * its place of the list holds (the value itself without one); picking one gives the counter its
 * number. Since 3.0.
 */
export interface StoredGrid {
  type: 'grid'
  id: string
  /** Shown in the text box while the grid waits, its values filled in as it is shown. Since 3.2. */
  caption?: string
  counterId: string
  columns: number
  rows: number
  /** A size read from counters as the grid is shown, `grid {Columns} × {Rows}`, in place of `columns`, `rows`. */
  columnsFrom?: string
  rowsFrom?: string
  listId: string
  characterId: string | null
}

/** What the player's clock tells a story: the hour, the day of the week, the minutes since the profile last played. */
export type ClockValue = 'hour' | 'weekday' | 'timeAway' | 'now'

/**
 * Counters every story has without declaring them, which it tests and shows as any other but never
 * changes: `hour` (0 to 23), `weekday` (1 for Monday to 7 for Sunday), `time away` (minutes since the
 * profile last played the game, 0 the first time), `now` (seconds since 1970, to time the player:
 * since 3.2). A counter or a decision the story declares under
 * one of these names is its own instead.
 */
export const CLOCK_COUNTERS: readonly { clock: ClockValue; name: string }[] = [
  { clock: 'hour', name: 'hour' },
  { clock: 'weekday', name: 'weekday' },
  { clock: 'timeAway', name: 'time away' },
  { clock: 'now', name: 'now' },
]

export interface Counter {
  id: string
  name: string
  /**
   * In the counter's units: a counter with decimals counts in hundredths (`decimals` 2) or the like,
   * so that every number it holds, adds or is compared with is a whole number of them. Amounts of
   * `count` nodes and `counter` conditions are in the same units.
   */
  initial: number
  /** The decimals it counts with, `[counter: Money = 1000.00]` two; none when absent. Since 2.1. */
  decimals?: number
  /** A value the player's clock gives rather than the story, read as the story plays: see `CLOCK_COUNTERS`. Since 2.1. */
  clock?: ClockValue
  /** Declared nowhere: an `[add]` made it, starting at 0. */
  implicit?: true
  /** Its number is kept by the profile from one playthrough to the next. Since 2.0. */
  lasting?: true
}

/**
 * A name the player gives, `[ask: Hero = Alex]`, which the text shows wherever it writes `{Hero}`.
 * `defaultName` stands in until the player gives one, and when they give none. Since 1.4.
 */
export interface AskedName {
  id: string
  name: string
  defaultName: string
}

/** A file of the project: an image or a sound, stored as `assets/<id>` whatever its original name. */
export interface Asset {
  id: string
  /** As the author named it, shown in the editor only. */
  fileName: string
  mediaType: string
  byteSize: number
}

/** `assetId` is null until the author gives the entry a file: the player then shows a placeholder. */
export interface Expression {
  id: string
  name: string
  assetId: string | null
}

export type Facing = 'left' | 'right'

export interface Character {
  id: string
  /** Shown as the speaker, as first written: `Marie`. */
  name: string
  expressions: Expression[]
  /**
   * The way the sprites were drawn looking, so that the player can mirror them to face another
   * character. Null for sprites facing the viewer, or that must not be mirrored (a badge, a hair
   * parting): they are shown as drawn.
   */
  drawnFacing: Facing | null
  /** The colour of the name on their plate, `#rrggbb`; absent for the plate's own. Since 1.5. */
  nameColor?: string
  /**
   * The character whose pictures it shows, `[character: card1 = card]`: an expression with no file
   * of its own shows that character's of the same name. Look-alikes, cards on a table. Since 2.1.
   */
  picturesFrom?: string
}

/** The file an expression shows: its own, or that of the expression of the same name of the character it takes its pictures from. */
export function expressionAssetId(characters: readonly Character[], character: Character | undefined, expression: Expression | undefined): string | null {
  if (expression === undefined) {
    return null
  }
  if (expression.assetId !== null || character?.picturesFrom === undefined) {
    return expression.assetId
  }
  const lender = characters.find(candidate => candidate.id === character.picturesFrom)
  const name = expression.name.trim().toLowerCase()
  return lender?.expressions.find(candidate => candidate.name.trim().toLowerCase() === name)?.assetId ?? null
}

/** Picture frames of the text box and the name plate: images of the project, stretched by their edges. Since 1.5. */
export interface Frames {
  textBox: string | null
  namePlate: string | null
}

/**
 * What players may see of what they hold, in the window of what they collected: decisions and
 * counters by identifier, shown always or once the profile has reached an ending; and the endings
 * reached. Nothing, unless the author says so. Since 2.0.
 */
export interface ShownToPlayers {
  always: string[]
  afterAnEnding: string[]
  endings: ShownWhen | null
}

export type ShownWhen = 'always' | 'afterAnEnding'

export const NOTHING_SHOWN: ShownToPlayers = { always: [], afterAnEnding: [], endings: null }

/** What players may see, with a decision or a counter moved to `when`: never (null), always, or after an ending. */
export function withShown(shown: ShownToPlayers, id: string, when: ShownWhen | null): ShownToPlayers {
  const always = shown.always.filter(candidate => candidate !== id)
  const afterAnEnding = shown.afterAnEnding.filter(candidate => candidate !== id)
  return {
    ...shown,
    always: when === 'always' ? [...always, id] : always,
    afterAnEnding: when === 'afterAnEnding' ? [...afterAnEnding, id] : afterAnEnding,
  }
}

/** In `[shown: …]`, the name that means the endings reached rather than a decision or a counter. */
export const ENDINGS_REACHED = 'endings reached'

/** A named spot on the stage, like a CSS position: `x` is the percentage of the stage width at the character's centre. */
export interface PositionPreset {
  id: string
  name: string
  x: number
}

/** Positions every project starts with; their identifiers are fixed so that automatic layout can rely on them. */
export const DEFAULT_POSITION_PRESETS: readonly PositionPreset[] = [
  { id: 'position-far-left', name: 'far-left', x: 10 },
  { id: 'position-left', name: 'left', x: 25 },
  { id: 'position-center', name: 'center', x: 50 },
  { id: 'position-right', name: 'right', x: 75 },
  { id: 'position-far-right', name: 'far-right', x: 90 },
]

export type AnimationKind =
  | 'instant'
  | 'fade'
  | 'slide-from-left'
  | 'slide-from-right'
  | 'slide-to-left'
  | 'slide-to-right'

/** How a character enters, leaves or moves. Null fields take the project default, so that changing a default changes every scene. */
export interface AnimationSpec {
  kind: AnimationKind | null
  durationMs: number | null
  /** Holds the text until the animation ends. */
  wait: boolean
}

export interface StageDefaults {
  enter: { kind: AnimationKind; durationMs: number }
  exit: { kind: AnimationKind; durationMs: number }
  move: { durationMs: number }
}

export const DEFAULT_STAGE_DEFAULTS: StageDefaults = {
  enter: { kind: 'fade', durationMs: 400 },
  exit: { kind: 'fade', durationMs: 400 },
  move: { durationMs: 600 },
}

/** Where a character stands: chosen by the player (`auto`), a preset, or an exact percentage of the stage width. */
export type Placement =
  | { type: 'auto' }
  | { type: 'preset'; presetId: string }
  | { type: 'exact'; x: number }

export interface Background {
  id: string
  name: string
  assetId: string | null
}

export interface MusicTrack {
  id: string
  name: string
  assetId: string | null
}

/** A full-screen picture of a key moment, shown over the stage; players collect those seen in a gallery. Since 1.1. */
export interface Illustration {
  id: string
  name: string
  assetId: string | null
}

/**
 * A font the project's CSS may name, `font-family: "Cinzel"`: named after its file, created when the
 * file is added. `widthScale` is how much wider than the text box's font it draws text, measured
 * when added, so that pages in it are cut to fit. Since 1.2.
 */
export interface FontEntry {
  id: string
  name: string
  assetId: string | null
  widthScale: number
}

/** A sound effect, played once where it is named: a door, a phone, footsteps. Since 1.1. */
export interface SoundEffect {
  id: string
  name: string
  assetId: string | null
}

/** A video played over the whole screen where it is named: an opening, a cutscene. Since 1.3. */
export interface VideoClip {
  id: string
  name: string
  assetId: string | null
  /** Its captions, a WebVTT file shown over it when the player wants them. Since 1.4. */
  captionsAssetId?: string
}

/** An ending of the story, named by `[ending: …]`; players see how many they have reached. */
export interface Ending {
  id: string
  name: string
  /** What players read of it in the project's other languages, by code: `[ending: The Empty Room = La Chambre vide]`. Since 2.0. */
  translations?: Record<string, string>
}

/** Something a profile remembers across playthroughs once `[remember: …]` is reached. */
export interface Memory {
  id: string
  name: string
}

/** A named style of text, made of properties the player knows; one named after a property is that property alone. Since 1.1. */
export interface TextStyle {
  id: string
  name: string
  properties: StyleProperty[]
  /** Declared nowhere: named after a single property (`italic`), or after a class of the project's CSS. Since 1.2. */
  implicit?: true
}

/** What players see of the game before playing it: on its library card, its title screen, its credits. */
export interface GameDetails {
  /** A few lines presenting the story. */
  description: string
  /** Free text: who wrote, drew and composed, and the licences of borrowed music or art. */
  credits: string
  coverAssetId: string | null
}

/** `project.json`, at the root of the project folder named after `id`. */
export interface ProjectDocument extends Audited {
  formatVersion: string
  id: string
  name: string
  /** The first language of the story, the one it was started in, for sentence boundaries and typography. */
  locale: string
  /** Every language the story is written in, the first one first. Since 2.0. */
  languages: string[]
  chapterOrder: string[]
  /** Scenes: pages of no chapter, played wherever a `[play]` names them. Stored as chapters are. Since 1.1. */
  sceneOrder: string[]
  decisions: Decision[]
  /** Since 1.3. */
  counters: Counter[]
  /** Since 3.0; absent before. */
  lists?: StoryList[]
  /** Since 1.4. */
  askedNames: AskedName[]
  endings: Ending[]
  memories: Memory[]
  styles: TextStyle[]
  characters: Character[]
  backgrounds: Background[]
  music: MusicTrack[]
  sounds: SoundEffect[]
  illustrations: Illustration[]
  /** Since 1.3. */
  videos: VideoClip[]
  /** Since 1.2. */
  fonts: FontEntry[]
  assets: Asset[]
  positions: PositionPreset[]
  stageDefaults: StageDefaults
  details: GameDetails
  /** The author's CSS for the styles: checked by `checkAuthorCss` wherever it is used. Since 1.2. */
  css: string
  /** Each chapter's title shown over the stage as it starts. Since 1.2. */
  chapterTitleCards: boolean
  /** Asset identifiers of the frames, null for none. Since 1.5. */
  frames: Frames
  /** What the window of what players collected shows. Since 2.0. */
  shown: ShownToPlayers
}

/** How close to the player a character stands: nearer is larger and in front. Since 1.1. */
export type Depth = 'near' | 'middle' | 'far'

export type ShakeStrength = 'light' | 'strong'
export type FlashColor = 'white' | 'red' | 'black'
export type FadeColor = 'black' | 'white'
/** A filter over the whole stage: sepia for a memory, night, grey. */
export type TintName = 'sepia' | 'night' | 'grey'

/** What a page or a stage node does to the stage, by identifier. Null durations take the player's defaults. */
export type StageCommand =
  /** `from`: the decision whose value names the background, `[bg: {Place}]`; `backgroundId` its first value's. Since 2.1. */
  | { type: 'background'; backgroundId: string; from?: string }
  /**
   * Announces how the next background appears: `fade`, through `black` or `white`; players treat
   * names they do not know as a cut.
   */
  | { type: 'transition'; name: string; durationMs: number | null }
  /** Null stops the music. */
  | { type: 'music'; musicId: string | null }
  /** Played once, over the music; changes nothing on stage. */
  | { type: 'sound'; soundId: string }
  /** A line spoken, one of the project's sounds: played like a sound, but stopped as the player moves on. Since 1.3. */
  | { type: 'voice'; soundId: string }
  /** Played over the whole screen; the text waits until it ends, or the player skips it. Since 1.3. */
  | { type: 'video'; videoId: string }
  /** Played once, like a sound: the stage trembles, or a colour flashes over it. */
  | { type: 'shake'; strength: ShakeStrength; durationMs: number | null }
  | { type: 'flash'; color: FlashColor; durationMs: number | null }
  /** The screen covered with a colour, out, or uncovered, in; the text waits for the fade. Since 1.1. */
  | { type: 'fade'; direction: 'out' | 'in'; color: FadeColor; durationMs: number | null }
  /** Until changed; null removes it. Since 1.1. */
  | { type: 'tint'; tint: TintName | null }
  /** What players read when the game runs out of the chapters installed, until another says otherwise; null for the default. */
  | { type: 'continued'; text: string | null }
  /**
   * A part played as a game, until turned off: no going back, saving or loading, no points on the
   * map; `untilEnding`, the lock lifts once the player has reached an ending of the game. Since 3.2.
   */
  | { type: 'gameMode'; on: boolean; untilEnding?: true }
  /** A part played forward only: no going back, saving or loading, the map recorded as usual. Since 3.2. */
  | { type: 'noGoingBack'; on: boolean; untilEnding?: true }
  /** Text in a box at the bottom, or over the whole screen, pages piling up until cleared. Since 1.1. */
  | { type: 'textMode'; mode: 'box' | 'full' }
  /** Starts a new screen of full-screen text. Since 1.1. */
  | { type: 'clear' }
  /** Shown over the whole stage until another one, or null to take it away. Since 1.1. */
  | { type: 'illustration'; illustrationId: string | null; from?: string }
  /** `facing` null: the player turns the character towards the middle of the stage; `depth` null stands in the middle. */
  | { type: 'enter'; characterId: string; expressionId: string; placement: Placement; facing: Facing | null; depth: Depth | null; animation: AnimationSpec; from?: string }
  | { type: 'exit'; characterId: string; animation: AnimationSpec }
  /** A null placement or depth keeps the current one; at least one of them is given. */
  | { type: 'move'; characterId: string; placement: Placement | null; depth: Depth | null; animation: AnimationSpec }
  /** `turn`: the picture turns over to the new one, as a card does, holding the text if `wait`. Since 3.1. */
  | { type: 'expression'; characterId: string; expressionId: string; from?: string; turn?: PictureTurn }
  /** Pauses the typewriter, and holds the tags written after it until it is over. */
  | { type: 'wait'; seconds: number }

/** A command written after some text: it runs when the typewriter reaches `offset` in the page text. */
export type InlineStageCommand = StageCommand & { offset: number }

/** A picture turning over, `[card: {Drawn} flip 0.4s wait]`: how long it takes, and whether the text waits for it. */
export interface PictureTurn {
  durationMs: number
  wait?: true
}

/** `chapters/<id>.json`. */
export interface ChapterDocument extends Audited {
  formatVersion: string
  id: string
  title: string | null
  /** Absent for a chapter created in the editor. */
  importedFrom?: { fileName: string | null; importedAt: string }
  /** Played only when this holds, passed by otherwise; absent for a chapter always played. Since 1.1. */
  condition?: StoredCondition
  nodes: StoredNode[]
  /** Its text in the project's other languages, by code; a language absent here is hollow in it. Since 2.0. */
  translations?: Record<string, ChapterTranslation>
  /**
   * No text in the project's first language yet: the chapter came from another one, whose title stands
   * in. Since 2.0.
   */
  hollow?: true
}

/** A chapter's text in one of the project's other languages. Since 2.0. */
export interface ChapterTranslation {
  title: string | null
  nodes: StoredNode[]
  importedFrom?: { fileName: string | null; importedAt: string }
}

export interface StoredPage {
  type: 'page'
  id: string
  kind: 'narration' | 'dialogue'
  /** Null for narration, and for dialogue that names nobody. */
  speakerId: string | null
  text: string
  commandsBefore: StageCommand[]
  inlineCommands: InlineStageCommand[]
  /** Parts of the text in a style, `end` excluded; absent when none. Since 1.1. */
  styles?: { start: number; end: number; styleId: string }[]
}

export interface StoredStage {
  type: 'stage'
  id: string
  commands: StageCommand[]
}

export interface StoredChoice {
  type: 'choice'
  id: string
  decisionId: string
  options: StoredChoiceOption[]
  /** The time the player has to pick, after which the option marked `timeout` is taken. Since 1.4; that option offered as the others since 2.0. */
  timeLimitMs?: number
}

export interface StoredChoiceOption {
  id: string
  text: string
  valueId: string
  /** Offered only while this holds; always when null. */
  condition: StoredCondition | null
  /** Never shown: taken when the time of a timed choice runs out. Since 1.4. */
  timeout?: true
}

export type CounterOperator = '=' | '!=' | '<' | '<=' | '>' | '>='

export type StoredCondition =
  | { type: 'is'; decisionId: string; valueId: string; negated: boolean }
  /** The counter compared with `amount`: `Trust >= 3`. Since 1.3. */
  /** `Board Cell is cat`: what a place of a list holds. Since 3.0. */
  | { type: 'listItem'; listId: string; place: ListPlace; value: ListValue; negated: boolean }
  /** `Queue size > 0`: how many values a list holds. Since 3.0. */
  | { type: 'listSize'; listId: string; operator: CounterOperator; amount: number }
  /** `otherCounterId`: compared with what another counter holds, `Money >= {Bet}`, in place of `amount`. Since 2.1. */
  | { type: 'counter'; counterId: string; operator: CounterOperator; amount: number; otherCounterId?: string }
  | { type: 'remembered'; memoryId: string; negated: boolean }
  | { type: 'endingSeen'; endingId: string; negated: boolean }
  | { type: 'and' | 'or'; conditions: StoredCondition[] }

export interface StoredConditionNode {
  type: 'condition'
  id: string
  branches: { id: string; condition: StoredCondition | null; nodes: StoredNode[] }[]
}

export interface StoredSet {
  type: 'set'
  id: string
  decisionId: string
  valueId: string
}

/** Takes a value away from a decision, or every value when `valueId` is null: tests of it no longer hold. */
export interface StoredUnset {
  type: 'unset'
  id: string
  decisionId: string
  valueId: string | null
}

/**
 * Adds `amount` to a counter, `[add: Trust -1]`, gives it that value, `[set: Trust = 3]`, or a value
 * drawn from `amount` to `maximum`, `[set: Weather = random 1 6]`. Since 1.3; `random` since 1.5.
 */
export interface StoredCount {
  type: 'count'
  id: string
  counterId: string
  operation: 'add' | 'set' | 'random'
  amount: number
  /** `[add: Money -{Bet}]`, `[set: Score = {Points}]`: another counter's value times `factor`, in place of `amount`. Since 2.1. */
  from?: { counterId: string; factor: number }
  /** `[set: Near = {Board 3}]`: the number a place of a list holds, in place of `amount`. Since 3.0. */
  fromItem?: { listId: string; place: ListPlace }
  /** For `random`: the highest number drawn, `amount` the lowest. */
  maximum?: number
}

/** The path ends here: the player has reached this ending. */
export interface StoredEnding {
  type: 'ending'
  id: string
  endingId: string
}

/**
 * Where a decision, a counter or a style is declared, when the author keeps its declaration in a chapter: the
 * declaration is written there on export, and the storyboard shows it there. It plays nothing, and
 * games leave it out. Since 1.2.
 */
export interface StoredDefinition {
  type: 'definition'
  id: string
  /** `counter` since 1.3. */
  kind: DefinitionKind
  definedId: string
}

export type DefinitionKind = 'decision' | 'counter' | 'style'

/** Asks the player for a name: the story stops until they give one. Since 1.4. */
export interface StoredAsk {
  type: 'ask'
  id: string
  askedNameId: string
}

/**
 * `[set: Drawn = random]`: one of the decision's values drawn at random, as `[set]` would give it;
 * `[set: Drawn = random not in Dealt]` leaves out the values another decision holds, by their names:
 * a card dealt is not dealt twice. Nothing left to draw, nothing changes. Since 2.1.
 */
export interface StoredDraw {
  type: 'draw'
  id: string
  decisionId: string
  notInDecisionId: string | null
}

/**
 * `[set: Dealt = {Drawn}]`: the decision is given its value named like the one another decision
 * holds, as `[set]` would give it: the card drawn joins those dealt. Since 2.1.
 */
export interface StoredCopy {
  type: 'copy'
  id: string
  decisionId: string
  fromDecisionId: string
}

/** A bound of a number asked for: a number, in the units of the counter asked for, or what another counter holds. */
export type StoredAskBound = { type: 'amount'; amount: number } | { type: 'counter'; counterId: string }

/**
 * `[ask number: Bet = 10, from 1 to {Money}]`: the player types a number for a counter, which the
 * field keeps within its bounds. Amounts in the counter's units. Since 2.1.
 */
export interface StoredAskNumber {
  type: 'askNumber'
  id: string
  counterId: string
  defaultAmount: number
  minimum: StoredAskBound | null
  maximum: StoredAskBound | null
}

/** The profile remembers this from now on, in every playthrough; or, `forget`, no longer does. Forgetting since 2.0. */
export interface StoredRemember {
  type: 'remember'
  id: string
  memoryId: string
  forget?: true
}

/** Plays its nodes again and again, until a `[break]` inside leaves it. Since 1.1. */
export interface StoredLoop {
  type: 'loop'
  id: string
  nodes: StoredNode[]
}

/** Plays a scene, then goes on after this node unless the scene ended the story. Since 1.1. */
export interface StoredPlay {
  type: 'play'
  id: string
  sceneId: string
}

/** Leaves the innermost loop, going on after it. Since 1.1. */
export interface StoredBreak {
  type: 'break'
  id: string
}

export type StoredNode = StoredPage | StoredStage | StoredChoice | StoredConditionNode | StoredLoop | StoredBreak | StoredPlay | StoredSet | StoredUnset | StoredCount | StoredDraw | StoredCopy | StoredListChange | StoredTake | StoredGrid | StoredAsk | StoredAskNumber | StoredDefinition | StoredEnding | StoredRemember

/** A list of nodes inside a block: a branch of a condition, or the body of a loop, which bears the loop's identifier. */
export interface InnerList {
  id: string
  nodes: StoredNode[]
}

/** The stage commands a node gives: a page's, before its text and inside it, or a stage node's. */
export function commandsOf(node: StoredNode): readonly StageCommand[] {
  return node.type === 'page' ? [...node.commandsBefore, ...node.inlineCommands] : node.type === 'stage' ? node.commands : []
}

/** The lists a block holds: a condition's branches, a loop's body; none for other nodes. */
export function innerListsOf(node: StoredNode): readonly InnerList[] {
  return node.type === 'condition' ? node.branches : node.type === 'loop' ? [node] : []
}

/** The block with each of its lists transformed; other nodes as they are. */
export function mapInnerLists<Node extends StoredNode>(node: Node, transform: (list: InnerList) => StoredNode[]): Node {
  if (node.type === 'condition') {
    return { ...node, branches: node.branches.map(branch => ({ ...branch, nodes: transform(branch) })) }
  }
  if (node.type === 'loop') {
    return { ...node, nodes: transform(node) }
  }
  return node
}

/** Every node, those inside branches and loops included, in reading order. */
export function flattenStoredNodes(nodes: readonly StoredNode[]): StoredNode[] {
  return nodes.flatMap(node => [node, ...innerListsOf(node).flatMap(list => flattenStoredNodes(list.nodes))])
}

/** The decisions and counters a condition tests, by identifier. */
export function testedIdsIn(condition: StoredCondition): string[] {
  switch (condition.type) {
    case 'is':
      return [condition.decisionId]
    case 'counter':
      return condition.otherCounterId === undefined ? [condition.counterId] : [condition.counterId, condition.otherCounterId]
    case 'listItem':
      return [condition.listId, ...idsReadBy(condition.place, condition.value)]
    case 'listSize':
      return [condition.listId]
    case 'remembered':
    case 'endingSeen':
      return []
    case 'and':
    case 'or':
      return condition.conditions.flatMap(testedIdsIn)
  }
}

/** Every decision and counter some condition of the documents tests, by identifier: the others change nothing of where the story goes. */
export function testedIdsOf(documents: readonly ChapterDocument[]): Set<string> {
  return new Set(documents.flatMap(document => [
    ...(document.condition === undefined ? [] : testedIdsIn(document.condition)),
    ...flattenStoredNodes(document.nodes).flatMap(node => node.type === 'condition'
      ? node.branches.flatMap(branch => branch.condition === null ? [] : testedIdsIn(branch.condition))
      : node.type === 'choice' ? node.options.flatMap(option => option.condition === null ? [] : testedIdsIn(option.condition)) : []),
  ]))
}

/** Where identifiers and dates come from; tests replace it to get predictable documents. */
export interface Environment {
  createId: () => string
  now: () => string
}

export const defaultEnvironment: Environment = {
  createId: () => globalThis.crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

export function createProject(settings: { name: string; locale: string }, environment: Environment = defaultEnvironment): ProjectDocument {
  const now = environment.now()
  return {
    formatVersion: FORMAT_VERSION,
    id: environment.createId(),
    name: settings.name,
    locale: settings.locale,
    languages: [settings.locale],
    chapterOrder: [],
    sceneOrder: [],
    decisions: [],
    counters: [],
    askedNames: [],
    endings: [],
    memories: [],
    styles: [],
    characters: [],
    backgrounds: [],
    music: [],
    sounds: [],
    illustrations: [],
    videos: [],
    fonts: [],
    assets: [],
    positions: [...DEFAULT_POSITION_PRESETS],
    stageDefaults: DEFAULT_STAGE_DEFAULTS,
    details: { description: '', credits: '', coverAssetId: null },
    css: '',
    chapterTitleCards: false,
    frames: { textBox: null, namePlate: null },
    shown: NOTHING_SHOWN,
    createdAt: now,
    updatedAt: now,
  }
}
