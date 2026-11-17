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

/** What the shelf installed, kept in a `Storage` (`localStorage`); if it cannot be read or written, the shelf offers updates. */
export function createSampleRecord(storage: () => Storage) {
  return {
    read(): InstalledSamples {
      try {
        const value: unknown = JSON.parse(storage().getItem(SAMPLES_KEY) ?? '{}')
        if (typeof value !== 'object' || value === null) {
          return {}
        }
        return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      } catch {
        return {}
      }
    },
    write(sampleId: string, hash: string) {
      try {
        storage().setItem(SAMPLES_KEY, JSON.stringify({ ...this.read(), [sampleId]: hash }))
      } catch {
        // Without a record, the sample is offered again as an update: harmless.
      }
    },
  }
}
