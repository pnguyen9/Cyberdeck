import { describe, expect, it } from 'vitest'
import { createBrowserProfileStore } from '../../src/profiles/profileStore'
import { memoryStorage } from '../memoryStorage'
import { someSave } from '../someSave'

function createStore(storage = memoryStorage()) {
  let nextId = 1
  return createBrowserProfileStore(() => storage, () => `profile-${nextId++}`, () => '2026-10-26T10:00:00.000Z')
}

describe('createBrowserProfileStore', () => {
  it('creates profiles and remembers the last one used', async () => {
    const storage = memoryStorage()
    const store = createStore(storage)
    const pascal = await store.create('Pascal', null)
    await store.create('Alex', null)
    await store.use(pascal.id)

    expect(await createStore(storage).list()).toEqual({
      profiles: [
        { id: 'profile-1', name: 'Pascal', saveFolder: null, createdAt: '2026-10-26T10:00:00.000Z' },
        { id: 'profile-2', name: 'Alex', saveFolder: null, createdAt: '2026-10-26T10:00:00.000Z' },
      ],
      lastUsedId: 'profile-1',
    })
  })

  it('refuses blank or taken names, with a message for the player', async () => {
    const store = createStore()
    await store.create('Pascal', null)
    const alex = await store.create('Alex', null)

    await expect(store.create(' ', null)).rejects.toThrow('A profile name needs 1 to 40 characters.')
    await expect(store.create('pascal', null)).rejects.toThrow('Another profile is already named pascal.')
    await expect(store.rename(alex.id, 'PASCAL')).rejects.toThrow('Another profile is already named PASCAL.')
    await store.rename(alex.id, ' Alexandre ')
    expect((await store.list()).profiles[1]?.name).toBe('Alexandre')
  })

  it('keeps the saves of each profile apart', async () => {
    const store = createStore()
    const pascal = await store.create('Pascal', null)
    const alex = await store.create('Alex', null)
    const save = someSave()

    await store.saveStore(pascal.id).write('game', 'auto', save)

    expect(await store.saveStore(pascal.id).read('game', 'auto')).toEqual(save)
    expect(await store.saveStore(alex.id).read('game', 'auto')).toBeNull()
  })

  it('deletes the saves of a removed profile, and only those', async () => {
    const storage = memoryStorage()
    const store = createStore(storage)
    const pascal = await store.create('Pascal', null)
    const alex = await store.create('Alex', null)
    await store.saveStore(pascal.id).write('game', 'auto', someSave())
    await store.saveStore(alex.id).write('game', 'auto', someSave())

    await store.remove(alex.id)

    expect(await store.list()).toEqual({ profiles: [expect.objectContaining({ name: 'Pascal' })], lastUsedId: null })
    expect(await store.saveStore(pascal.id).read('game', 'auto')).not.toBeNull()
    expect(storage.length).toBe(2)
  })

  it('starts afresh when the stored list is damaged', async () => {
    const storage = memoryStorage()
    storage.setItem('datajack:profiles', '{ broken')
    expect(await createStore(storage).list()).toEqual({ profiles: [], lastUsedId: null })
  })
})
