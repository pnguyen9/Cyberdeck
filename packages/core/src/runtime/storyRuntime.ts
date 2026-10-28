import type {
  ChapterDocument,
  Decision,
  InlineStageCommand,
  StageCommand,
  StoredChoice,
  StoredCondition,
  StoredNode,
  StoredPage,
} from '../format/storyFormat'
import { flattenStoredNodes, innerListsOf } from '../format/storyFormat'
import { chaptersInOrder, scenesOf, type PlayableStory } from './playableStory'
import { applyStageCommand, createStageContext, EMPTY_STAGE, showPage, type StageContext, type StageState } from './stageState'

export type PlayerStep =
  | { type: 'page'; page: StoredPage }
  /** The choice as offered: only the options whose condition holds. */
  | { type: 'choice'; choice: StoredChoice }
  /** The end of the story, or of this path when an `[ending: …]` was reached. */
  | { type: 'end'; endingId: string | null }

/** Values held by each decision, by identifier. A decision nobody made yet is absent. */
export type DecisionState = Readonly<Record<string, readonly string[]>>

/** An option picked, in the order of the playthrough. */
export interface ChoiceRecord {
  choiceId: string
  optionId: string
}

export interface PlayerSnapshot {
  step: PlayerStep
  stage: StageState
  decisions: DecisionState
  /** Every option picked so far: the playthrough itself, from which it could be replayed. */
  choices: readonly ChoiceRecord[]
}

/** An effect played once as it is reached, leaving nothing on stage. */
export type Cue = Extract<StageCommand, { type: 'sound' | 'shake' | 'flash' }>

/** Where a playthrough stands, enough to resume it: what saves are made of. */
export interface RuntimeState {
  /**
   * The page or choice shown; null at the end of the story. Inside a scene, `playedFrom` holds the
   * plays it was reached through, outermost first, the first one in the chapter: where to go back to.
   */
  page: { chapterId: string; nodeId: string; playedFrom?: string[] } | null
  decisions: DecisionState
  stage: StageState
  choices: readonly ChoiceRecord[]
}

/** How closely a restored state matches what was saved, when the story changed in between. */
export type RestoreOutcome = 'exact' | 'chapterStart' | 'storyStart'

/** A past stop shown in the backlog; `stopIndex` is what `backTo` takes to return there. */
export type BacklogEntry =
  | { type: 'page'; page: StoredPage; stopIndex: number }
  | { type: 'choice'; choice: StoredChoice; optionText: string; stopIndex: number }

const START_SNAPSHOT: PlayerSnapshot = { step: { type: 'end', endingId: null }, stage: EMPTY_STAGE, decisions: {}, choices: [] }

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
  private readonly endingsSeenIds = new Set<string>()

  constructor(story: PlayableStory) {
    this.chapters = chaptersInOrder(story)
    this.scenes = scenesOf(story)
    this.decisionsById = new Map(story.project.decisions.map(decision => [decision.id, decision]))
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

  start() {
    this.isReplaying = false
    this.queuedCues = []
    this.chapterIndex = -1
    this.frames = []
    this.history = []
    this.currentSnapshot = START_SNAPSHOT
    this.playUntilStop()
  }

  exportState(): RuntimeState {
    const step = this.currentSnapshot.step
    const chapter = this.chapters[this.chapterIndex]
    const nodeId = step.type === 'page' ? step.page.id : step.type === 'choice' ? step.choice.id : null
    const playedFrom = this.frames.flatMap(frame => frame.playId === undefined ? [] : [frame.playId])
    return {
      page: chapter === undefined || nodeId === null ? null : { chapterId: chapter.id, nodeId, ...(playedFrom.length === 0 ? {} : { playedFrom }) },
      decisions: this.currentSnapshot.decisions,
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
   * The sounds, shakes and flashes to play now: those reached since the last call, going forward.
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
    return stage.screenfulPageIds.flatMap(pageId => this.pagesById?.get(pageId) ?? [])
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
          this.setStep({ type: 'page', page: node })
          return
        case 'choice': {
          // The step carries the choice as offered: options whose condition does not hold are left out.
          const options = node.options.filter(option => option.condition === null || this.holds(option.condition))
          if (options.length === 0) {
            break
          }
          this.setStep({ type: 'choice', choice: options.length === node.options.length ? node : { ...node, options } })
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
          this.rememberedIds.add(node.memoryId)
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

  private holds(condition: StoredCondition): boolean {
    switch (condition.type) {
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
    if ((command.type === 'sound' || command.type === 'shake' || command.type === 'flash') && !this.isReplaying) {
      this.queuedCues.push(command)
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
