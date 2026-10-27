import { parseProgress, parseSave } from '@cyberdeck/core'
import { PROGRESS_SLOT, type SaveStore } from '@cyberdeck/stage'
import type { DesktopBridge } from '../../electron/bridge'
import { createDesktopInvoke } from '../desktop/desktopInvoke'
import type { ProfileStore } from './profileStore'

/** Profiles and saves of the desktop player: files on the disk, reached through the preload bridge. */
export function createDesktopProfileStore(bridge: DesktopBridge): ProfileStore {
  const invoke = createDesktopInvoke(bridge)

  return {
    choosesSaveFolder: true,
    list: () => invoke('profiles:list'),
    defaultSaveFolder: name => invoke('profiles:defaultSaveFolder', name),
    chooseFolder: () => invoke('profiles:chooseFolder'),
    create: (name, saveFolder) => invoke('profiles:create', name, saveFolder),
    rename: (profileId, name) => invoke('profiles:rename', profileId, name),
    remove: profileId => invoke('profiles:remove', profileId),
    use: profileId => invoke('profiles:use', profileId),
    changeSaveFolder: (profileId, saveFolder) => invoke('profiles:changeSaveFolder', profileId, saveFolder),
    saveStore: (profileId): SaveStore => {
      const readJson = async (gameId: string, slot: string): Promise<unknown> => {
        try {
          const text = await invoke('saves:read', profileId, gameId, slot)
          return text === null ? null : JSON.parse(text)
        } catch {
          return null
        }
      }
      const writeJson = async (gameId: string, slot: string, value: unknown) => {
        try {
          await invoke('saves:write', profileId, gameId, slot, JSON.stringify(value, null, 2))
          return true
        } catch {
          return false
        }
      }
      return {
        read: async (gameId, slot) => parseSave(await readJson(gameId, slot)),
        write: (gameId, slot, save) => writeJson(gameId, slot, save),
        readProgress: async gameId => parseProgress(await readJson(gameId, PROGRESS_SLOT)),
        writeProgress: (gameId, progress) => writeJson(gameId, PROGRESS_SLOT, progress),
      }
    },
  }
}
