import type { SampleIndexEntry } from '@cyberdeck/stage'
import { sampleGameId } from '@cyberdeck/stage'

/**
 * Where a sample stands on the shelf: not in the library (`add`), in it with the content built into
 * Datajack (`inLibrary`), or in it with other content (`update`).
 */
export type SampleState = 'add' | 'inLibrary' | 'update'

/** The content installed from the shelf, sample by sample: its hash, as the index gives it. */
export type InstalledSamples = Readonly<Record<string, string>>

/**
 * A sample installed that the shelf has no record of, such as one installed from a downloaded
 * archive, is offered the update: installing over it only merges, and keeps the saves.
 */
export function sampleState(sample: Pick<SampleIndexEntry, 'id' | 'hash'>, libraryIds: ReadonlySet<string>, installed: InstalledSamples): SampleState {
  if (!libraryIds.has(sampleGameId(sample.id))) {
    return 'add'
  }
  return installed[sample.id] === sample.hash ? 'inLibrary' : 'update'
}

export const SAMPLES_KEY = 'datajack:samples'

/**
 * What the shelf installed, in a `Storage` (`localStorage`), for each profile, as each keeps its own
 * copy of a sample: `{ <profile>: { <sample>: <hash> } }`. The record of an earlier Datajack, from
 * before each profile had its own library, is `{ <sample>: <hash> }`: once the games installed then
 * went to the profiles there were (`adoptEarlier`), it becomes each one's own, and is dropped; until
 * then, it stands for any profile with none. If the record cannot be read or written, the shelf
 * offers updates.
 */
export function createSampleRecord(storage: () => Storage) {
  const readAll = (): Record<string, unknown> => {
    try {
      const value: unknown = JSON.parse(storage().getItem(SAMPLES_KEY) ?? '{}')
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  const hashesIn = (value: object): InstalledSamples =>
    Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  return {
    read(profileId: string): InstalledSamples {
      const all = readAll()
      const own = all[profileId]
      return typeof own === 'object' && own !== null ? hashesIn(own) : hashesIn(all)
    },
    /** The earlier record given to the profiles that received the games installed then, and dropped. */
    adoptEarlier(profileIds: readonly string[]) {
      const all = readAll()
      const earlier = hashesIn(all)
      if (Object.keys(earlier).length === 0) {
        return
      }
      const owned = Object.fromEntries(Object.entries(all).filter(([, value]) => typeof value === 'object' && value !== null))
      try {
        storage().setItem(SAMPLES_KEY, JSON.stringify({ ...Object.fromEntries(profileIds.map(profileId => [profileId, earlier])), ...owned }))
      } catch {
        // Kept as it was: tried again at the next start.
      }
    },
    /** What a profile file says the shelf installed for its profile. */
    replace(profileId: string, installed: InstalledSamples) {
      try {
        storage().setItem(SAMPLES_KEY, JSON.stringify({ ...readAll(), [profileId]: installed }))
      } catch {
        // Without a record, the samples are offered again as updates: harmless.
      }
    },
    write(profileId: string, sampleId: string, hash: string) {
      try {
        storage().setItem(SAMPLES_KEY, JSON.stringify({ ...readAll(), [profileId]: { ...this.read(profileId), [sampleId]: hash } }))
      } catch {
        // Without a record, the sample is offered again as an update: harmless.
      }
    },
  }
}
