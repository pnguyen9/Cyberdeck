import type {
  ChapterDocument,
  CounterOperator,
  Decision,
  StageCommand,
  StoredChoice,
  StoredCondition,
  StoredNode,
  StoredPage,
} from '../format/storyFormat'
import { flattenStoredNodes, innerListsOf, MAXIMUM_GRID, type Counter, type ProjectDocument, type ClockValue, type ListPlace, type ListValue, type StoredGrid, type StoredListChange, type StoredTake, type StoredAsk, type StoredAskBound, type StoredAskNumber } from '../format/storyFormat'
import { givenName, pageWithValues, withValues, type ValueOf } from '../format/textValues'
import { normalizeName } from '../importer/storyNodes'
import { drawFrom, newSeed } from './chance'
import { withValueChosen } from '../format/valueTags'
import { listsOf } from '../format/lists'
import { savedAmount, scaleOf, unitsFromText, wholeAmount, writtenAmount } from '../format/counterNumbers'
import { valuesReader, type HeldValues } from './storyValues'
import { chaptersInOrder, scenesOf, type PlayableStory } from './playableStory'
import { applyStageCommand, createStageContext, EMPTY_STAGE, showPage, type StageContext, type StageState } from './stageState'

export type PlayerStep =
  | { type: 'page'; page: StoredPage }
  /** The choice as offered: only the options whose condition holds. */
  | { type: 'choice'; choice: StoredChoice }
  /** The player is asked for a name. */
  | { type: 'ask'; ask: StoredAsk }
  /**
   * The player is asked for a number, for a counter, within bounds worked out as it is asked (a
   * bound naming a counter is what it holds then), in the units of the counter asked for; null for
   * no bound. The number proposed is kept within them too.
   */
  | { type: 'askNumber'; ask: StoredAskNumber; minimum: number | null; maximum: number | null; proposed: number }
  /** A grid of picture buttons, each place with what its list holds there. */
  | { type: 'grid'; grid: StoredGrid; items: readonly string[] }
  /** The end of the story, or of this path when an `[ending: …]` was reached. */
  | { type: 'end'; endingId: string | null }

/** A value changed by hand, by an author testing the story: what a playthrough holds, or what the profile has. */
export type HeldChange =
  | { type: 'decision'; decisionId: string; valueIds: readonly string[] }
  | { type: 'counter'; counterId: string; units: number }
  | { type: 'name'; askedNameId: string; name: string }
  | { type: 'memory'; memoryId: string; isHeld: boolean }
  | { type: 'ending'; endingId: string; isHeld: boolean }

/** Values held by each decision, by identifier. A decision nobody made yet is absent. */
export type DecisionState = Readonly<Record<string, readonly string[]>>

/** Values of the counters changed so far, by identifier; one never changed holds its initial value. */
export type CounterState = Readonly<Record<string, number>>

/** What the lasting decisions and counters held when the profile last played, which a new game starts with. */
export interface LastingValues {
  decisions: DecisionState
  counters: CounterState
}

/** Names the player gave, by identifier of the asked name. */
export type NameState = Readonly<Record<string, string>>

/** An option picked, in the order of the playthrough. */
export interface ChoiceRecord {
  choiceId: string
  optionId: string
}

export interface PlayerSnapshot {
  step: PlayerStep
  stage: StageState
  decisions: DecisionState
  counters: CounterState
  names: NameState
  /** Where the draws of `random` stand: going back to a stop draws again what was drawn from it. */
  seed: number
  /** Every option picked so far: the playthrough itself, from which it could be replayed. */
  choices: readonly ChoiceRecord[]
  /** What each list holds, by identifier, for those changed so far. Since 3.0. */
  lists?: ListState
}

/** What each list changed so far holds, by identifier; one never changed holds what it starts with. */
export type ListState = Readonly<Record<string, readonly string[]>>

/** An effect played once as it is reached, leaving nothing on stage. */
export type Cue = Extract<StageCommand, { type: 'sound' | 'voice' | 'video' | 'shake' | 'flash' }>

const CUE_TYPES: ReadonlySet<StageCommand['type']> = new Set(['sound', 'voice', 'video', 'shake', 'flash'])

/** Where a playthrough stands, enough to resume it: what saves are made of. */
export interface RuntimeState {
  /**
   * The page or choice shown; null at the end of the story. Inside a scene, `playedFrom` holds the
   * plays it was reached through, outermost first, the first one in the chapter: where to go back to.
   */
  page: { chapterId: string; nodeId: string; playedFrom?: string[] } | null
  decisions: DecisionState
  counters: CounterState
  names: NameState
  /** Where the draws of `random` stand, so that a save resumed draws what it would have drawn. */
  seed: number
  stage: StageState
  choices: readonly ChoiceRecord[]
  lists?: ListState
}

/** How closely a restored state matches what was saved, when the story changed in between. */
export type RestoreOutcome = 'exact' | 'chapterStart' | 'storyStart'

/** A past stop shown in the backlog; `stopIndex` is what `backTo` takes to return there. */
export type BacklogEntry =
  | { type: 'page'; page: StoredPage; stopIndex: number }
  | { type: 'choice'; choice: StoredChoice; optionText: string; stopIndex: number }

const START_SNAPSHOT: PlayerSnapshot = { step: { type: 'end', endingId: null }, stage: EMPTY_STAGE, decisions: {}, counters: {}, names: {}, seed: 0, choices: [] }

/** A list of nodes being played, and the index of the next node to play in it. */
interface Frame {
  nodes: StoredNode[]
  index: number
  /** The body of a loop: played again from its start once finished. */
  repeats?: boolean
  /** The play node that started this scene, whose frame goes on once the scene is over. */
  playId?: string
}

