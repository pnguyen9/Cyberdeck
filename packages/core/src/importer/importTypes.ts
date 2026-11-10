/**
 * Result of importing a text (pasted or from a Word document) into chapters.
 *
 * This is a draft: nodes have no identifiers yet and names (characters, backgrounds…) are not
 * checked against the project. The editor assigns identifiers when it stores the draft.
 */

export type ImportKind = 'story' | 'chapter' | 'pages'

export const IMPORT_KINDS: readonly ImportKind[] = ['story', 'chapter', 'pages']

/** A bracketed instruction such as `[enter: marie left smile]`: name `enter`, arguments `marie`, `left`, `smile`. */
export interface Directive {
  /** Lower-cased, so writers can type `[BG: …]` or `[bg: …]`. */
  name: string
  arguments: string[]
  /** What follows the colon as written, commas included: for the few directives listing names or giving words to read. */
  written?: string
}

/** A directive written after some text: it fires when the typewriter reaches `offset` in the page text. */
export interface InlineDirective extends Directive {
  offset: number
}

export interface PageNode {
  type: 'page'
  /** Line of the input the node comes from, starting at 1. A long paragraph gives several pages with the same line. */
  sourceLine: number
  kind: 'narration' | 'dialogue'
  /** Null for narration, and for dash dialogue that names nobody. */
  speaker: string | null
  text: string
  /** Applied when the page appears, before its text is shown. */
  directivesBefore: Directive[]
  inlineDirectives: InlineDirective[]
  /** Parts of the text in a named style, from `[style: …]` to `[style: none]` or the end of the paragraph; absent when none. */
  styles?: StyleSpan[]
}

/** Characters `start` to `end` (excluded) of the page text, in the style of that name. */
export interface StyleSpan {
  start: number
  end: number
  style: string
}

/** `[style: Whisper = italic, small, grey]`: a style any text may then use by name. */
export interface StyleDeclaration {
  sourceLine: number
  name: string
  properties: string[]
}

/** Directives with no page to attach to: at the end of a chapter or branch, or before a choice or a block. */
export interface StageNode {
  type: 'stage'
  sourceLine: number
  directives: Directive[]
}

export interface ChoiceOption {
  sourceLine: number
  text: string
  /** Written after `=`, or the option's letter (`A`, `B`…) when the writer gave none. */
  value: string
  /** `[if: …]` on the option's line: it is offered only while this holds. */
  condition?: Condition
  /** `[timeout]` on the option's line: offered as the others, and taken when the time of the choice runs out. */
  timeout?: true
}

/** Offers options to the player; the one picked becomes the value of `decision`. */
export interface ChoiceNode {
  type: 'choice'
  sourceLine: number
  decision: string
  options: ChoiceOption[]
  /** `[choice: Answer 10s]`: the time the player has to pick. */
  timeLimitMs?: number
}

/** `[ask: Hero = Alex]`: the player gives a name, which `{Hero}` then shows; Alex until they do. */
export interface AskNode {
  type: 'ask'
  sourceLine: number
  name: string
  defaultName: string | null
}

/** A bound of a number asked for: a number written, or what a counter holds when it is asked. */
export type AskBound = { type: 'amount'; amount: number } | { type: 'counter'; counter: string }

/** `[ask number: Bet = 10, from 1 to {Money}]`: the player types a number, kept by a counter. */
export interface AskNumberNode {
  type: 'askNumber'
  sourceLine: number
  counter: string
  defaultAmount: number
  /** The decimals the number proposed is written with: those of a counter it makes. */
  decimals: number
  minimum: AskBound | null
  maximum: AskBound | null
}

export type Condition =
  | { type: 'is'; decision: string; value: string; negated: boolean }
  /** `remembered X`: the profile remembers it, from this playthrough or an earlier one. */
  | { type: 'remembered'; memory: string; negated: boolean }
  /** `seen ending X`: the profile has reached this ending in some playthrough. */
  | { type: 'endingSeen'; ending: string; negated: boolean }
  /**
   * `Trust >= 3`: a counter compared with a number. `Trust is 3` reads as `is`, a decision's test,
   * until the name is known to be a counter's.
   */
  | { type: 'compare'; counter: string; operator: '<' | '<=' | '>' | '>='; amount: number }
  | { type: 'and' | 'or'; conditions: Condition[] }
  /** Kept so that the branch still appears in the preview; the import reports it as an error. */
  | { type: 'invalid'; text: string }

export interface ConditionBranch {
  sourceLine: number
  /** Null for `[else]`. */
  condition: Condition | null
  nodes: StoryNode[]
}

/** `[if]`, `[else if]`…, `[else]`, `[end]`: the first branch whose condition holds is played. */
export interface ConditionNode {
  type: 'condition'
  sourceLine: number
  branches: ConditionBranch[]
}

/** `[set: Mood = Happy]`; or a counter's new value, `[set: Trust = 3]`, once the name is known to be a counter's. */
export interface SetNode {
  type: 'set'
  sourceLine: number
  decision: string
  value: string
}

/** `[add: Trust 2]`, `[add: Trust -1]`, `[add: Trust]` for one more. */
export interface AddNode {
  type: 'add'
  sourceLine: number
  counter: string
  amount: number
}

/**
 * Where a `[decision: …]`, `[counter: …]` or `[style: X = …]` is written, among the pages of a chapter: its
 * declaration lives there. Written before the first heading of a text that has headings, it is
 * none of its chapters', and no node marks it.
 */
export interface DefinitionNode {
  type: 'definition'
  sourceLine: number
  kind: 'decision' | 'counter' | 'style'
  name: string
}

/** `[unset: Clues = Key]` takes a value away; `[unset: Clues]` leaves the decision with none. */
export interface UnsetNode {
  type: 'unset'
  sourceLine: number
  decision: string
  value: string | null
}

