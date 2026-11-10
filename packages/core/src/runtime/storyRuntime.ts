import type {
  ChapterDocument,
  CounterOperator,
  Decision,
  InlineStageCommand,
  StageCommand,
  StoredChoice,
  StoredCondition,
  StoredNode,
  StoredPage,
} from '../format/storyFormat'
import { flattenStoredNodes, innerListsOf, type AskedName, type ClockValue, type StoredAsk, type StoredAskBound, type StoredAskNumber } from '../format/storyFormat'
import { givenName, pageWithValues, withValues, type ValueOf } from '../format/textValues'
import { normalizeName } from '../importer/storyNodes'
import { drawFrom, newSeed } from './chance'
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
}

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

/** Nodes played in a row without reaching a page or a choice before the story is declared looping. */
const MAXIMUM_SILENT_NODES = 10_000

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
  private clock: { now: () => Date; minutesAway: number } | null = null

  constructor(story: PlayableStory) {
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
        this.currentSnapshot = { ...snapshot, counters: { ...snapshot.counters, [change.counterId]: change.units } }
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
    const nodeId = step.type === 'page' ? step.page.id : step.type === 'choice' ? step.choice.id : step.type === 'ask' || step.type === 'askNumber' ? step.ask.id : null
    const playedFrom = this.frames.flatMap(frame => frame.playId === undefined ? [] : [frame.playId])
    return {
      page: chapter === undefined || nodeId === null ? null : { chapterId: chapter.id, nodeId, ...(playedFrom.length === 0 ? {} : { playedFrom }) },
      decisions: this.currentSnapshot.decisions,
      counters: this.currentSnapshot.counters,
      names: this.currentSnapshot.names,
      seed: this.currentSnapshot.seed,
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
    }
  }

  /**
   * Called as the typewriter shows the page text: applies the inline commands written up to
   * `offset` and returns them, so that the interface can act on those it handles itself (`wait`).
   */
  reachOffset(offset: number): InlineStageCommand[] {
    const step = this.currentSnapshot.step
    if (step.type !== 'page') {
      return []
    }
    const reachedCommands = step.page.inlineCommands
      .slice(this.appliedInlineCommandCount)
      .filter(command => command.offset <= offset)
    this.appliedInlineCommandCount += reachedCommands.length
    reachedCommands.forEach(command => this.applyToStage(command))
    return reachedCommands
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
        case 'page':
          node.commandsBefore.forEach(command => this.applyToStage(command))
          this.currentSnapshot = { ...this.currentSnapshot, stage: showPage(this.currentSnapshot.stage, node.id) }
          this.appliedInlineCommandCount = 0
          this.setStep({ type: 'page', page: pageWithValues(node, this.valueOf()) })
          return
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
        case 'unset':
          this.undecide(node.decisionId, node.valueId)
          break
        case 'count': {
          let count = node.operation === 'add' ? this.countOf(node.counterId) + node.amount : node.amount
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

  /** Own entries only, as for decisions. */
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
    const decimalsOf = (counterId: string) => this.counterDecimals.get(counterId) ?? 0
    const scaled = this.countOf(bound.counterId) * 10 ** (decimalsOf(askedCounterId) - decimalsOf(bound.counterId))
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
    }
    const counters = { ...this.currentSnapshot.counters }
    for (const counter of this.clockCounters) {
      counters[counter.id] = values[counter.clock]
    }
    this.currentSnapshot = { ...this.currentSnapshot, counters }
  }

  private countOf(counterId: string): number {
    return Object.hasOwn(this.currentSnapshot.counters, counterId) ? this.currentSnapshot.counters[counterId] ?? 0 : this.initialCounts.get(counterId) ?? 0
  }

  private holds(condition: StoredCondition): boolean {
    switch (condition.type) {
      case 'counter':
        return compare(this.countOf(condition.counterId), condition.operator, condition.amount)
      case 'is': {
        const isHeld = this.heldValues(condition.decisionId).includes(condition.valueId)
        return condition.negated ? !isHeld : isHeld
      }
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

  private applyToStage(command: StageCommand) {
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

/** A number kept within bounds; a highest bound below the lowest gives the lowest. */
function within(units: number, minimum: number | null, maximum: number | null): number {
  const capped = maximum === null ? units : Math.min(units, maximum)
  return minimum === null ? capped : Math.max(capped, minimum)
}
