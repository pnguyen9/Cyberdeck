/**
 * The PIN a profile may be locked with: four digits Datajack asks for before opening the profile, and
 * again before erasing its saves or progress, renaming, moving or removing it, or changing its PIN. Only a salted hash is kept, never the digits; the
 * profile's data is not encrypted: it keeps people using Datajack out, not the browser's tools.
 */
export const PIN_LENGTH = 4
/** Wrong PINs in a row before a wait. */
export const TRIES_BEFORE_WAIT = 5
/** The waits, in seconds: after the fifth wrong PIN in a row, then after each further one; the last is kept. */
export const WAIT_SECONDS = [30, 60, 300, 900] as const
const PIN_PATTERN = new RegExp(`^[0-9]{${PIN_LENGTH}}$`)
/** PBKDF2 rounds: slow enough to make each try cost, fast enough on a small tablet. */
const ITERATIONS = 100_000

/** What is kept for a locked profile, in the page's storage, beside its settings. */
interface StoredLock {
  /** Base64 of the 16 random bytes salting the hash. */
  salt: string
  /** Base64 of the PBKDF2-SHA-256 of the PIN. */
  hash: string
  iterations: number
  /** Wrong PINs since the last right one. */
  failures: number
  /** When tries are allowed again, in milliseconds since 1970; 0 when they are. */
  waitUntil: number
}

export type PinCheck =
  | { outcome: 'right' }
  | { outcome: 'wrong'; triesLeft: number }
  /** Too many wrong PINs: none is even read until then. */
  | { outcome: 'wait'; until: number }

export interface ProfileLocks {
  isLocked: (profileId: string) => boolean
  /** Locks the profile with a PIN, or changes its PIN. */
  set: (profileId: string, pin: string) => Promise<void>
  check: (profileId: string, pin: string) => Promise<PinCheck>
  /** When tries are allowed again; null when they are. */
  waitUntil: (profileId: string) => number | null
  /** Unlocks the profile, or forgets the lock of a profile removed. */
  remove: (profileId: string) => void
}

/** Four digits, nothing else. */
export function isPinShaped(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}

const lockKey = (profileId: string) => `datajack:pin:${profileId}`

interface LockOptions {
  now?: () => number
  iterations?: number
}

/** Locks kept in a `Storage` (`localStorage`, the desktop page's too), one key per locked profile. */
export function createProfileLocks(getStorage: () => Storage, { now = Date.now, iterations = ITERATIONS }: LockOptions = {}): ProfileLocks {
  const read = (profileId: string): StoredLock | null => {
    try {
      const value: unknown = JSON.parse(getStorage().getItem(lockKey(profileId)) ?? 'null')
      return isStoredLock(value) ? value : null
    } catch {
      return null
    }
  }
  const write = (profileId: string, lock: StoredLock) => getStorage().setItem(lockKey(profileId), JSON.stringify(lock))
  /**
   * When tries are allowed again, null when they are. A wait further ahead than the one its wrong PINs
   * earned (the clock was put back) is shortened to that, and kept so.
   */
  const waitUntil = (profileId: string, lock: StoredLock) => {
    const latest = now() + waitSecondsAfter(lock.failures) * 1000
    if (lock.waitUntil > latest) {
      lock.waitUntil = latest
      try {
        write(profileId, lock)
      } catch {
        // Kept shortened for this page at least.
      }
    }
    return lock.waitUntil > now() ? lock.waitUntil : null
  }

  return {
    isLocked: profileId => read(profileId) !== null,
    set: async (profileId, pin) => {
      if (!isPinShaped(pin)) {
        throw new Error(`A PIN is ${PIN_LENGTH} digits.`)
      }
      const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)))
      write(profileId, { salt, hash: await hashOf(pin, salt, iterations), iterations, failures: 0, waitUntil: 0 })
    },
    check: async (profileId, pin) => {
      const lock = read(profileId)
      if (lock === null) {
        return { outcome: 'right' }
      }
      const until = waitUntil(profileId, lock)
      if (until !== null) {
        return { outcome: 'wait', until }
      }
      // A salt that cannot be read matches no PIN.
      const hash = isPinShaped(pin) ? await hashOf(pin, lock.salt, lock.iterations).catch(() => null) : null
      if (hash !== null && hash === lock.hash) {
        write(profileId, { ...lock, failures: 0, waitUntil: 0 })
        return { outcome: 'right' }
      }
      const failures = lock.failures + 1
      if (failures >= TRIES_BEFORE_WAIT) {
        const until = now() + waitSecondsAfter(failures) * 1000
        write(profileId, { ...lock, failures, waitUntil: until })
        return { outcome: 'wait', until }
      }
      write(profileId, { ...lock, failures, waitUntil: 0 })
      return { outcome: 'wrong', triesLeft: TRIES_BEFORE_WAIT - failures }
    },
    waitUntil: profileId => {
      const lock = read(profileId)
      return lock === null ? null : waitUntil(profileId, lock)
    },
    remove: profileId => getStorage().removeItem(lockKey(profileId)),
  }
}

/** The wait earned by so many wrong PINs in a row: none below five, then longer with each, up to the last. */
export function waitSecondsAfter(failures: number): number {
  return failures < TRIES_BEFORE_WAIT ? 0 : WAIT_SECONDS[Math.min(failures - TRIES_BEFORE_WAIT, WAIT_SECONDS.length - 1)] ?? WAIT_SECONDS[0]
}

/** The PBKDF2-SHA-256 of the PIN, in Base64, salted with the Base64 `salt`; rejects a salt that is not Base64. */
async function hashOf(pin: string, salt: string, iterations: number): Promise<string> {
  const saltBytes = fromBase64(salt)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations }, key, 256)
  return toBase64(new Uint8Array(bits))
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), character => character.charCodeAt(0))
}

function isStoredLock(value: unknown): value is StoredLock {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const lock = value as Record<string, unknown>
  return typeof lock.salt === 'string' && typeof lock.hash === 'string' && typeof lock.iterations === 'number' && lock.iterations > 0
    && typeof lock.failures === 'number' && typeof lock.waitUntil === 'number'
}