/** Everything needed to come back to a stop (page, choice or end) exactly as it was. */
interface Stop {
  snapshot: PlayerSnapshot
  chapterIndex: number
  frames: Frame[]
}

/**
 * Nodes played in a row without reaching a page or a choice before the story is declared looping:
 * room for a game working through a whole board between two picks (an expert Minesweeper counting
 * and opening 480 cells), still found out in a fraction of a second.
 */
const MAXIMUM_SILENT_NODES = 200_000

/** Stops kept for going back; older ones are forgotten. */
const MAXIMUM_HISTORY_LENGTH = 500

/**
 * Plays a story: walks its nodes, evaluates conditions, records decisions and keeps the stage
 * state, stopping at each page and choice for the interface.
 *
 * Every change produces a new snapshot rather than modifying the previous one.
 */
export class StoryRuntime {
  private readonly chapters: ChapterDocument[]
  private readonly decisionsById: Map<string, Decision>
  private readonly initialCounts: ReadonlyMap<string, number>
  /** What `{…}` may name, by name normalised: a name the player gives, a counter, a decision. */
  private readonly readValues: (held: HeldValues) => ValueOf
  private readonly stageContext: StageContext
  private chapterIndex = -1
  private readonly scenes: ReadonlyMap<string, ChapterDocument>
  /** Every page of the story, for the screens of full-screen text: made when first needed. */
  private pagesById: ReadonlyMap<string, StoredPage> | undefined
  private frames: Frame[] = []
  /** One-off effects reached since the interface last took them; none while coming back to a stop already played. */
  private queuedCues: Cue[] = []
  private isReplaying = false
  private appliedInlineCommandCount = 0
  /** The tags before the page's text written after a `[wait]`: they play once the wait is over. */
  private pendingCommandsBefore: readonly StageCommand[] = []
  private currentSnapshot: PlayerSnapshot = START_SNAPSHOT
  /** Stops reached so far, the current one last. */
  private history: Stop[] = []
  /** What the profile remembers and the endings it has reached, over every playthrough: going back never forgets them. */
  private readonly rememberedIds = new Set<string>()
  /** Memories `[forget]` took away during this game, which the profile forgets too. */
  private readonly forgottenIds = new Set<string>()
  private readonly endingsSeenIds = new Set<string>()
  /** Decisions and counters declared `lasting`: a new game starts with what the profile kept of them. */
  private readonly lastingDecisionIds: ReadonlySet<string>
  private readonly lastingCounterIds: ReadonlySet<string>
  private lastingStart: LastingValues = { decisions: {}, counters: {} }
  /** The decimals of each counter that keeps some, by identifier: for bounds read from another counter. */
  private readonly counterDecimals: ReadonlyMap<string, number>
  /** Counters the clock gives, and the clock, once the player's is given. */
  private readonly clockCounters: readonly { id: string; clock: ClockValue }[]
  private readonly project: ProjectDocument
  /** What each list holds when a game starts. */
  private readonly initialLists: ReadonlyMap<string, readonly string[]>
  private clock: { now: () => Date; minutesAway: number } | null = null

  constructor(story: PlayableStory) {
    this.project = story.project
    this.initialLists = new Map(listsOf(story.project).map(list => [list.id, list.initial]))
    this.clockCounters = story.project.counters.flatMap(counter => counter.clock === undefined ? [] : [{ id: counter.id, clock: counter.clock }])
    this.counterDecimals = new Map(story.project.counters.flatMap(counter => counter.decimals === undefined ? [] : [[counter.id, counter.decimals] as const]))
    this.chapters = chaptersInOrder(story)
    this.scenes = scenesOf(story)
    this.decisionsById = new Map(story.project.decisions.map(decision => [decision.id, decision]))
    this.initialCounts = new Map(story.project.counters.map(counter => [counter.id, counter.initial]))
    this.readValues = valuesReader(story.project)
    this.lastingDecisionIds = new Set(story.project.decisions.filter(decision => decision.lasting === true).map(decision => decision.id))
    this.lastingCounterIds = new Set(story.project.counters.filter(counter => counter.lasting === true).map(counter => counter.id))
    this.stageContext = createStageContext(story.project)
  }

  /** Positions and animation defaults of the story, for the interface to time the text with animations. */
  get context(): StageContext {
    return this.stageContext
  }

  get snapshot(): PlayerSnapshot {
    return this.currentSnapshot
  }

  get canGoBack(): boolean {
    return this.history.length > 1
  }

  /** The chapter being played, a scene it plays included; null before the start. */
  get currentChapter(): ChapterDocument | null {
    return this.chapters[this.chapterIndex] ?? null
  }

  /** Gives the runtime what the profile already remembers and the endings it has reached, from its progress. */
  useMemory(memory: { memoryIds: readonly string[]; endingIds: readonly string[] }) {
    memory.memoryIds.forEach(memoryId => this.rememberedIds.add(memoryId))
    memory.endingIds.forEach(endingId => this.endingsSeenIds.add(endingId))
  }

  /** Memories of the profile, those `[remember]` added during this game included. */
  get memoryIds(): string[] {
    return [...this.rememberedIds]
  }

  /** Memories this game took away, so that the profile forgets them as well. */
  get forgottenMemoryIds(): string[] {
    return [...this.forgottenIds]
  }

  /**
   * Gives the runtime the player's clock, and how long the profile was away from the game, in
   * minutes: the clock's counters read them as the story plays. Without it, they hold 0.
   */
  useClock(clock: { now: () => Date; minutesAway: number }) {
    this.clock = clock
  }

