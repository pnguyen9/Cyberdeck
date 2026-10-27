import { checkReferences, createProject, importText, storeImport, StoryRuntime, toSave } from '@cyberdeck/core'
import { describe, expect, it } from 'vitest'
import { createStorageSaveStore } from '../src/saveStore'
import { memoryStorage } from './memoryStorage'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

function someSave() {
  const imported = importText('Hello.', { layout: monospaceLayout, locale: 'en' })
  expect(checkReferences(imported)).toEqual([])
  const stored = storeImport(imported, createProject({ name: 'Test', locale: 'en' }), { fileName: null })
  const story = { project: stored.project, chapters: stored.chapters, assetUrls: new Map<string, string>() }
  const runtime = new StoryRuntime(story)
  runtime.start()
  return toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')
}

describe('createStorageSaveStore', () => {
  it('reads back what it wrote, per game and slot', async () => {
    const storage = memoryStorage()
    const store = createStorageSaveStore(() => storage, 'saves:')
    const save = someSave()

    expect(await store.write('game', '1', save)).toBe(true)
    expect(await store.read('game', '1')).toEqual(save)
    expect(await store.read('game', '2')).toBeNull()
    expect(await store.read('other game', '1')).toBeNull()
    expect(storage.getItem('saves:game:1')).not.toBeNull()
  })

  it('finds nothing in a damaged or tampered entry', async () => {
    const storage = memoryStorage()
    const store = createStorageSaveStore(() => storage, 'saves:')
    storage.setItem('saves:game:1', '{ not json')
    storage.setItem('saves:game:2', JSON.stringify({ saveFormat: 1, game: 'nope' }))

    expect(await store.read('game', '1')).toBeNull()
    expect(await store.read('game', '2')).toBeNull()
  })

  it('reports a refused write and reads nothing when storage is unavailable', async () => {
    const store = createStorageSaveStore(() => {
      throw new Error('SecurityError: storage is disabled')
    }, 'saves:')
    expect(await store.write('game', '1', someSave())).toBe(false)
    expect(await store.read('game', '1')).toBeNull()
  })
})
