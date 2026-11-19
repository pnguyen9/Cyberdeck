import { describe, expect, it } from 'vitest'
import { removeSplash, SPLASH_ID } from '../src/app/splash'

describe('the splash screen', () => {
  it('is taken away by its id, and nothing happens once it is gone', () => {
    const removed: string[] = []
    const doc = { getElementById: (id: string) => id === SPLASH_ID && removed.length === 0 ? { remove: () => removed.push(id) } as unknown as HTMLElement : null }
    removeSplash(doc)
    removeSplash(doc)
    expect(removed).toEqual([SPLASH_ID])
  })
})