  /** Gives the runtime the lasting values the profile kept, which the next `start` begins with. */
  useLasting(values: LastingValues) {
    this.lastingStart = this.lastingOf(values)
  }

  /** What the lasting decisions and counters hold now, for the profile to keep. */
  get lastingValues(): LastingValues {
    return this.lastingOf(this.currentSnapshot)
  }

  private lastingOf(values: LastingValues): LastingValues {
    return {
      decisions: Object.fromEntries(Object.entries(values.decisions).filter(([decisionId]) => this.lastingDecisionIds.has(decisionId))),
      counters: Object.fromEntries(Object.entries(values.counters).filter(([counterId]) => this.lastingCounterIds.has(counterId))),
    }
  }

  /**
   * Changes a value by hand, as an author testing the story may: a decision, a counter, a name
   * given, or what the profile remembers and the endings it has seen, which no way through one
   * playthrough could give. The page shown stays as it is; what follows reads the new value.
   */
  change(change: HeldChange) {
    const snapshot = this.currentSnapshot
    switch (change.type) {
      case 'decision': {
        const decisions = { ...snapshot.decisions }
        if (change.valueIds.length === 0) {
          delete decisions[change.decisionId]
        } else {
          decisions[change.decisionId] = [...change.valueIds]
        }
        this.currentSnapshot = { ...snapshot, decisions }
        break
      }
      case 'counter':
        // The clock's counters follow the clock: a value given by hand would not last past the next step.
        if (!this.clockCounters.some(counter => counter.id === change.counterId)) {
          this.currentSnapshot = { ...snapshot, counters: { ...snapshot.counters, [change.counterId]: change.units } }
        }
        break
      case 'name': {
        const names = { ...snapshot.names }
        const given = givenName(change.name)
        if (given === '') {
          delete names[change.askedNameId]
        } else {
          names[change.askedNameId] = given
        }
        this.currentSnapshot = { ...snapshot, names }
        break
      }
      case 'memory':
        if (change.isHeld) {
          this.rememberedIds.add(change.memoryId)
          this.forgottenIds.delete(change.memoryId)
        } else {
          this.rememberedIds.delete(change.memoryId)
          this.forgottenIds.add(change.memoryId)
        }
        break
      case 'ending':
        if (change.isHeld) {
          this.endingsSeenIds.add(change.endingId)
        } else {
          this.endingsSeenIds.delete(change.endingId)
        }
        break
    }
  }

  /** Endings the profile has reached, those of this game included. */
  get endingIds(): string[] {
    return [...this.endingsSeenIds]
  }

  /** Plays from the start of the story, its draws from `seed`: a new one each game unless told. */
  start(seed = newSeed()) {
    this.isReplaying = false
    this.queuedCues = []
    this.chapterIndex = -1
    this.frames = []
    this.history = []
    this.currentSnapshot = { ...START_SNAPSHOT, seed, decisions: { ...this.lastingStart.decisions }, counters: { ...this.lastingStart.counters } }
    this.playUntilStop()
  }

  exportState(): RuntimeState {
    const step = this.currentSnapshot.step
    const chapter = this.chapters[this.chapterIndex]
    const nodeId = nodeIdOf(step)
    const playedFrom = this.frames.flatMap(frame => frame.playId === undefined ? [] : [frame.playId])
    return {
      page: chapter === undefined || nodeId === null ? null : { chapterId: chapter.id, nodeId, ...(playedFrom.length === 0 ? {} : { playedFrom }) },
      decisions: this.currentSnapshot.decisions,
      counters: this.currentSnapshot.counters,
      names: this.currentSnapshot.names,
      seed: this.currentSnapshot.seed,
      ...(this.currentSnapshot.lists === undefined ? {} : { lists: this.currentSnapshot.lists }),
      stage: this.currentSnapshot.stage,
      choices: this.currentSnapshot.choices,
    }
  }

  /**
   * Resumes a playthrough. When the saved page no longer exists (the story was updated), resumes
   * at the start of its chapter, or failing that of the story, keeping the decisions made. There
   * is nothing to go back to before the restored stop.
   */
  restoreState(state: RuntimeState): RestoreOutcome {
    this.isReplaying = true
    this.queuedCues = []
    this.history = []
    this.chapterIndex = -1
    this.frames = []
    let outcome: RestoreOutcome = 'storyStart'

    const page = state.page
    if (page !== null) {
      for (const [chapterIndex, chapter] of this.chapters.entries()) {
        const frames = this.framesAlong(chapter.nodes, [...(page.playedFrom ?? []), page.nodeId])
        if (frames !== null) {
          this.chapterIndex = chapterIndex
          this.frames = frames
          outcome = 'exact'
          break
        }
      }
      const chapterIndex = this.chapters.findIndex(chapter => chapter.id === page.chapterId)
      if (outcome !== 'exact' && chapterIndex !== -1) {
        this.chapterIndex = chapterIndex
        this.frames = [{ nodes: this.chapters[chapterIndex]?.nodes ?? [], index: 0 }]
        outcome = 'chapterStart'
      }
    }

    // A page of full-screen text joins its screen as it is shown: played again here, it must not be there twice.
    const resumed = this.frames.at(-1)?.nodes[this.frames.at(-1)?.index ?? 0]
    const stage = outcome === 'storyStart' ? EMPTY_STAGE : state.stage
    this.currentSnapshot = {
      step: { type: 'end', endingId: null },
      stage: outcome === 'exact' && resumed?.type === 'page' && stage.screenfulPageIds.at(-1) === resumed.id
        ? { ...stage, screenfulPageIds: stage.screenfulPageIds.slice(0, -1) }
        : stage,
      decisions: state.decisions,
      counters: state.counters,
      names: state.names,
      seed: state.seed,
      choices: state.choices,
      ...(state.lists === undefined ? {} : { lists: state.lists }),
    }
    this.playUntilStop()
    return outcome
  }

