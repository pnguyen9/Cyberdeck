/** The index of the samples built into the application, made by `sampleBuild.ts`. */
declare module 'virtual:samples' {
  import type { SampleIndexEntry } from './app/samples'
  export const samples: readonly SampleIndexEntry[]
}
