import type { AnimationKind, AnimationSpec, Depth, Facing, FadeColor, Placement, PositionPreset, StageCommand, StageDefaults, TintName } from '../format/storyFormat'

/** An animation with the project defaults filled in. */
export interface ResolvedAnimation {
  kind: AnimationKind
  durationMs: number
  wait: boolean
}

export interface CharacterOnStage {
  characterId: string
  expressionId: string
  /** Centre of the character, in percent of the stage width. */
  x: number
  /** As the text chose; null lets `effectiveFacing` turn the character towards the middle. */
  facing: Facing | null
  depth: Depth
  entrance: ResolvedAnimation
  /** Duration of the glide to the current `x`; 0 to jump. */
  moveDurationMs: number
}

/** How a background appears: `fade`, `black`, `white`; any other name is a cut. */
export interface BackgroundTransition {
  name: string
  durationMs: number
}

/** Durations of what the text leaves to the player. */
export const EFFECT_DEFAULTS = { transitionMs: 800, shakeMs: 500, flashMs: 300, fadeMs: 1000 } as const

/** What the player sees and hears, apart from the text. Never modified: each change gives a new state. */
export interface StageState {
  backgroundId: string | null
  /** How the current background appeared, from the transition announced before it. */
  backgroundTransition: BackgroundTransition | null
  /** Announced by a transition command, used by the next background change. */
  nextTransition: BackgroundTransition | null
  /** The colour covering the screen after a fade out, until a fade in; and how long the last fade took. */
  cover: FadeColor | null
  coverFadeMs: number
  tint: TintName | null
  /** Over the whole stage, backgrounds and characters, until taken away. */
  illustrationId: string | null
  /** Text in a box, or over the whole screen: there, the pages of one screen pile up. */
  textMode: 'box' | 'full'
  /** The pages of the screen of full-screen text, oldest first: past a few, a new screen begins. */
  screenfulPageIds: readonly string[]
  musicId: string | null
  characters: CharacterOnStage[]
  /** How each character last left, for the interface to animate the exit. */
  departures: Readonly<Record<string, ResolvedAnimation>>
}

export const EMPTY_STAGE: StageState = {
  backgroundId: null,
  backgroundTransition: null,
  nextTransition: null,
  cover: null,
  coverFadeMs: 0,
  tint: null,
  illustrationId: null,
  textMode: 'box',
  screenfulPageIds: [],
  musicId: null,
  characters: [],
  departures: {},
}

/** What applying commands needs from the project. */
export interface StageContext {
  presetX: (presetId: string) => number | undefined
  defaults: StageDefaults
}

export function createStageContext(project: { positions: PositionPreset[]; stageDefaults: StageDefaults }): StageContext {
  const presets = new Map(project.positions.map(preset => [preset.id, preset.x]))
  return { presetX: presetId => presets.get(presetId), defaults: project.stageDefaults }
}

/**
 * Spots taken in turn by characters entering without a position: the first on the left, the
 * second on the right, so that two characters face each other, then the centre, then the edges.
 */
const AUTOMATIC_SLOTS = ['position-left', 'position-right', 'position-center', 'position-far-left', 'position-far-right']
const CENTER_X = 50
/** Two characters closer than this, in percent of the stage width, share a spot. */
const SAME_SPOT_DISTANCE = 5

/** The text's choice, else towards the middle of the stage: a character on the left looks right. */
export function effectiveFacing(character: CharacterOnStage): Facing | null {
  if (character.facing !== null) {
    return character.facing
  }
  if (character.x < CENTER_X) {
    return 'right'
  }
  return character.x > CENTER_X ? 'left' : null
}