  /** Past stops, oldest first, with the option picked at each choice. */
  backlog(): BacklogEntry[] {
    return this.history.slice(0, -1).flatMap((stop, stopIndex): BacklogEntry[] => {
      const step = stop.snapshot.step
      if (step.type === 'page') {
        return [{ type: 'page', page: step.page, stopIndex }]
      }
      if (step.type === 'choice') {
        const picked = this.history[stopIndex + 1]?.snapshot.choices.at(-1)
        const option = step.choice.options.find(candidate => candidate.id === picked?.optionId)
        return option === undefined ? [] : [{ type: 'choice', choice: step.choice, optionText: option.text, stopIndex }]
      }
      return []
    })
  }

  /** Goes back to a past stop of the backlog in one move. */
  backTo(stopIndex: number) {
    while (this.history.length - 1 > stopIndex && this.canGoBack) {
      this.back()
    }
  }

  /**
   * Returns to the previous stop as it was when reached: stage, decisions and page. Going
   * back past a choice undoes it, so that the player may pick another option.
   */
  back() {
    if (!this.canGoBack) {
      return
    }
    this.isReplaying = true
    this.queuedCues = []
    this.history.pop()
    const previousStop = this.history.at(-1)
    if (previousStop !== undefined) {
      this.currentSnapshot = previousStop.snapshot
      this.chapterIndex = previousStop.chapterIndex
      this.frames = copyFrames(previousStop.frames)
      this.appliedInlineCommandCount = 0
      this.pendingCommandsBefore = previousStop.snapshot.step.type === 'page' ? splitAtFirstWait(previousStop.snapshot.step.page.commandsBefore).afterWait : []
    }
  }

  /**
   * Called as the typewriter shows the page text: applies the tags waiting until `offset`, those
   * before the text a `[wait]` held back, then those written in the text up to there, and returns
   * them, so that the interface can act on those it handles itself (`wait`). `untilWait` stops after
   * the first `[wait]`, so that what follows it plays once it is over.
   */
  reachOffset(offset: number, untilWait = false): StageCommand[] {
    const step = this.currentSnapshot.step
    if (step.type !== 'page') {
      return []
    }
    const waiting: StageCommand[] = [
      ...this.pendingCommandsBefore,
      ...step.page.inlineCommands.slice(this.appliedInlineCommandCount).filter(command => command.offset <= offset),
    ]
    const waitAt = waiting.findIndex(command => command.type === 'wait')
    const reachedCommands = untilWait && waitAt !== -1 ? waiting.slice(0, waitAt + 1) : waiting
    const fromBefore = Math.min(reachedCommands.length, this.pendingCommandsBefore.length)
    this.pendingCommandsBefore = this.pendingCommandsBefore.slice(fromBefore)
    this.appliedInlineCommandCount += reachedCommands.length - fromBefore
    reachedCommands.forEach(command => this.applyToStage(command))
    return reachedCommands
  }

  /** Whether tags still wait to play by `offset`: held back by a `[wait]`. */
  hasCommandsWaiting(offset: number): boolean {
    const step = this.currentSnapshot.step
    return step.type === 'page' && (this.pendingCommandsBefore.length > 0 || (step.page.inlineCommands[this.appliedInlineCommandCount]?.offset ?? Number.POSITIVE_INFINITY) <= offset)
  }

  /**
   * The sounds, voices, videos, shakes and flashes to play now: those reached since the last call, going forward.
   * Coming back to a stop, by going back or restoring a save, plays none until the story moves on.
   */
  takeCues(): Cue[] {
    const cues = this.queuedCues
    this.queuedCues = []
    return cues
  }

  /**
   * In full-screen text, the pages of the screen shown, oldest first, the current one last; empty
   * in a text box. Pages the story no longer has, after an update, are left out.
   */
  screenfulPages(): StoredPage[] {
    // The stop as recorded, before its inline commands: a `[clear]` in the text takes effect at the next page.
    const stage = this.history.at(-1)?.snapshot.stage ?? this.currentSnapshot.stage
    if (stage.textMode !== 'full') {
      return []
    }
    this.pagesById ??= new Map([...this.chapters, ...this.scenes.values()]
      .flatMap(document => flattenStoredNodes(document.nodes))
      .flatMap(node => node.type === 'page' ? [[node.id, node] as const] : []))
    // Each page as it was shown, its values as they were then; after loading a save, with those of now.
    const shownPages = new Map(this.history.flatMap(stop => stop.snapshot.step.type === 'page' ? [[stop.snapshot.step.page.id, stop.snapshot.step.page] as const] : []))
    const valueOf = this.valueOf()
    return stage.screenfulPageIds.flatMap(pageId => {
      const shown = shownPages.get(pageId)
      if (shown !== undefined) {
        return [shown]
      }
      const page = this.pagesById?.get(pageId)
      return page === undefined ? [] : [pageWithValues(page, valueOf)]
    })
  }

  /** A text with the values the story keeps in place of `{…}`: a speaker named `{Hero}`, for instance. */
  withValues(text: string): string {
    return withValues(text, this.valueOf())
  }

  /** Gives the name asked for, cut to the longest allowed; nothing typed keeps the default. */
  answer(typed: string) {
    const step = this.currentSnapshot.step
    if (step.type !== 'ask') {
      return
    }
    this.isReplaying = false
    const name = givenName(typed)
    const names = { ...this.currentSnapshot.names }
    if (name === '') {
      delete names[step.ask.askedNameId]
    } else {
      names[step.ask.askedNameId] = name
    }
    this.currentSnapshot = { ...this.currentSnapshot, names }
    this.playUntilStop()
  }

