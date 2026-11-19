import { describe, expect, it } from 'vitest'
import { pinMessages } from '../../src/i18n/pinMessages'
import { createProfileLocks, isPinShaped, waitSecondsAfter } from '../../src/profiles/profileLocks'
import { memoryStorage } from '../memoryStorage'

/** Few rounds, for speed: the hash is the same function. */
function createLocks(storage = memoryStorage(), clock = { now: 1_000_000 }) {
  return createProfileLocks(() => storage, { now: () => clock.now, iterations: 1000 })
}

describe('createProfileLocks', () => {
  it('leaves profiles without a PIN as they are', async () => {
    const locks = createLocks()
    expect(locks.isLocked('profile-1')).toBe(false)
    expect(locks.waitUntil('profile-1')).toBe(null)
    expect(await locks.check('profile-1', '0000')).toEqual({ outcome: 'right' })
  })

  it('keeps a salted hash of the PIN, never the PIN', async () => {
    const storage = memoryStorage()
    const locks = createLocks(storage)
    await locks.set('profile-1', '1234')
    await locks.set('profile-2', '1234')
    const first = storage.getItem('datajack:pin:profile-1') ?? ''
    const second = storage.getItem('datajack:pin:profile-2') ?? ''
    expect(first).not.toContain('1234')
    expect(JSON.parse(first)).toMatchObject({ iterations: 1000, failures: 0, waitUntil: 0 })
    // Each lock its own salt: the same PIN hashes differently.
    expect(JSON.parse(first).hash).not.toBe(JSON.parse(second).hash)
    expect(locks.isLocked('profile-1')).toBe(true)
    expect(createLocks(storage).isLocked('profile-1')).toBe(true)
  })

  it('opens with the right PIN only, and changes or removes it', async () => {
    const locks = createLocks()
    await locks.set('profile-1', '1234')
    expect(await locks.check('profile-1', '1234')).toEqual({ outcome: 'right' })
    expect(await locks.check('profile-1', '4321')).toEqual({ outcome: 'wrong', triesLeft: 4 })
    await locks.set('profile-1', '4321')
    expect(await locks.check('profile-1', '4321')).toEqual({ outcome: 'right' })
    expect(await locks.check('profile-1', '1234')).toMatchObject({ outcome: 'wrong' })
    locks.remove('profile-1')
    expect(locks.isLocked('profile-1')).toBe(false)
  })

  it('refuses a PIN that is not four digits', async () => {
    const locks = createLocks()
    expect(isPinShaped('0123')).toBe(true)
    expect(['123', '12345', '12a4', ' 123', ''].some(isPinShaped)).toBe(false)
    await expect(locks.set('profile-1', '123')).rejects.toThrow('A PIN is 4 digits.')
    expect(locks.isLocked('profile-1')).toBe(false)
  })

  it('makes the player wait 30 seconds after five wrong PINs, even across a restart', async () => {
    const storage = memoryStorage()
    const clock = { now: 1_000_000 }
    const locks = createLocks(storage, clock)
    await locks.set('profile-1', '1234')
    for (const triesLeft of [4, 3, 2, 1]) {
      expect(await locks.check('profile-1', '0000')).toEqual({ outcome: 'wrong', triesLeft })
    }
    expect(await locks.check('profile-1', '0000')).toEqual({ outcome: 'wait', until: 1_030_000 })
    // Even the right PIN waits, and a new page keeps the wait.
    clock.now += 29_000
    expect(await createLocks(storage, clock).check('profile-1', '1234')).toEqual({ outcome: 'wait', until: 1_030_000 })
    expect(locks.waitUntil('profile-1')).toBe(1_030_000)
    clock.now += 1_000
    expect(locks.waitUntil('profile-1')).toBe(null)
    expect(await locks.check('profile-1', '1234')).toEqual({ outcome: 'right' })
    // The right PIN starts the count again.
    expect(await locks.check('profile-1', '0000')).toEqual({ outcome: 'wrong', triesLeft: 4 })
  })

  it('makes each wrong PIN after the wait wait longer, up to 15 minutes, until the right one', async () => {
    const clock = { now: 1_000_000 }
    const locks = createLocks(memoryStorage(), clock)
    await locks.set('profile-1', '1234')
    for (let failure = 1; failure < 5; failure++) {
      await locks.check('profile-1', '0000')
    }
    const waits: number[] = []
    for (let failure = 5; failure <= 9; failure++) {
      const result = await locks.check('profile-1', '0000')
      expect(result.outcome).toBe('wait')
      const until = (result as { until: number }).until
      waits.push((until - clock.now) / 1000)
      clock.now = until
    }
    expect(waits).toEqual([30, 60, 300, 900, 900])
    expect(await locks.check('profile-1', '1234')).toEqual({ outcome: 'right' })
    expect(await locks.check('profile-1', '0000')).toEqual({ outcome: 'wrong', triesLeft: 4 })
    expect([0, 4, 5, 6, 7, 8, 20].map(waitSecondsAfter)).toEqual([0, 0, 30, 60, 300, 900, 900])
  })

  it('shortens a wait further ahead than the wrong PINs earned, as a clock put back leaves', async () => {
    const storage = memoryStorage()
    const clock = { now: 1_000_000 }
    const locks = createLocks(storage, clock)
    await locks.set('profile-1', '1234')
    const lock = JSON.parse(storage.getItem('datajack:pin:profile-1') ?? '')
    // Six wrong PINs earn a minute; a day is kept, as when the clock went back a day.
    storage.setItem('datajack:pin:profile-1', JSON.stringify({ ...lock, failures: 6, waitUntil: clock.now + 86_400_000 }))
    expect(locks.waitUntil('profile-1')).toBe(1_060_000)
    expect(JSON.parse(storage.getItem('datajack:pin:profile-1') ?? '').waitUntil).toBe(1_060_000)
    // A wait without the wrong PINs to earn it is none.
    storage.setItem('datajack:pin:profile-1', JSON.stringify({ ...lock, failures: 0, waitUntil: clock.now + 5000 }))
    expect(await locks.check('profile-1', '1234')).toEqual({ outcome: 'right' })
  })

  it('rejects, rather than hangs, when the storage cannot keep the lock', async () => {
    const storage = memoryStorage()
    const locks = createLocks(storage)
    await locks.set('profile-1', '1234')
    storage.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
    await expect(locks.set('profile-1', '4321')).rejects.toThrow('Full')
    await expect(locks.check('profile-1', '0000')).rejects.toThrow('Full')
  })

  it('takes an unreadable lock for none', () => {
    const storage = memoryStorage()
    storage.setItem('datajack:pin:profile-1', '{"salt":1}')
    storage.setItem('datajack:pin:profile-2', 'not json')
    const locks = createLocks(storage)
    expect(locks.isLocked('profile-1')).toBe(false)
    expect(locks.isLocked('profile-2')).toBe(false)
  })

  it('takes a lock whose salt cannot be read as matching no PIN', async () => {
    const storage = memoryStorage()
    storage.setItem('datajack:pin:profile-1', JSON.stringify({ salt: '%%%', hash: 'x', iterations: 1000, failures: 0, waitUntil: 0 }))
    expect(await createLocks(storage).check('profile-1', '1234')).toEqual({ outcome: 'wrong', triesLeft: 4 })
  })
})

