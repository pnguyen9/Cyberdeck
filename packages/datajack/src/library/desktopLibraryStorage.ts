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
    listManifests: async () => (await invoke('library:listManifests')).map(parse),
    readManifest: async gameId => parse(await invoke('library:readManifest', gameId)),
    writeManifest: (gameId, manifest) => invoke('library:writeManifest', gameId, JSON.stringify(manifest, null, 2)),
    readChapter: async (gameId, chapterId) => parse(await invoke('library:readChapter', gameId, chapterId)),
    writeChapter: (gameId, chapter) => invoke('library:writeChapter', gameId, chapter.id, JSON.stringify(chapter, null, 2)),
    hasAsset: fileName => invoke('library:hasAsset', fileName),
    writeAsset: (fileName, bytes) => invoke('library:writeAsset', fileName, bytes),
    assetUrl: async fileName => `${location.origin}${INSTALLED_ASSETS_PATH}${fileName}`,
    removeGame: gameId => invoke('library:removeGame', gameId),
    removeAssetsExcept: fileNames => invoke('library:removeAssetsExcept', [...fileNames]),
  }
}