/** `[ending: Name]`: the path ends here, and the player has reached this ending. */
export interface EndingNode {
  type: 'ending'
  sourceLine: number
  name: string
  /** `[ending: The Empty Room = La Chambre vide]`: what players read of it in the text's language. */
  shownAs?: string
}

/** `[remember: Name]`: the profile remembers it for good, across every later playthrough; `[forget: Name]` takes it away again. */
export interface RememberNode {
  type: 'remember'
  sourceLine: number
  name: string
  forget?: true
}

/** `[loop]` … `[end]`: plays its nodes again and again, until a `[break]` inside leaves it. */
export interface LoopNode {
  type: 'loop'
  sourceLine: number
  nodes: StoryNode[]
}

export interface BreakNode {
  type: 'break'
  sourceLine: number
}

/** `[play: Caught]`: plays the scene of that name, then goes on here unless it ended the story. */
export interface PlayNode {
  type: 'play'
  sourceLine: number
  scene: string
}

export type StoryNode = PageNode | StageNode | ChoiceNode | ConditionNode | LoopNode | BreakNode | PlayNode | SetNode | AddNode | AskNode | AskNumberNode | UnsetNode | DefinitionNode | EndingNode | RememberNode

/**
 * `[decision: Confession = Accept | Refuse]`, or `[decision multi: …]` when several values can hold at
 * once; `lasting` after either, its values kept from one playthrough to the next.
 */
export interface DecisionDeclaration {
  sourceLine: number
  name: string
  values: string[]
  multiple: boolean
  lasting: boolean
}

/** `[counter: Trust = 2]`, or `[counter: Trust]` starting at 0; `[counter lasting: …]`, its number kept from one playthrough to the next. */
export interface CounterDeclaration {
  sourceLine: number
  name: string
  initial: number
  /** The decimals it counts with, as its first number is written: `1000.00` two. */
  decimals: number
  lasting: boolean
}

export interface ImportedChapter {
  /** Null when the text starts with content before any `#` heading; a scene's name for a scene. */
  title: string | null
  sourceLine: number
  /** `[only if: …]` right under the heading: the chapter is played only when it holds. */
  condition?: Condition
  nodes: StoryNode[]
}

export type ImportProblemCode =
  | 'unknownImportKind'
  | 'unknownLanguage'
  | 'misplacedImportKind'
  | 'emptyDirective'
  | 'unclosedBracket'
  | 'emptyDialogue'
  | 'controlDirectiveWithText'
  | 'invalidDecision'
  | 'missingDecisionName'
  | 'optionOutsideChoice'
  | 'emptyOption'
  | 'emptyChoice'
  | 'invalidCondition'
  | 'elseWithoutIf'
  | 'endWithoutIf'
  | 'unclosedIf'
  | 'invalidSet'
  | 'invalidUnset'
  | 'decisionValueStillUsed'
  | 'definitionStillUsed'
  | 'notADefinition'
  | 'noJumps'
  | 'everyOptionConditional'
  | 'missingSceneName'
  | 'onlyIfMisplaced'
  | 'branchAfterElse'
  | 'invalidStyle'
  | 'styleWithoutText'
  | 'unknownStyle'
  | 'duplicateStyle'
  | 'unknownScene'
  | 'duplicateScene'
  | 'sceneCallsItself'
  | 'missingEndingName'
  | 'dashWithoutSpeaker'
  | 'speakerWithoutDash'
  | 'chapterHeadingInEdit'
  | 'missingMemoryName'
  | 'unknownEnding'
  | 'unknownMemory'
  | 'unknownDecision'
  | 'unknownDecisionValue'
  | 'duplicateDecision'
  | 'invalidCounter'
  | 'invalidAdd'
  | 'unknownCounter'
  | 'counterNeedsNumber'
  | 'counterTooPrecise'
  | 'invalidAskNumber'
  | 'clockReadOnly'
  | 'duplicateCounter'
  | 'counterNamedLikeDecision'
  | 'unsetCounter'
  | 'invalidAsk'
  | 'unknownValue'
  | 'askedNameTaken'
  | 'nameIsAsked'
  | 'unknownShown'
  | 'manyOptions'
  | 'timedChoiceWithoutTimeout'
  | 'timeoutWithoutTime'
  | 'severalTimeouts'
  | 'timeoutOutsideOption'
  | 'invalidStageDirective'
  | 'looksLikeStageKeyword'
  | 'unreachable'
  | 'breakOutsideLoop'
  | 'unclosedLoop'
  | 'endlessLoop'

/**
 * The message shown to the writer is built by the interface from `code`, so that it can be
 * translated; `subject` carries the offending value when there is one, `suggestion` what was
 * probably meant.
 */
export interface ImportProblem {
  severity: 'error' | 'warning'
  code: ImportProblemCode
  line: number
  subject?: string
  suggestion?: string
}

export interface ImportResult {
  /** Declared by `[import: …]` on the first line, null when the writer left it to the interface. */
  kind: ImportKind | null
  /** The language the text says it is written in, `[import: story fr]`, as a standard code; null when it says none. */
  language: string | null
  decisions: DecisionDeclaration[]
  counters: CounterDeclaration[]
  styles: StyleDeclaration[]
  chapters: ImportedChapter[]
  /** `# Scene: Name`: pages of no chapter, played wherever a `[play: Name]` is. */
  scenes: ImportedChapter[]
  /** `[shown: Bag, Trust]`, `[shown after an ending: …]`: what players may see, `endings reached` among the names for the endings. */
  shown: ShownDeclaration[]
  problems: ImportProblem[]
}

export interface ShownDeclaration {
  sourceLine: number
  names: string[]
  afterAnEnding: boolean
}