/** Applies a command. Pauses are the typewriter's business and leave the stage unchanged. */
export function applyStageCommand(stage: StageState, command: StageCommand, context: StageContext): StageState {
  switch (command.type) {
    case 'background':
      return { ...stage, backgroundId: command.backgroundId, backgroundTransition: stage.nextTransition, nextTransition: null }
    case 'transition':
      return { ...stage, nextTransition: { name: command.name, durationMs: command.durationMs ?? EFFECT_DEFAULTS.transitionMs } }
    case 'fade':
      return { ...stage, cover: command.direction === 'out' ? command.color : null, coverFadeMs: command.durationMs ?? EFFECT_DEFAULTS.fadeMs }
    case 'tint':
      return { ...stage, tint: command.tint }
    case 'textMode':
      return command.mode === stage.textMode ? stage : { ...stage, textMode: command.mode, screenfulPageIds: [] }
    case 'clear':
      return { ...stage, screenfulPageIds: [] }
    case 'illustration':
      return { ...stage, illustrationId: command.illustrationId }
    case 'music':
      return { ...stage, musicId: command.musicId }
    case 'sound':
    case 'voice':
    case 'video':
    case 'shake':
    case 'flash':
      // Played by the interface as the command is reached: nothing stays on stage.
      return stage
    case 'enter': {
      const others = stage.characters.filter(onStage => onStage.characterId !== command.characterId)
      const character: CharacterOnStage = {
        characterId: command.characterId,
        expressionId: command.expressionId,
        x: placementX(command.placement, others, context),
        facing: command.facing,
        depth: command.depth ?? 'middle',
        entrance: resolveAnimation(command.animation, context.defaults.enter),
        moveDurationMs: 0,
      }
      return { ...stage, characters: [...others, character] }
    }
    case 'exit':
      if (!stage.characters.some(onStage => onStage.characterId === command.characterId)) {
        return stage
      }
      return {
        ...stage,
        characters: stage.characters.filter(onStage => onStage.characterId !== command.characterId),
        departures: { ...stage.departures, [command.characterId]: resolveAnimation(command.animation, context.defaults.exit) },
      }
    case 'move':
      return updateCharacter(stage, command.characterId, onStage => ({
        ...onStage,
        x: command.placement === null ? onStage.x : placementX(command.placement, stage.characters.filter(other => other.characterId !== command.characterId), context),
        depth: command.depth ?? onStage.depth,
        moveDurationMs: command.animation.kind === 'instant' ? 0 : command.animation.durationMs ?? context.defaults.move.durationMs,
      }))
    case 'expression':
      return updateCharacter(stage, command.characterId, onStage => ({ ...onStage, expressionId: command.expressionId }))
    case 'wait':
      return stage
  }
}

/** Pages one screen of full-screen text holds before a new one begins: two lines each, under the speaker's plate. */
export const PAGES_PER_SCREENFUL = 5

/** A page shown: in full-screen text, it joins the screen, or begins a new one when the screen is full. */
export function showPage(stage: StageState, pageId: string): StageState {
  if (stage.textMode !== 'full') {
    return stage
  }
  return { ...stage, screenfulPageIds: stage.screenfulPageIds.length >= PAGES_PER_SCREENFUL ? [pageId] : [...stage.screenfulPageIds, pageId] }
}

/** How long the typewriter holds the text for this command: pauses, and animations the text waits for. */
export function waitMillisecondsOf(command: StageCommand, context: StageContext): number {
  switch (command.type) {
    case 'wait':
      return command.seconds * 1000
    case 'fade':
      return command.durationMs ?? EFFECT_DEFAULTS.fadeMs
    case 'enter':
    case 'exit': {
      const animation = resolveAnimation(command.animation, context.defaults[command.type])
      return animation.wait && animation.kind !== 'instant' ? animation.durationMs : 0
    }
    case 'move':
      return command.animation.wait && command.animation.kind !== 'instant'
        ? command.animation.durationMs ?? context.defaults.move.durationMs
        : 0
    default:
      return 0
  }
}

function resolveAnimation(animation: AnimationSpec, defaults: { kind: AnimationKind; durationMs: number }): ResolvedAnimation {
  return { kind: animation.kind ?? defaults.kind, durationMs: animation.durationMs ?? defaults.durationMs, wait: animation.wait }
}

function placementX(placement: Placement, others: CharacterOnStage[], context: StageContext): number {
  switch (placement.type) {
    case 'exact':
      return placement.x
    case 'preset':
      return context.presetX(placement.presetId) ?? CENTER_X
    case 'auto': {
      const isFree = (x: number) => others.every(other => Math.abs(other.x - x) >= SAME_SPOT_DISTANCE)
      const freeSlot = AUTOMATIC_SLOTS.map(slot => context.presetX(slot)).find(x => x !== undefined && isFree(x))
      return freeSlot ?? CENTER_X
    }
  }
}

function updateCharacter(stage: StageState, characterId: string, update: (character: CharacterOnStage) => CharacterOnStage): StageState {
  if (!stage.characters.some(onStage => onStage.characterId === characterId)) {
    return stage
  }
  return { ...stage, characters: stage.characters.map(onStage => onStage.characterId === characterId ? update(onStage) : onStage) }
}
