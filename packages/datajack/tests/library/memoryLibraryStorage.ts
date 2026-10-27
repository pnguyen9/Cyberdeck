import type { ChapterDocument, GameManifest } from '@cyberdeck/core'
import type { LibraryStorage } from '../../src/library/gameLibrary'

/** Keeps the library in memory, counting asset writes; stored values go through JSON as on a disk. */
export function memoryLibraryStorage() {
  const manifests = new Map<string, string>()
  const chapters = new Map<string, string>()
  const assets = new Map<string, Uint8Array<ArrayBuffer>>()
  let assetWrites = 0
  const storage: LibraryStorage = {
    listManifests: async () => [...manifests.values()].map(text => JSON.parse(text) as unknown),
    readManifest: async gameId => {
      const text = manifests.get(gameId)
      return text === undefined ? null : JSON.parse(text) as unknown
    },
    writeManifest: async (gameId, manifest: GameManifest) => {
      manifests.set(gameId, JSON.stringify(manifest))
    },
    readChapter: async (gameId, chapterId) => {
      const text = chapters.get(`${gameId}/${chapterId}`)
      return text === undefined ? null : JSON.parse(text) as unknown
    },
    writeChapter: async (gameId, chapter: ChapterDocument) => {
      chapters.set(`${gameId}/${chapter.id}`, JSON.stringify(chapter))
    },
    hasAsset: async fileName => assets.has(fileName),
    writeAsset: async (fileName, bytes) => {
      assetWrites++
      assets.set(fileName, bytes)
    },
    assetUrl: async fileName => `memory:${fileName}`,
    removeGame: async gameId => {
      manifests.delete(gameId)
      for (const key of [...chapters.keys()].filter(key => key.startsWith(`${gameId}/`))) {
        chapters.delete(key)
      }
    },
    removeAssetsExcept: async fileNames => {
      for (const fileName of [...assets.keys()].filter(fileName => !fileNames.includes(fileName))) {
        assets.delete(fileName)
      }
    },
  }
  return { storage, assets, get assetWrites() { return assetWrites } }
}
