import { normalizeName } from '../importer/storyNodes'
import type { PositionWord, StageInstruction } from '../stage/stageDirectives'
import type {
  Background,
  Character,
  Environment,
  Expression,
  MusicTrack,
  SoundEffect,
  Illustration,
  Placement,
  PositionPreset,
  ProjectDocument,
  StageCommand,
} from './storyFormat'

/** What an import added to the registry, for the import preview: a typo shows up here as an unexpected entry. */
export interface RegistryCreations {
  characters: string[]
  expressions: { character: string; expression: string }[]
  backgrounds: string[]
  music: string[]
  sounds: string[]
  illustrations: string[]
}

/** Expression of a character entering without one: `[enter: marie left]`. */
const DEFAULT_EXPRESSION = 'normal'

/**
 * The project's characters, backgrounds, music, sounds and illustrations plus those an import creates, found by name
 * ignoring case. Works on copies: the project given is left untouched.
 */
export class StageRegistry {
  readonly characters: Character[]
  readonly backgrounds: Background[]
  readonly music: MusicTrack[]
  readonly sounds: SoundEffect[]
  readonly positions: readonly PositionPreset[]
  readonly illustrations: Illustration[]
  readonly created: RegistryCreations = { characters: [], expressions: [], backgrounds: [], music: [], sounds: [], illustrations: [] }

  constructor(project: ProjectDocument, private readonly environment: Environment) {
    this.characters = project.characters.map(character => ({ ...character, expressions: [...character.expressions] }))
    this.backgrounds = [...project.backgrounds]
    this.music = [...project.music]
    this.sounds = [...project.sounds]
    this.illustrations = [...project.illustrations]
    this.positions = project.positions
  }

  vocabulary() {
    return { characterNames: this.characters.map(character => character.name), positionNames: this.positions.map(preset => preset.name) }
  }

  character(name: string): Character {
    let character = findNamed(this.characters, name)
    if (character === undefined) {
      character = { id: this.environment.createId(), name, expressions: [], drawnFacing: null }
      this.characters.push(character)
      this.created.characters.push(name)
    }
    return character
  }

  expression(character: Character, name: string): Expression {
    let expression = findNamed(character.expressions, name)
    if (expression === undefined) {
      expression = { id: this.environment.createId(), name, assetId: null }
      character.expressions.push(expression)
      this.created.expressions.push({ character: character.name, expression: name })
    }
    return expression
  }

  background(name: string): Background {
    let background = findNamed(this.backgrounds, name)
    if (background === undefined) {
      background = { id: this.environment.createId(), name, assetId: null }
      this.backgrounds.push(background)
      this.created.backgrounds.push(name)
    }
    return background
  }

  musicTrack(name: string): MusicTrack {
    let track = findNamed(this.music, name)
    if (track === undefined) {
      track = { id: this.environment.createId(), name, assetId: null }
      this.music.push(track)
      this.created.music.push(name)
    }
    return track
  }

  illustration(name: string): Illustration {
    let illustration = findNamed(this.illustrations, name)
    if (illustration === undefined) {
      illustration = { id: this.environment.createId(), name, assetId: null }
      this.illustrations.push(illustration)
      this.created.illustrations.push(name)
    }
    return illustration
  }

  soundEffect(name: string): SoundEffect {
    let sound = findNamed(this.sounds, name)
    if (sound === undefined) {
      sound = { id: this.environment.createId(), name, assetId: null }
      this.sounds.push(sound)
      this.created.sounds.push(name)
    }
    return sound
  }

  /** Preset names were checked by the import, which only recognizes the project's presets. */
  placement(position: PositionWord): Placement {
    if (position.type === 'exact') {
      return { type: 'exact', x: position.x }
    }
    const preset = findNamed([...this.positions], position.name)
    if (preset === undefined) {
      throw new Error(`Unknown position "${position.name}"`)
    }
    return { type: 'preset', presetId: preset.id }
  }

  /** The command for an instruction, creating the entries it names. */
  resolve(instruction: StageInstruction): StageCommand {
    switch (instruction.type) {
      case 'background':
        return { type: 'background', backgroundId: this.background(instruction.background).id }
      case 'transition':
        return { type: 'transition', name: instruction.name, durationMs: instruction.durationMs }
      case 'shake':
      case 'flash':
      case 'fade':
      case 'tint':
      case 'textMode':
      case 'clear':
        return instruction
      case 'illustration':
        return { type: 'illustration', illustrationId: instruction.illustration === null ? null : this.illustration(instruction.illustration).id }
      case 'music':
        return { type: 'music', musicId: instruction.track === null ? null : this.musicTrack(instruction.track).id }
      case 'sound':
        return { type: 'sound', soundId: this.soundEffect(instruction.sound).id }
      case 'enter': {
        const character = this.character(instruction.character)
        return {
          type: 'enter',
          characterId: character.id,
          expressionId: this.expression(character, instruction.expression ?? DEFAULT_EXPRESSION).id,
          placement: instruction.position === null ? { type: 'auto' } : this.placement(instruction.position),
          facing: instruction.facing,
          depth: instruction.depth,
          animation: instruction.animation,
        }
      }
      case 'exit':
        return { type: 'exit', characterId: this.character(instruction.character).id, animation: instruction.animation }
      case 'move':
        return {
          type: 'move',
          characterId: this.character(instruction.character).id,
          placement: instruction.position === null ? null : this.placement(instruction.position),
          depth: instruction.depth,
          animation: instruction.animation,
        }
      case 'expression': {
        const character = this.character(instruction.character)
        return { type: 'expression', characterId: character.id, expressionId: this.expression(character, instruction.expression).id }
      }
      case 'wait':
        return { type: 'wait', seconds: instruction.seconds }
    }
  }
}

function findNamed<Entry extends { name: string }>(entries: Entry[], name: string): Entry | undefined {
  return entries.find(entry => normalizeName(entry.name) === normalizeName(name))
}
