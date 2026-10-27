import { DEFAULT_BINDINGS, type Bindings, type InputBinding, type PlayerAction } from '../input/bindings'

/** What a player chooses about how every game plays. */
export interface PlayerSettings {
  /** Characters shown per second; 0 shows each page whole at once. */
  textSpeed: number
  /** From 0 to 1. */
  musicVolume: number
  soundVolume: number
  bindings: Bindings
}

export const TEXT_SPEED_RANGE = { slowest: 10, fastest: 150 } as const

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  textSpeed: 45,
  musicVolume: 0.6,
  soundVolume: 0.8,
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
