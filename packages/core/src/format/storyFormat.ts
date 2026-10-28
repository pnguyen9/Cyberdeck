import type { StyleProperty } from './textStyles'
/**
 * Version of the stored documents, shared by Cyberdeck projects and Datajack chips.
 *
 * A minor version adds optional things that older readers may ignore; a major version changes
 * the structure, and older readers must refuse the document.
 */
export const FORMAT_VERSION = '1.3'

/** True when this version of the code can read a document written in `version`. */
export function isSupportedFormatVersion(version: string): boolean {
  const [currentMajor, currentMinor] = FORMAT_VERSION.split('.').map(Number)
  const parsedVersion = /^(\d+)\.(\d+)$/.exec(version)
  if (parsedVersion === null) {
    return false
  }
  return Number(parsedVersion[1]) === currentMajor && Number(parsedVersion[2]) <= (currentMinor ?? 0)
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
}

/**
 * A number the story counts with, `[counter: Trust = 2]`: added to, set, and compared. One never
 * changed holds `initial`. Since 1.3.
 */
export interface Counter {
  id: string
  name: string
  initial: number
  /** Declared nowhere: an `[add]` made it, starting at 0. */
  implicit?: true
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
}

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
}

/** An ending of the story, named by `[ending: …]`; players see how many they have reached. */
export interface Ending {
  id: string
  name: string
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
  /** Language of the story, for sentence boundaries and typography. */
  locale: string
  chapterOrder: string[]
  /** Scenes: pages of no chapter, played wherever a `[play]` names them. Stored as chapters are. Since 1.1. */
  sceneOrder: string[]
  decisions: Decision[]
  /** Since 1.3. */
  counters: Counter[]
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
  | { type: 'background'; backgroundId: string }
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
  /** Text in a box at the bottom, or over the whole screen, pages piling up until cleared. Since 1.1. */
  | { type: 'textMode'; mode: 'box' | 'full' }
  /** Starts a new screen of full-screen text. Since 1.1. */
  | { type: 'clear' }
  /** Shown over the whole stage until another one, or null to take it away. Since 1.1. */
  | { type: 'illustration'; illustrationId: string | null }
  /** `facing` null: the player turns the character towards the middle of the stage; `depth` null stands in the middle. */
  | { type: 'enter'; characterId: string; expressionId: string; placement: Placement; facing: Facing | null; depth: Depth | null; animation: AnimationSpec }
  | { type: 'exit'; characterId: string; animation: AnimationSpec }
  /** A null placement or depth keeps the current one; at least one of them is given. */
  | { type: 'move'; characterId: string; placement: Placement | null; depth: Depth | null; animation: AnimationSpec }
  | { type: 'expression'; characterId: string; expressionId: string }
  /** Pauses the typewriter; meaningful inline only. */
  | { type: 'wait'; seconds: number }

/** A command written after some text: it runs when the typewriter reaches `offset` in the page text. */
export type InlineStageCommand = StageCommand & { offset: number }

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
}

export interface StoredChoiceOption {
  id: string
  text: string
  valueId: string
  /** Offered only while this holds; always when null. */
  condition: StoredCondition | null
}

export type CounterOperator = '=' | '!=' | '<' | '<=' | '>' | '>='

export type StoredCondition =
  | { type: 'is'; decisionId: string; valueId: string; negated: boolean }
  /** The counter compared with `amount`: `Trust >= 3`. Since 1.3. */
  | { type: 'counter'; counterId: string; operator: CounterOperator; amount: number }
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

/** Adds `amount` to a counter, `[add: Trust -1]`, or gives it that value, `[set: Trust = 3]`. Since 1.3. */
export interface StoredCount {
  type: 'count'
  id: string
  counterId: string
  operation: 'add' | 'set'
  amount: number
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

/** The profile remembers this from now on, in every playthrough. */
export interface StoredRemember {
  type: 'remember'
  id: string
  memoryId: string
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

export type StoredNode = StoredPage | StoredStage | StoredChoice | StoredConditionNode | StoredLoop | StoredBreak | StoredPlay | StoredSet | StoredUnset | StoredCount | StoredDefinition | StoredEnding | StoredRemember

/** A list of nodes inside a block: a branch of a condition, or the body of a loop, which bears the loop's identifier. */
export interface InnerList {
  id: string
  nodes: StoredNode[]
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
      return [condition.counterId]
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
    chapterOrder: [],
    sceneOrder: [],
    decisions: [],
    counters: [],
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
    createdAt: now,
    updatedAt: now,
  }
}
