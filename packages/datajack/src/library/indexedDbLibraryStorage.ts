import { MEDIA_TYPES_BY_EXTENSION } from '@cyberdeck/core'
import type { LibraryStorage } from './gameLibrary'

const DATABASE_NAME = 'datajack-library'
/** 2 gave each profile its own library. */
const DATABASE_VERSION = 2
/** The games stored before each profile had its own library, copied into each then removed. */
const GAMES = 'games'
/** Keyed `<game>/<chapter>`, so that a game's chapters form one key range. */
const CHAPTERS = 'chapters'
const ASSETS = 'assets'
/** The manifests of each profile's library, keyed `<profile>/<game>`, so that a library forms one key range. */
const PROFILE_GAMES = 'profileGames'
/** Keyed `<profile>/<game>/<chapter>`. */
const PROFILE_CHAPTERS = 'profileChapters'

/** The keys starting with that prefix. */
const startingWith = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}\uffff`)

/**
 * Another tab or window of Datajack, from before the library changed shape, still holds it open: the
 * library cannot be read until that one is closed. Worded for the player by `describeError`.
 */
export class LibraryBlockedError extends Error {
  constructor() {
    super('The library is held open by another Datajack tab or window')
    this.name = 'LibraryBlockedError'
  }
}

/**
 * Installed games in the browser's IndexedDB: unlike `localStorage`, it holds images and music,
 * and as much as the browser grants the site.
 */
export function createIndexedDbLibraryStorage(): LibraryStorage {
  let database: Promise<IDBDatabase> | null = null
  const open = () => database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let isRefused = false
    const refuse = (error: Error) => {
      isRefused = true
      // Forgotten, so that the next action of the player tries again.
      database = null
      reject(error)
    }
    request.onupgradeneeded = () => {
      // A library from an older version keeps its stores; only those missing are made.
      for (const store of [GAMES, CHAPTERS, ASSETS, PROFILE_GAMES, PROFILE_CHAPTERS].filter(name => !request.result.objectStoreNames.contains(name))) {
        request.result.createObjectStore(store)
      }
    }
    request.onblocked = () => refuse(new LibraryBlockedError())
    request.onsuccess = () => {
      const opened = request.result
      // Once the player closed the other tab, an opening already refused here may still succeed: unused, it is closed.
      if (isRefused) {
        opened.close()
        return
      }
      // A newer Datajack opened in another tab needs the library to change shape: this one lets go of it.
      opened.onversionchange = () => {
        opened.close()
        database = null
      }
      resolve(opened)
    }
    request.onerror = () => refuse(request.error ?? new Error('The browser refused to store games'))
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

  const gameKey = (profileId: string, gameId: string) => `${profileId}/${gameId}`

  return {
    listManifests: async profileId => await run([PROFILE_GAMES], 'readonly', transaction => transaction.objectStore(PROFILE_GAMES).getAll(startingWith(`${profileId}/`))) ?? [],
    readManifest: async (profileId, gameId) => await run([PROFILE_GAMES], 'readonly', transaction => transaction.objectStore(PROFILE_GAMES).get(gameKey(profileId, gameId))) ?? null,
    writeManifest: async (profileId, gameId, manifest) => {
      await run([PROFILE_GAMES], 'readwrite', transaction => transaction.objectStore(PROFILE_GAMES).put(manifest, gameKey(profileId, gameId)))
    },
    readChapter: async (profileId, gameId, chapterId) => await run([PROFILE_CHAPTERS], 'readonly', transaction =>
      transaction.objectStore(PROFILE_CHAPTERS).get(`${gameKey(profileId, gameId)}/${chapterId}`)) ?? null,
    writeChapter: async (profileId, gameId, chapter) => {
      await run([PROFILE_CHAPTERS], 'readwrite', transaction => transaction.objectStore(PROFILE_CHAPTERS).put(chapter, `${gameKey(profileId, gameId)}/${chapter.id}`))
    },
    hasAsset: async fileName => (await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).count(fileName)) ?? 0) > 0,
    writeAsset: async (fileName, bytes) => {
      const blob = new Blob([bytes], { type: MEDIA_TYPES_BY_EXTENSION[fileName.slice(fileName.lastIndexOf('.') + 1)] ?? '' })
      await run([ASSETS], 'readwrite', transaction => transaction.objectStore(ASSETS).put(blob, fileName))
    },
    readAsset: async fileName => {
      const blob: unknown = await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).get(fileName))
      return blob instanceof Blob ? new Uint8Array(await blob.arrayBuffer()) : null
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
    removeGame: async (profileId, gameId) => {
      await run([PROFILE_GAMES, PROFILE_CHAPTERS], 'readwrite', transaction => {
        transaction.objectStore(PROFILE_GAMES).delete(gameKey(profileId, gameId))
        transaction.objectStore(PROFILE_CHAPTERS).delete(startingWith(`${gameKey(profileId, gameId)}/`))
      })
    },
    removeLibrary: async profileId => {
      await run([PROFILE_GAMES, PROFILE_CHAPTERS], 'readwrite', transaction => {
        transaction.objectStore(PROFILE_GAMES).delete(startingWith(`${profileId}/`))
        transaction.objectStore(PROFILE_CHAPTERS).delete(startingWith(`${profileId}/`))
      })
    },
    listAllManifests: async () => {
      let requests: IDBRequest<unknown[]>[] = []
      await run([GAMES, PROFILE_GAMES], 'readonly', transaction => {
        requests = [GAMES, PROFILE_GAMES].map(store => transaction.objectStore(store).getAll())
      })
      return requests.flatMap(request => request.result)
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
    earlier: {
      listManifests: async () => await run([GAMES], 'readonly', transaction => transaction.objectStore(GAMES).getAll()) ?? [],
      readChapter: async (gameId, chapterId) => await run([CHAPTERS], 'readonly', transaction => transaction.objectStore(CHAPTERS).get(`${gameId}/${chapterId}`)) ?? null,
      removeGame: async gameId => {
        await run([GAMES, CHAPTERS], 'readwrite', transaction => {
          transaction.objectStore(GAMES).delete(gameId)
          transaction.objectStore(CHAPTERS).delete(startingWith(`${gameId}/`))
        })
      },
    },
  }
}
