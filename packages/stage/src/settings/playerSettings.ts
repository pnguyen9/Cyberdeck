import { DEFAULT_BINDINGS, type Bindings, type InputBinding, type PlayerAction } from '../input/bindings'

/** What a player chooses about how every game plays. */
export interface PlayerSettings {
  /** Characters shown per second; 0 shows each page whole at once. */
  textSpeed: number
  /** From 0 to 1. */
  musicVolume: number
  soundVolume: number
  /** Lines spoken, `[voice]`. */
  voiceVolume: number
  /** How fast auto mode reckons the player reads, in characters per second. */
  autoSpeed: number
  /** How much larger the text is drawn; the text box grows to hold it. */
  textScale: TextScale
  /** The text in a plain, open font, whatever the game's styles name. */
  readableFont: boolean
  /** The text box opaque, its border brighter. */
  strongContrast: boolean
  /** Pages and options read aloud by the voice of the browser or the system. */
  readAloud: boolean
  /** Timed choices wait for the player, however long they take. */
  untimedChoices: boolean
  /** The captions of videos that have them, over the picture. */
  captions: boolean
  /** How the name plate goes to the character speaking: sliding, jumping there, or staying put. */
  namePlateMotion: NamePlateMotion
  /** Where the name plate stays when it stays put. */
  namePlatePlace: NamePlatePlace
  /**
   * Less motion, as the system asks or chosen here: animated pictures show where they end or start,
   * pictures change without turning, the name plate jumps, the stage does not shake, a flash is a
   * soft glow.
   */
  motion: MotionChoice
  bindings: Bindings
}

export const NAME_PLATE_MOTIONS = ['slide', 'jump', 'fixed'] as const
export type NamePlateMotion = (typeof NAME_PLATE_MOTIONS)[number]
export const NAME_PLATE_PLACES = ['left', 'middle', 'right'] as const
export type NamePlatePlace = (typeof NAME_PLATE_PLACES)[number]

export const MOTION_CHOICES = ['system', 'less', 'full'] as const
export type MotionChoice = (typeof MOTION_CHOICES)[number]

export const TEXT_SPEED_RANGE = { slowest: 10, fastest: 150 } as const

export const AUTO_SPEED_RANGE = { slowest: 6, fastest: 40 } as const

export const TEXT_SCALES = [1, 1.25, 1.5] as const
export type TextScale = (typeof TEXT_SCALES)[number]

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  textSpeed: 45,
  musicVolume: 0.6,
  soundVolume: 0.8,
  voiceVolume: 1,
  autoSpeed: 18,
  textScale: 1,
  readableFont: false,
  strongContrast: false,
  readAloud: false,
  untimedChoices: false,
  captions: false,
  namePlateMotion: 'slide',
  namePlatePlace: 'left',
  motion: 'system',
  bindings: DEFAULT_BINDINGS,
}

/**
 * Settings read back from storage: what is missing or damaged takes its default, and an action
 * newer than the settings gets its default inputs.
 */
export function parsePlayerSettings(value: unknown): PlayerSettings {
  const fields = isRecord(value) ? value : {}
  const savedBindings = isRecord(fields.bindings) ? fields.bindings : {}
  const actions = Object.keys(DEFAULT_BINDINGS) as PlayerAction[]
  return {
    textSpeed: fields.textSpeed === 0 || (isNumber(fields.textSpeed) && fields.textSpeed >= TEXT_SPEED_RANGE.slowest && fields.textSpeed <= TEXT_SPEED_RANGE.fastest)
      ? fields.textSpeed
      : DEFAULT_PLAYER_SETTINGS.textSpeed,
    musicVolume: isVolume(fields.musicVolume) ? fields.musicVolume : DEFAULT_PLAYER_SETTINGS.musicVolume,
    soundVolume: isVolume(fields.soundVolume) ? fields.soundVolume : DEFAULT_PLAYER_SETTINGS.soundVolume,
    voiceVolume: isVolume(fields.voiceVolume) ? fields.voiceVolume : DEFAULT_PLAYER_SETTINGS.voiceVolume,
    autoSpeed: isNumber(fields.autoSpeed) && fields.autoSpeed >= AUTO_SPEED_RANGE.slowest && fields.autoSpeed <= AUTO_SPEED_RANGE.fastest ? fields.autoSpeed : DEFAULT_PLAYER_SETTINGS.autoSpeed,
    textScale: (TEXT_SCALES as readonly unknown[]).includes(fields.textScale) ? fields.textScale as TextScale : DEFAULT_PLAYER_SETTINGS.textScale,
    readableFont: fields.readableFont === true,
    strongContrast: fields.strongContrast === true,
    readAloud: fields.readAloud === true,
    untimedChoices: fields.untimedChoices === true,
    captions: fields.captions === true,
    namePlateMotion: (NAME_PLATE_MOTIONS as readonly unknown[]).includes(fields.namePlateMotion) ? fields.namePlateMotion as NamePlateMotion : DEFAULT_PLAYER_SETTINGS.namePlateMotion,
    namePlatePlace: (NAME_PLATE_PLACES as readonly unknown[]).includes(fields.namePlatePlace) ? fields.namePlatePlace as NamePlatePlace : DEFAULT_PLAYER_SETTINGS.namePlatePlace,
    motion: (MOTION_CHOICES as readonly unknown[]).includes(fields.motion) ? fields.motion as MotionChoice : DEFAULT_PLAYER_SETTINGS.motion,
    bindings: Object.fromEntries(actions.map(action => {
      const saved = savedBindings[action]
      return [action, Array.isArray(saved) ? saved.filter(isInputBinding) : DEFAULT_BINDINGS[action]]
    })) as Bindings,
  }
}

/** Settings kept in a `Storage` (`localStorage`) under one key; unreadable or unwritable storage keeps the defaults. */
export function createStorageSettingsStore(storage: () => Storage, key: string) {
  return {
    read(): PlayerSettings {
      try {
        return parsePlayerSettings(JSON.parse(storage().getItem(key) ?? 'null'))
      } catch {
        return DEFAULT_PLAYER_SETTINGS
      }
    },
    write(settings: PlayerSettings): boolean {
      try {
        storage().setItem(key, JSON.stringify(settings))
        return true
      } catch {
        return false
      }
    },
    /** Whether settings were written here: a game without its own uses the profile's. */
    has(): boolean {
      try {
        return storage().getItem(key) !== null
      } catch {
        return false
      }
    },
    remove() {
      try {
        storage().removeItem(key)
      } catch {
        // Storage refused: nothing was kept there to remove.
      }
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isVolume(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 1
}

function isInputBinding(value: unknown): value is InputBinding {
  if (!isRecord(value)) {
    return false
  }
  switch (value.type) {
    case 'key':
      return typeof value.code === 'string' && value.code !== ''
    case 'mouseButton':
      return Number.isInteger(value.button) && (value.button as number) >= 0 && (value.button as number) <= 4
    case 'wheel':
      return value.direction === 'up' || value.direction === 'down'
    default:
      return false
  }
}