  /**
   * Gives the number asked for, in the counter's units, kept within the bounds; null takes the
   * number proposed.
   */
  answerNumber(units: number | null) {
    const step = this.currentSnapshot.step
    if (step.type !== 'askNumber') {
      return
    }
    this.isReplaying = false
    const given = within(units ?? step.proposed, step.minimum, step.maximum)
    this.currentSnapshot = { ...this.currentSnapshot, counters: { ...this.currentSnapshot.counters, [step.ask.counterId]: given } }
    this.playUntilStop()
  }

  /** Picks a place of the grid shown, from 1: its counter takes that number. */
  pickCell(number: number, isMark = false) {
    const step = this.currentSnapshot.step
    if (step.type !== 'grid' || number < 1 || number > step.grid.columns * step.grid.rows || (isMark && step.grid.markCounterId === undefined)) {
      return
    }
    this.isReplaying = false
    // Picked, the grid's counter takes the number and the marking one 0; marked, the other way round.
    const markCounterId = step.grid.markCounterId
    const units = (counterId: string, wanted: boolean) => (wanted ? number : 0) * scaleOf(this.counterOf(counterId))
    this.currentSnapshot = {
      ...this.currentSnapshot,
      counters: {
        ...this.currentSnapshot.counters,
        [step.grid.counterId]: units(step.grid.counterId, !isMark),
        ...(markCounterId === undefined ? {} : { [markCounterId]: units(markCounterId, isMark) }),
      },
    }
    this.playUntilStop()
  }

  /** Leaves the current page; inline commands not reached yet still apply. */
  next() {
    if (this.currentSnapshot.step.type !== 'page') {
      return
    }
    this.isReplaying = false
    this.reachOffset(Number.POSITIVE_INFINITY)
    this.playUntilStop()
  }

  choose(optionId: string) {
    const step = this.currentSnapshot.step
    if (step.type !== 'choice') {
      return
    }
    const option = step.choice.options.find(candidate => candidate.id === optionId)
    if (option === undefined) {
      throw new Error(`No option ${optionId} in the current choice`)
    }
    this.isReplaying = false
    this.decide(step.choice.decisionId, option.valueId)
    this.currentSnapshot = {
      ...this.currentSnapshot,
      choices: [...this.currentSnapshot.choices, { choiceId: step.choice.id, optionId: option.id }],
    }
    this.playUntilStop()
  }