describe('pinMessages', () => {
  it('count the tries and the wait as each language does, one or none in the singular in French', () => {
    expect(pinMessages.en.wrong(1)).toBe('Wrong PIN. 1 more try before a 30-second wait.')
    expect(pinMessages.en.wrong(4)).toBe('Wrong PIN. 4 more tries before a 30-second wait.')
    expect(pinMessages.fr.wrong(1)).toBe('Code secret incorrect. Il vous reste 1 essai avant de devoir attendre 30\u00a0secondes.')
    expect(pinMessages.fr.wrong(4)).toBe('Code secret incorrect. Il vous reste 4 essais avant de devoir attendre 30\u00a0secondes.')
    expect(pinMessages.en.wait(pinMessages.en.duration(1))).toBe('Too many wrong PINs: try again in 1\u00a0second.')
    expect(pinMessages.en.wait(pinMessages.en.duration(30))).toBe('Too many wrong PINs: try again in 30\u00a0seconds.')
    expect(pinMessages.fr.wait(pinMessages.fr.duration(1))).toBe('Trop d’essais incorrects\u00a0: réessayez dans 1\u00a0seconde.')
    expect(pinMessages.fr.wait(pinMessages.fr.duration(30))).toBe('Trop d’essais incorrects\u00a0: réessayez dans 30\u00a0secondes.')
    // From a minute, in minutes, rounded up.
    expect([60, 300, 900, 250].map(pinMessages.en.duration)).toEqual(['1\u00a0minute', '5\u00a0minutes', '15\u00a0minutes', '5\u00a0minutes'])
    expect([60, 300].map(pinMessages.fr.duration)).toEqual(['1\u00a0minute', '5\u00a0minutes'])
  })
})
