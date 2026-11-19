import type { ChapterDocument, GameManifest } from '@cyberdeck/core'
import { GameLibrary, type LibraryStorage } from '../../src/library/gameLibrary'

/** The scratch library the earlier games are installed in, before they are moved where an earlier Datajack kept them. */
const EARLIER_SCRATCH = 'earlier-scratch'

/**
 * Keeps the libraries in memory, counting asset writes; stored values go through JSON as on a disk.
 * `addEarlier` installs a game as an earlier Datajack did, before each profile had its own library.
 */
export function memoryLibraryStorage() {
  /** `<profile>/<game>`, and `<profile>/<game>/<chapter>`. */
  const manifests = new Map<string, string>()
  const chapters = new Map<string, string>()
  /** `<game>`, and `<game>/<chapter>`. */
  const earlierManifests = new Map<string, string>()
  const earlierChapters = new Map<string, string>()
  const assets = new Map<string, Uint8Array<ArrayBuffer>>()
  let assetWrites = 0
  const gameKey = (profileId: string, gameId: string) => `${profileId}/${gameId}`
  const parse = (text: string | undefined) => text === undefined ? null : JSON.parse(text) as unknown
  const startingWith = (map: Map<string, string>, prefix: string) => [...map.keys()].filter(key => key.startsWith(prefix))
  const removeStartingWith = (map: Map<string, string>, prefix: string) => startingWith(map, prefix).forEach(key => map.delete(key))
  const storage: LibraryStorage = {
    listManifests: async profileId => startingWith(manifests, `${profileId}/`).map(key => parse(manifests.get(key))),
    readManifest: async (profileId, gameId) => parse(manifests.get(gameKey(profileId, gameId))),
    writeManifest: async (profileId, gameId, manifest: GameManifest) => {
      manifests.set(gameKey(profileId, gameId), JSON.stringify(manifest))
    },
    readChapter: async (profileId, gameId, chapterId) => parse(chapters.get(`${gameKey(profileId, gameId)}/${chapterId}`)),
    writeChapter: async (profileId, gameId, chapter: ChapterDocument) => {
      chapters.set(`${gameKey(profileId, gameId)}/${chapter.id}`, JSON.stringify(chapter))
    },
    hasAsset: async fileName => assets.has(fileName),
    writeAsset: async (fileName, bytes) => {
      assetWrites++
      assets.set(fileName, bytes)
    },
    readAsset: async fileName => assets.get(fileName)?.slice() ?? null,
    assetUrl: async fileName => `memory:${fileName}`,
    removeGame: async (profileId, gameId) => {
      manifests.delete(gameKey(profileId, gameId))
      removeStartingWith(chapters, `${gameKey(profileId, gameId)}/`)
    },
    removeLibrary: async profileId => {
      removeStartingWith(manifests, `${profileId}/`)
      removeStartingWith(chapters, `${profileId}/`)
    },
    listAllManifests: async () => [...earlierManifests.values(), ...manifests.values()].map(parse),
    removeAssetsExcept: async fileNames => {
      for (const fileName of [...assets.keys()].filter(fileName => !fileNames.includes(fileName))) {
        assets.delete(fileName)
      }
    },
    earlier: {
      listManifests: async () => [...earlierManifests.values()].map(parse),
      readChapter: async (gameId, chapterId) => parse(earlierChapters.get(`${gameId}/${chapterId}`)),
      removeGame: async gameId => {
        earlierManifests.delete(gameId)
        removeStartingWith(earlierChapters, `${gameId}/`)
      },
    },
  }

  /** Installs the game where an earlier Datajack kept it: installed in a scratch library, then moved there. */
  async function addEarlier(bytes: Uint8Array<ArrayBuffer>) {
    await new GameLibrary(storage).install(bytes, EARLIER_SCRATCH)
    const prefix = `${EARLIER_SCRATCH}/`
    for (const [from, to] of [[manifests, earlierManifests], [chapters, earlierChapters]] as const) {
      for (const key of startingWith(from, prefix)) {
        to.set(key.slice(prefix.length), from.get(key)!)
        from.delete(key)
      }
    }
  }

  return { storage, addEarlier, earlierChapters, assets, get assetWrites() { return assetWrites } }
}
