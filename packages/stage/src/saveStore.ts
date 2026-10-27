import { parseProgress, parseSave, type ProgressData, type SaveData } from '@cyberdeck/core'

/** `auto` is written at every page and choice; the others only when the player asks. */
export const AUTOSAVE_SLOT = 'auto'
/** Where the progress of a game sits beside its saves: the map, endings and pages read. */
export const PROGRESS_SLOT = 'progress'
export const MANUAL_SLOTS = ['1', '2', '3', '4', '5', '6'] as const

/** Where the saves of a profile are kept: files on the desktop, the browser's storage on the web. */
export interface SaveStore {
  /** Null when there is no save, or none that can be read. */
  read: (gameId: string, slot: string) => Promise<SaveData | null>
  /** False when the save could not be written: storage full or refused, disk error. */
  write: (gameId: string, slot: string, save: SaveData) => Promise<boolean>
  readProgress: (gameId: string) => Promise<ProgressData | null>
  writeProgress: (gameId: string, progress: ProgressData) => Promise<boolean>
}

/**
 * Keeps saves in a `Storage` (`localStorage` in the browser), under keys starting with `keyPrefix`.
 * Each write replaces one key as a whole, so an interrupted write never leaves half a save. Storage
 * can be missing or refuse access: reads then find nothing and writes report failure, without
 * breaking the game.
 */
export function createStorageSaveStore(getStorage: () => Pick<Storage, 'getItem' | 'setItem'>, keyPrefix: string): SaveStore {
  const keyOf = (gameId: string, slot: string) => `${keyPrefix}${gameId}:${slot}`
  const readJson = (gameId: string, slot: string): unknown => {
    try {
      const text = getStorage().getItem(keyOf(gameId, slot))
      return text === null ? null : JSON.parse(text)
    } catch {
      return null
    }
  }
  const writeJson = (gameId: string, slot: string, value: unknown) => {
    try {
      getStorage().setItem(keyOf(gameId, slot), JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
  return {
    read: async (gameId, slot) => parseSave(readJson(gameId, slot)),
    write: async (gameId, slot, save) => writeJson(gameId, slot, save),
    readProgress: async gameId => parseProgress(readJson(gameId, PROGRESS_SLOT)),
    writeProgress: async (gameId, progress) => writeJson(gameId, PROGRESS_SLOT, progress),
  }
}
