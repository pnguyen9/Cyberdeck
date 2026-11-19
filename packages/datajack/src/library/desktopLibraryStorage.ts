import { INSTALLED_ASSETS_PATH, type DesktopBridge } from '../../electron/bridge'
import { createDesktopInvoke } from '../desktop/desktopInvoke'
import type { LibraryStorage } from './gameLibrary'

/** Installed games as files in the desktop player's data folder, reached through the preload bridge. */
export function createDesktopLibraryStorage(bridge: DesktopBridge): LibraryStorage {
  const invoke = createDesktopInvoke(bridge)
  const parse = (text: string | null): unknown => {
    if (text === null) {
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return {
    listManifests: async profileId => (await invoke('library:listManifests', profileId)).map(parse),
    readManifest: async (profileId, gameId) => parse(await invoke('library:readManifest', profileId, gameId)),
    writeManifest: (profileId, gameId, manifest) => invoke('library:writeManifest', profileId, gameId, JSON.stringify(manifest, null, 2)),
    readChapter: async (profileId, gameId, chapterId) => parse(await invoke('library:readChapter', profileId, gameId, chapterId)),
    writeChapter: (profileId, gameId, chapter) => invoke('library:writeChapter', profileId, gameId, chapter.id, JSON.stringify(chapter, null, 2)),
    hasAsset: fileName => invoke('library:hasAsset', fileName),
    writeAsset: (fileName, bytes) => invoke('library:writeAsset', fileName, bytes),
    readAsset: async fileName => {
      const bytes = await invoke('library:readAsset', fileName)
      // Crossing processes, the bytes may arrive in a view of a larger buffer: copied into their own.
      return bytes === null ? null : new Uint8Array(bytes)
    },
    assetUrl: async fileName => `${location.origin}${INSTALLED_ASSETS_PATH}${fileName}`,
    removeGame: (profileId, gameId) => invoke('library:removeGame', profileId, gameId),
    removeLibrary: profileId => invoke('library:removeLibrary', profileId),
    listAllManifests: async () => (await invoke('library:listAllManifests')).map(parse),
    removeAssetsExcept: fileNames => invoke('library:removeAssetsExcept', [...fileNames]),
    earlier: {
      listManifests: async () => (await invoke('library:listEarlierManifests')).map(parse),
      readChapter: async (gameId, chapterId) => parse(await invoke('library:readEarlierChapter', gameId, chapterId)),
      removeGame: gameId => invoke('library:removeEarlierGame', gameId),
    },
  }
}
