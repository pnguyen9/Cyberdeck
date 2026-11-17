import { loadSample, type SampleIndexEntry } from '@cyberdeck/stage'
import { samples } from 'virtual:samples'
import type { GameLibrary, InstallOutcome } from './gameLibrary'
import { createSampleRecord } from './sampleShelf'

/** The samples built into Datajack, in the order the shelf shows them. */
export const builtInSamples: readonly SampleIndexEntry[] = samples

const record = createSampleRecord(() => window.localStorage)

/** What the shelf installed so far, by sample. */
export const installedSamples = () => record.read()

/** The sample's files could not be loaded: unlike an install that fails, the message to give is about getting them. */
export class SampleNotLoaded extends Error {}

/**
 * Loads a sample and installs it, as a game downloaded would be, and notes what was installed. An
 * archive older than what the library has only adds what is missing, so it is not noted: the sample
 * is still offered as an update.
 */
export async function installSample(library: GameLibrary, sample: SampleIndexEntry): Promise<InstallOutcome> {
  const bytes = await loadSample(sample).catch((error: unknown) => {
    throw new SampleNotLoaded(error instanceof Error ? error.message : String(error))
  })
  const outcome = await library.install(bytes)
  if (!outcome.wasOlder) {
    record.write(sample.id, sample.hash)
  }
  return outcome
}