  private playUntilStop() {
    this.readClock()
    for (let silentNodeCount = 0; silentNodeCount < MAXIMUM_SILENT_NODES; silentNodeCount++) {
      const frame = this.frames.at(-1)
      if (frame === undefined) {
        this.chapterIndex++
        const chapter = this.chapters[this.chapterIndex]
        if (chapter?.condition !== undefined && !this.holds(chapter.condition)) {
          continue
        }
        if (chapter === undefined) {
          this.setStep({ type: 'end', endingId: null })
          return
        }
        this.frames = [{ nodes: chapter.nodes, index: 0 }]
        continue
      }

      const node = frame.nodes[frame.index]
      if (node === undefined) {
        if (frame.repeats === true) {
          frame.index = 0
        } else {
          this.frames.pop()
        }
        continue
      }
      frame.index++

      switch (node.type) {
        case 'page': {
          // A `[wait]` holds back the tags written after it: they play as the text begins.
          const { untilWait, afterWait } = splitAtFirstWait(node.commandsBefore)
          untilWait.forEach(command => this.applyToStage(command))
          this.currentSnapshot = { ...this.currentSnapshot, stage: showPage(this.currentSnapshot.stage, node.id) }
          this.appliedInlineCommandCount = 0
          this.pendingCommandsBefore = afterWait
          this.setStep({ type: 'page', page: pageWithValues(node, this.valueOf()) })
          return
        }
        case 'choice': {
          // The step carries the choice as offered: options whose condition does not hold are left out,
          // and a choice none of whose options holds is skipped.
          const options = node.options.filter(option => option.condition === null || this.holds(option.condition))
          if (options.length === 0) {
            break
          }
          const valueOf = this.valueOf()
          const shown = options.map(option => option.text.includes('{') ? { ...option, text: withValues(option.text, valueOf) } : option)
          const isUnchanged = shown.length === node.options.length && shown.every((option, index) => option === node.options[index])
          this.setStep({ type: 'choice', choice: isUnchanged ? node : { ...node, options: shown } })
          return
        }
        case 'ask':
          this.setStep({ type: 'ask', ask: node })
          return
        case 'grid': {
          // A size given by counters, `grid {Columns} × {Rows}`, is read now, within what a grid may be.
          const sized = (counterId: string | undefined, written: number, largest: number) => counterId === undefined ? written
            : within(this.wholeCountOf(counterId), 1, largest)
          const grid = {
            ...node,
            columns: sized(node.columnsFrom, node.columns, MAXIMUM_GRID.columns),
            rows: sized(node.rowsFrom, node.rows, MAXIMUM_GRID.rows),
            ...(node.caption === undefined ? {} : { caption: withValues(node.caption, this.valueOf()) }),
          }
          const items = this.listOf(node.listId)
          this.setStep({ type: 'grid', grid, items: Array.from({ length: grid.columns * grid.rows }, (_, index) => items[index] ?? '') })
          return
        }
        case 'askNumber': {
          const minimum = this.boundOf(node.minimum, node.counterId, 'up')
          const maximum = this.boundOf(node.maximum, node.counterId, 'down')
          this.setStep({ type: 'askNumber', ask: node, minimum, maximum, proposed: within(node.defaultAmount, minimum, maximum) })
          return
        }
        case 'stage':
          node.commands.forEach(command => this.applyToStage(command))
          break
        case 'set':
          this.decide(node.decisionId, node.valueId)
          break
        case 'list':
          this.changeList(node)
          break
        case 'take': {
          const items = this.listOf(node.listId)
          if (items.length > 0) {
            const taken = node.end === 'first' ? items[0]! : items.at(-1)!
            this.setList(node.listId, node.end === 'first' ? items.slice(1) : items.slice(0, -1))
            this.giveTaken(node.into, taken)
          }
          break
        }
        case 'copy': {
          const name = this.heldValueName(node.fromDecisionId)
          const value = name === undefined ? undefined : this.valueNamed(node.decisionId, name)
          if (value !== undefined) {
            this.decide(node.decisionId, value.id)
          }
          break
        }
        case 'draw': {
          const decision = this.decisionsById.get(node.decisionId)
          const leftOut = node.notInDecisionId === null ? new Set<string>()
            : new Set(this.heldValues(node.notInDecisionId).map(valueId => normalizeName(this.decisionsById.get(node.notInDecisionId!)?.values.find(value => value.id === valueId)?.name ?? '')))
          const candidates = (decision?.values ?? []).filter(value => !leftOut.has(normalizeName(value.name)))
          if (candidates.length > 0) {
            const draw = drawFrom(this.currentSnapshot.seed)
            this.currentSnapshot = { ...this.currentSnapshot, seed: draw.seed }
            this.decide(node.decisionId, candidates[Math.floor(draw.fraction * candidates.length)]!.id)
          }
          break
        }
        case 'unset':
          this.undecide(node.decisionId, node.valueId)
          break
        case 'count': {
          // Another counter's value, `{Bet} * 2.5`, in this counter's units, rounded to what it keeps.
          const amount = node.fromItem !== undefined ? unitsFromText(this.itemAt(node.fromItem.listId, node.fromItem.place), this.counterOf(node.counterId)) ?? 0
            : node.from === undefined ? node.amount : Math.round(this.inUnitsOf(this.countOf(node.from.counterId), node.from.counterId, node.counterId) * node.from.factor)
          let count = node.operation === 'add' ? this.countOf(node.counterId) + amount : amount
          let seed = this.currentSnapshot.seed
          if (node.operation === 'random') {
            const draw = drawFrom(seed)
            seed = draw.seed
            count = node.amount + Math.floor(draw.fraction * ((node.maximum ?? node.amount) - node.amount + 1))
          }
          this.currentSnapshot = { ...this.currentSnapshot, seed, counters: { ...this.currentSnapshot.counters, [node.counterId]: count } }
          break
        }
        case 'condition': {
          const branch = node.branches.find(candidate => candidate.condition === null || this.holds(candidate.condition))
          if (branch !== undefined) {
            this.frames.push({ nodes: branch.nodes, index: 0 })
          }
          break
        }
        case 'loop':
          this.frames.push({ nodes: node.nodes, index: 0, repeats: true })
          break
        case 'break': {
          // The import refuses a break outside any loop, a loop of the scene playing included: one would do nothing.
          const loopFrameIndex = this.frames.findLastIndex(candidate => candidate.repeats === true)
          if (loopFrameIndex > this.frames.findLastIndex(candidate => candidate.playId !== undefined)) {
            this.frames.length = loopFrameIndex
          }
          break
        }
        case 'play': {
          const scene = this.scenes.get(node.sceneId)
          if (scene !== undefined) {
            this.frames.push({ nodes: scene.nodes, index: 0, playId: node.id })
          }
          break
        }
        case 'ending':
          this.endingsSeenIds.add(node.endingId)
          this.setStep({ type: 'end', endingId: node.endingId })
          return
        case 'remember':
          // Neither is undone by going back: what the game knows, it knows whatever the player takes back.
          if (node.forget === true) {
            this.rememberedIds.delete(node.memoryId)
            this.forgottenIds.add(node.memoryId)
          } else {
            this.rememberedIds.add(node.memoryId)
            this.forgottenIds.delete(node.memoryId)
          }
          break
      }
    }
    throw new Error('The story loops without showing any page or choice')
  }

  /**
   * The frames down to the last node of the path, through the scenes its plays start: each play is
   * passed, so that the scene comes back after it. Null when the path no longer leads there.
   */
  private framesAlong(chapterNodes: StoredNode[], path: readonly string[]): Frame[] | null {
    let frames = framesLeadingTo(chapterNodes, path[0] ?? '')
    for (const nodeId of path.slice(1)) {
      const playFrame = frames?.at(-1)
      const play = playFrame?.nodes[playFrame.index]
      const scene = play?.type === 'play' ? this.scenes.get(play.sceneId) : undefined
      const sceneFrames = scene === undefined ? null : framesLeadingTo(scene.nodes, nodeId)
      if (frames === null || playFrame === undefined || play === undefined || sceneFrames === null) {
        return null
      }
      playFrame.index++
      sceneFrames[0]!.playId = play.id
      frames = [...frames, ...sceneFrames]
    }
    return frames
  }

  /** Own entries only: a decision identifier from a downloaded game may be `constructor` or `__proto__`. */
  private heldValues(decisionId: string): readonly string[] {
    return Object.hasOwn(this.currentSnapshot.decisions, decisionId) ? this.currentSnapshot.decisions[decisionId] ?? [] : []
  }

  /** What `{…}` shows, from the values held now. */
  private valueOf(): ValueOf {
    return this.readValues(this.currentSnapshot)
  }

