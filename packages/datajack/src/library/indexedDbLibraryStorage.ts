import { MEDIA_TYPES_BY_EXTENSION } from '@cyberdeck/core'
import type { LibraryStorage } from './gameLibrary'

const DATABASE_NAME = 'datajack-library'
const DATABASE_VERSION = 1
const GAMES = 'games'
/** Keyed `<game>/<chapter>`, so that a game's chapters form one key range. */
const CHAPTERS = 'chapters'
const ASSETS = 'assets'

/**
 * Installed games in the browser's IndexedDB: unlike `localStorage`, it holds images and music,
 * and as much as the browser grants the site.
 */
export function createIndexedDbLibraryStorage(): LibraryStorage {
  let database: Promise<IDBDatabase> | null = null
  const open = () => database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      for (const store of [GAMES, CHAPTERS, ASSETS]) {
        request.result.createObjectStore(store)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The browser refused to store games'))
  })
  /** Runs requests in one transaction, resolving with the last request's result once the transaction is done. */
  const run = async <Result>(stores: string[], mode: IDBTransactionMode, makeRequest: (transaction: IDBTransaction) => IDBRequest<Result> | void): Promise<Result | undefined> => {
    const transaction = (await open()).transaction(stores, mode)
    const request = makeRequest(transaction)
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => reject(transaction.error ?? new Error('The browser could not store the game'))
      transaction.onabort = () => reject(transaction.error ?? new Error('The browser could not store the game'))
    })
  }
  const urls = new Map<string, string>()

  return {
    listManifests: async () => await run([GAMES], 'readonly', transaction => transaction.objectStore(GAMES).getAll()) ?? [],
    readManifest: async gameId => await run([GAMES], 'readonly', transaction => transaction.objectStore(GAMES).get(gameId)) ?? null,
    writeManifest: async (gameId, manifest) => {
      await run([GAMES], 'readwrite', transaction => transaction.objectStore(GAMES).put(manifest, gameId))
    },
    readChapter: async (gameId, chapterId) => await run([CHAPTERS], 'readonly', transaction => transaction.objectStore(CHAPTERS).get(`${gameId}/${chapterId}`)) ?? null,
    writeChapter: async (gameId, chapter) => {
      await run([CHAPTERS], 'readwrite', transaction => transaction.objectStore(CHAPTERS).put(chapter, `${gameId}/${chapter.id}`))
    },
    hasAsset: async fileName => (await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).count(fileName)) ?? 0) > 0,
    writeAsset: async (fileName, bytes) => {
      const blob = new Blob([bytes], { type: MEDIA_TYPES_BY_EXTENSION[fileName.slice(fileName.lastIndexOf('.') + 1)] ?? '' })
      await run([ASSETS], 'readwrite', transaction => transaction.objectStore(ASSETS).put(blob, fileName))
    },
    assetUrl: async fileName => {
      const known = urls.get(fileName)
      if (known !== undefined) {
        return known
      }
      const blob: unknown = await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).get(fileName))
      const url = blob instanceof Blob ? URL.createObjectURL(blob) : ''
      urls.set(fileName, url)
      return url
    },
    removeGame: async gameId => {
      await run([GAMES, CHAPTERS], 'readwrite', transaction => {
        transaction.objectStore(GAMES).delete(gameId)
        transaction.objectStore(CHAPTERS).delete(IDBKeyRange.bound(`${gameId}/`, `${gameId}/￿`))
      })
    },
    removeAssetsExcept: async fileNames => {
      const kept = new Set(fileNames)
      const stored = await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).getAllKeys()) ?? []
      const removed = stored.filter((key): key is string => typeof key === 'string' && !kept.has(key))
      await run([ASSETS], 'readwrite', transaction => {
        removed.forEach(fileName => transaction.objectStore(ASSETS).delete(fileName))
      })
      for (const fileName of removed) {
        const url = urls.get(fileName)
        if (url !== undefined) {
          URL.revokeObjectURL(url)
          urls.delete(fileName)
        }
      }
    },
  }
}
