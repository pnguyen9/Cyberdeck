import { AuthorError } from '../i18n/errorMessages'
import type { ProjectStore } from './projectStore'

const DATABASE_NAME = 'cyberdeck-projects'
const DATABASE_VERSION = 1
const PROJECTS = 'projects'
/** Keyed `<project>/<chapter>` and `<project>/<asset>`, so that a project's entries form one key range. */
const CHAPTERS = 'chapters'
const ASSETS = 'assets'

/**
 * Projects in the browser's IndexedDB. The browser is asked to keep them even when space runs
 * short; backups remain the author's safety.
 */
export function createIndexedDbProjectStore(): ProjectStore {
  let database: Promise<IDBDatabase> | null = null
  const open = () => database ??= new Promise((resolve, reject) => {
    void navigator.storage?.persist?.().catch(() => false)
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      for (const store of [PROJECTS, CHAPTERS, ASSETS]) {
        request.result.createObjectStore(store)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new AuthorError(text => text.storageRefused))
  })
  /** Runs requests in one transaction, resolving with the last request's result once the transaction is done. */
  const run = async <Result>(stores: string[], mode: IDBTransactionMode, makeRequest: (transaction: IDBTransaction) => IDBRequest<Result> | void): Promise<Result | undefined> => {
    const transaction = (await open()).transaction(stores, mode)
    const request = makeRequest(transaction)
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(request?.result)
      transaction.onerror = () => reject(transaction.error ?? new AuthorError(text => text.saveFailed))
      transaction.onabort = () => reject(transaction.error ?? new AuthorError(text => text.saveFailed))
    })
  }
  const rangeOf = (projectId: string) => IDBKeyRange.bound(`${projectId}/`, `${projectId}/￿`)
  const urls = new Map<string, string>()
  const forgetUrl = (key: string) => {
    const url = urls.get(key)
    if (url !== undefined) {
      URL.revokeObjectURL(url)
      urls.delete(key)
    }
  }
  const readBlob = async (projectId: string, assetId: string): Promise<Blob> => {
    const blob: unknown = await run([ASSETS], 'readonly', transaction => transaction.objectStore(ASSETS).get(`${projectId}/${assetId}`))
    if (!(blob instanceof Blob)) {
      throw new AuthorError(text => text.fileMissing(assetId))
    }
    return blob
  }

  return {
    listProjects: async () => await run([PROJECTS], 'readonly', transaction => transaction.objectStore(PROJECTS).getAll()) ?? [],
    readProject: async projectId => await run([PROJECTS], 'readonly', transaction => transaction.objectStore(PROJECTS).get(projectId)) ?? null,
    readChapters: async projectId => await run([CHAPTERS], 'readonly', transaction => transaction.objectStore(CHAPTERS).getAll(rangeOf(projectId))) ?? [],
    writeProject: async project => {
      await run([PROJECTS], 'readwrite', transaction => transaction.objectStore(PROJECTS).put(project, project.id))
    },
    writeChapter: async (projectId, chapter) => {
      await run([CHAPTERS], 'readwrite', transaction => transaction.objectStore(CHAPTERS).put(chapter, `${projectId}/${chapter.id}`))
    },
    deleteChapter: async (projectId, chapterId) => {
      await run([CHAPTERS], 'readwrite', transaction => transaction.objectStore(CHAPTERS).delete(`${projectId}/${chapterId}`))
    },
    writeAsset: async (projectId, assetId, bytes, mediaType) => {
      forgetUrl(`${projectId}/${assetId}`)
      await run([ASSETS], 'readwrite', transaction => transaction.objectStore(ASSETS).put(new Blob([bytes], { type: mediaType }), `${projectId}/${assetId}`))
    },
    readAsset: async (projectId, assetId) => new Uint8Array(await (await readBlob(projectId, assetId)).arrayBuffer()),
    assetUrl: async (projectId, assetId) => {
      const key = `${projectId}/${assetId}`
      const known = urls.get(key)
      if (known !== undefined) {
        return known
      }
      const url = URL.createObjectURL(await readBlob(projectId, assetId))
      urls.set(key, url)
      return url
    },
    deleteAsset: async (projectId, assetId) => {
      forgetUrl(`${projectId}/${assetId}`)
      await run([ASSETS], 'readwrite', transaction => transaction.objectStore(ASSETS).delete(`${projectId}/${assetId}`))
    },
    deleteProject: async projectId => {
      [...urls.keys()].filter(key => key.startsWith(`${projectId}/`)).forEach(forgetUrl)
      await run([PROJECTS, CHAPTERS, ASSETS], 'readwrite', transaction => {
        transaction.objectStore(PROJECTS).delete(projectId)
        transaction.objectStore(CHAPTERS).delete(rangeOf(projectId))
        transaction.objectStore(ASSETS).delete(rangeOf(projectId))
      })
    },
  }
}