  /**
   * A bound in the units of the counter asked for: a number as stored, or what a counter holds now,
   * rounded towards the inside when it keeps more decimals.
   */
  private boundOf(bound: StoredAskBound | null, askedCounterId: string, rounding: 'up' | 'down'): number | null {
    if (bound === null) {
      return null
    }
    if (bound.type === 'amount') {
      return bound.amount
    }
    const scaled = this.inUnitsOf(this.countOf(bound.counterId), bound.counterId, askedCounterId)
    return rounding === 'up' ? Math.ceil(scaled) : Math.floor(scaled)
  }

  /** The clock's counters as the clock reads now: the hour, the day of the week, the time away. */
  private readClock() {
    if (this.clockCounters.length === 0 || this.clock === null) {
      return
    }
    const now = this.clock.now()
    const values: Record<ClockValue, number> = {
      hour: now.getHours(),
      // Monday 1 to Sunday 7, as most of the world counts the days of the week.
      weekday: ((now.getDay() + 6) % 7) + 1,
      timeAway: Math.max(0, Math.floor(this.clock.minutesAway)),
      now: Math.floor(now.getTime() / 1000),
    }
    const counters = { ...this.currentSnapshot.counters }
    for (const counter of this.clockCounters) {
      counters[counter.id] = values[counter.clock]
    }
    this.currentSnapshot = { ...this.currentSnapshot, counters }
  }

  /** A number in one counter's units, in another's: hundredths of a dollar as whole dollars, or back. */
  private inUnitsOf(units: number, fromCounterId: string, toCounterId: string): number {
    return units * 10 ** ((this.counterOf(toCounterId).decimals ?? 0) - (this.counterOf(fromCounterId).decimals ?? 0))
  }

  /** How a counter keeps its numbers: its decimals, none when it keeps whole numbers. */
  private counterOf(counterId: string): Pick<Counter, 'decimals'> {
    return { decimals: this.counterDecimals.get(counterId) ?? 0 }
  }

  /** What a counter holds now, as a whole number. */
  private wholeCountOf(counterId: string): number {
    return wholeAmount(this.countOf(counterId), this.counterOf(counterId))
  }

  /** What a list holds now. */
  private listOf(listId: string): readonly string[] {
    const lists = this.currentSnapshot.lists ?? {}
    return Object.hasOwn(lists, listId) ? lists[listId] ?? [] : this.initialLists.get(listId) ?? []
  }

  /** Gives a list its new values: an array of its own, which nothing else changes afterwards. */
  private setList(listId: string, items: readonly string[]) {
    this.currentSnapshot = { ...this.currentSnapshot, lists: { ...this.currentSnapshot.lists, [listId]: items } }
  }

  /** The number of a place: written, or what a counter holds, whole. */
  private placeNumber(place: ListPlace): number {
    return place.type === 'number' ? place.number : this.wholeCountOf(place.counterId)
  }

  /** What a place of a list holds; nothing outside the list. */
  private itemAt(listId: string, place: ListPlace): string {
    return this.listOf(listId)[this.placeNumber(place) - 1] ?? ''
  }

  /** A value as text: written, a decision's value, a counter's number, another place's value. */
  private textOf(value: ListValue): string {
    switch (value.type) {
      case 'text':
        return value.text
      case 'decision':
        return this.heldValueName(value.decisionId) ?? ''
      case 'counter':
        return writtenAmount(this.countOf(value.counterId), this.counterOf(value.counterId))
      case 'item':
        return this.itemAt(value.listId, value.place)
    }
  }

  private changeList(node: StoredListChange) {
    const items = [...this.listOf(node.listId)]
    switch (node.change.type) {
      case 'set': {
        // A place past the end makes the list longer, the places between holding nothing.
        const index = this.placeNumber(node.change.place) - 1
        if (index < 0 || index >= 10_000) {
          return
        }
        while (items.length <= index) {
          items.push('')
        }
        items[index] = this.textOf(node.change.value)
        break
      }
      case 'add':
        items.push(this.textOf(node.change.value))
        break
      case 'shuffle': {
        // Fisher–Yates, from the seed: a save resumed shuffles as the game would have.
        let seed = this.currentSnapshot.seed
        for (let index = items.length - 1; index > 0; index--) {
          const draw = drawFrom(seed)
          seed = draw.seed
          const other = Math.floor(draw.fraction * (index + 1))
          ;[items[index], items[other]] = [items[other]!, items[index]!]
        }
        this.currentSnapshot = { ...this.currentSnapshot, seed }
        break
      }
      case 'clear':
        items.length = 0
        break
    }
    this.setList(node.listId, items)
  }

  /** A value taken out of a list, into a counter (as a number) or a decision (as the value of that name). */
  private giveTaken(into: StoredTake['into'], taken: string) {
    if (into.type === 'counter') {
      const units = unitsFromText(taken, this.counterOf(into.counterId))
      if (units !== null) {
        this.currentSnapshot = { ...this.currentSnapshot, counters: { ...this.currentSnapshot.counters, [into.counterId]: units } }
      }
      return
    }
    const value = this.valueNamed(into.decisionId, taken)
    if (value !== undefined) {
      this.decide(into.decisionId, value.id)
    }
  }

  /** The name of the value a decision holds, its first for a decision holding several. */
  private heldValueName(decisionId: string): string | undefined {
    const heldId = this.heldValues(decisionId)[0]
    return this.decisionsById.get(decisionId)?.values.find(value => value.id === heldId)?.name
  }

  /** A decision's value named as given, whatever the case or spacing. */
  private valueNamed(decisionId: string, name: string) {
    const wanted = normalizeName(name)
    return this.decisionsById.get(decisionId)?.values.find(value => normalizeName(value.name) === wanted)
  }

  private countOf(counterId: string): number {
    return Object.hasOwn(this.currentSnapshot.counters, counterId) ? this.currentSnapshot.counters[counterId] ?? 0 : this.initialCounts.get(counterId) ?? 0
  }

  private holds(condition: StoredCondition): boolean {
    switch (condition.type) {
      case 'counter':
        if (condition.otherCounterId !== undefined) {
          // Two counters compared as numbers, whatever decimals each keeps.
          return compare(savedAmount(this.countOf(condition.counterId), this.counterOf(condition.counterId)), condition.operator, savedAmount(this.countOf(condition.otherCounterId), this.counterOf(condition.otherCounterId)))
        }
        return compare(this.countOf(condition.counterId), condition.operator, condition.amount)
      case 'is': {
        const isHeld = this.heldValues(condition.decisionId).includes(condition.valueId)
        return condition.negated ? !isHeld : isHeld
      }
      case 'listItem':
        return (normalizeName(this.itemAt(condition.listId, condition.place)) === normalizeName(this.textOf(condition.value))) !== condition.negated
      case 'listSize':
        return compare(this.listOf(condition.listId).length, condition.operator, condition.amount)
      case 'remembered':
        return this.rememberedIds.has(condition.memoryId) !== condition.negated
      case 'endingSeen':
        return this.endingsSeenIds.has(condition.endingId) !== condition.negated
      case 'and':
        return condition.conditions.every(part => this.holds(part))
      case 'or':
        return condition.conditions.some(part => this.holds(part))
    }
  }

  private decide(decisionId: string, valueId: string) {
    const heldValues = this.heldValues(decisionId)
    const values = this.decisionsById.get(decisionId)?.multiple
      ? [...heldValues.filter(heldValue => heldValue !== valueId), valueId]
      : [valueId]
    this.currentSnapshot = { ...this.currentSnapshot, decisions: { ...this.currentSnapshot.decisions, [decisionId]: values } }
  }

  private undecide(decisionId: string, valueId: string | null) {
    const values = valueId === null ? [] : this.heldValues(decisionId).filter(heldValue => heldValue !== valueId)
    this.currentSnapshot = { ...this.currentSnapshot, decisions: { ...this.currentSnapshot.decisions, [decisionId]: values } }
  }

  private applyToStage(written: StageCommand) {
    // A picture a decision's value names is the one it names now.
    const command = withValueChosen(written, this.project, this.currentSnapshot.decisions)
    if (CUE_TYPES.has(command.type) && !this.isReplaying) {
      this.queuedCues.push(command as Cue)
    }
    const stage = applyStageCommand(this.currentSnapshot.stage, command, this.stageContext)
    if (stage !== this.currentSnapshot.stage) {
      this.currentSnapshot = { ...this.currentSnapshot, stage }
    }
  }

  /** Every step is a stop: it is recorded so that the player can come back to it. */
  private setStep(step: PlayerStep) {
    this.currentSnapshot = { ...this.currentSnapshot, step }
    this.history.push({ snapshot: this.currentSnapshot, chapterIndex: this.chapterIndex, frames: copyFrames(this.frames) })
    if (this.history.length > MAXIMUM_HISTORY_LENGTH) {
      this.history.shift()
    }
  }
}

function compare(count: number, operator: CounterOperator, amount: number): boolean {
  switch (operator) {
    case '=':
      return count === amount
    case '!=':
      return count !== amount
    case '<':
      return count < amount
    case '<=':
      return count <= amount
    case '>':
      return count > amount
    case '>=':
      return count >= amount
  }
}

/** Frames advance as nodes are played: stops keep their own copies. Node lists are never modified, so they are shared. */
function copyFrames(frames: Frame[]): Frame[] {
  return frames.map(frame => ({ ...frame }))
}

/** The frames from `nodes` down to the node, each pointing at the node that leads further down. */
function framesLeadingTo(nodes: StoredNode[], nodeId: string): Frame[] | null {
  for (const [index, node] of nodes.entries()) {
    if (node.id === nodeId) {
      return [{ nodes, index }]
    }
    for (const list of innerListsOf(node)) {
      const innerFrames = framesLeadingTo(list.nodes, nodeId)
      if (innerFrames !== null) {
        const [listFrame, ...deeperFrames] = innerFrames
        return [{ nodes, index: index + 1 }, { ...listFrame!, ...(node.type === 'loop' ? { repeats: true } : {}) }, ...deeperFrames]
      }
    }
  }
  return null
}

/** The tags before a page's text: those played on arriving, up to the first `[wait]`, and those it holds back. */
export function splitAtFirstWait(commands: readonly StageCommand[]): { untilWait: readonly StageCommand[]; afterWait: readonly StageCommand[] } {
  const waitAt = commands.findIndex(command => command.type === 'wait')
  return waitAt === -1 ? { untilWait: commands, afterWait: [] } : { untilWait: commands.slice(0, waitAt + 1), afterWait: commands.slice(waitAt + 1) }
}

/** The node a player stops at: a page, a choice, a question; null at the end or before the start. */
export function nodeIdOf(step: PlayerStep): string | null {
  return step.type === 'page' ? step.page.id : step.type === 'choice' ? step.choice.id : step.type === 'ask' || step.type === 'askNumber' ? step.ask.id : step.type === 'grid' ? step.grid.id : null
}

/** A number kept within bounds; a highest bound below the lowest gives the lowest. */
function within(units: number, minimum: number | null, maximum: number | null): number {
  const capped = maximum === null ? units : Math.min(units, maximum)
  return minimum === null ? capped : Math.max(capped, minimum)
}
