import { resolve, sep } from 'node:path'
import { runnerImport, type Plugin, type ResolvedConfig } from 'vite'
import type { BuiltSample } from './scripts/samples/sampleArchives'
import { sampleScriptOf, sampleScriptPath, type SampleIndexEntry } from './packages/stage/src/app/samples'

/** The module the applications import the index of samples from. */
const INDEX_MODULE = 'virtual:samples'

const MEDIA_TYPES: Readonly<Record<string, string>> = { js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }

/** A sample's files as the page asks for them: its script, and its cover if it has one. */
export function sampleFiles(sample: BuiltSample): Map<string, Uint8Array | string> {
  const files = new Map<string, Uint8Array | string>([[sampleScriptPath(sample.id, sample.hash), sampleScriptOf(sample.id, sample.hash, Buffer.from(sample.archive).toString('base64'))]])
  if (sample.cover !== null) {
    files.set(coverPath(sample), sample.cover.bytes)
  }
  return files
}

/** Named after the content, as the script is, so that no cache serves a cover of another release. */
const coverPath = (sample: BuiltSample) => `samples/${sample.id}.cover.${sample.hash.slice(0, 12)}.${sample.cover!.fileName.split('.').pop()!.toLowerCase()}`

/** What the index holds of a sample: the small facts, with the cover's address. */
export function indexEntryOf(sample: BuiltSample): SampleIndexEntry {
  return { id: sample.id, name: sample.name, description: sample.description, hash: sample.hash, script: sampleScriptPath(sample.id, sample.hash), cover: sample.cover === null ? null : coverPath(sample) }
}

const SAMPLES_FOLDER = resolve(import.meta.dirname, 'docs/sample')

/** Every sample built, once for the whole process: both applications' builds, and a development server, ask. */
let building: Promise<BuiltSample[]> | undefined
export function builtSamples(): Promise<BuiltSample[]> {
  const exportedAt = new Date()
  // The generator runs the editor's own code, which Node cannot load as it is: Vite's module runner does.
  building ??= runnerImport<typeof import('./scripts/samples/sampleArchives')>(resolve(import.meta.dirname, 'scripts/samples/sampleArchives.ts'))
    .then(({ module }) => Promise.all(module.SAMPLES.map(sample => module.buildSample(sample, SAMPLES_FOLDER, exportedAt))))
  building.catch(() => {
    building = undefined
  })
  return building
}

/**
 * The samples of docs/sample, built into the application: each made into a game as an author would
 * make it, written beside the page as `samples/<id>.<hash>.js` (loaded when a player or an author
 * picks it) with its cover, and listed in a small module the code imports (`virtual:samples`).
 *
 * A build makes them at its start. A development server (and Vitest, which loads the same
 * configuration) makes them only when the index or a file is first asked for, logs a failure rather
 * than throwing, and makes them again when docs/sample changes.
 */
export function builtInSamples(): Plugin {
  let config: ResolvedConfig
  let current: Promise<{ files: Map<string, Uint8Array | string>; index: SampleIndexEntry[] }> | undefined
  const ready = () => current ??= builtSamples().then(built => ({
    files: new Map(built.flatMap(sample => [...sampleFiles(sample)])),
    index: built.map(indexEntryOf),
  }))
  return {
    name: 'built-in-samples',
    configResolved: resolved => {
      config = resolved
    },
    buildStart: async () => {
      if (config.command === 'build') {
        await ready()
      }
    },
    resolveId: id => id === INDEX_MODULE ? `\0${INDEX_MODULE}` : null,
    load: async id => {
      if (id !== `\0${INDEX_MODULE}`) {
        return null
      }
      try {
        return `export const samples = ${JSON.stringify((await ready()).index)}`
      } catch (error) {
        if (config.command === 'build') {
          throw error
        }
        config.logger.error(`The samples could not be built: ${error instanceof Error ? error.message : String(error)}`)
        return 'export const samples = []'
      }
    },
    configureServer: server => {
      server.watcher.add(SAMPLES_FOLDER)
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(SAMPLES_FOLDER + sep)) {
          return
        }
        current = undefined
        building = undefined
        const index = server.moduleGraph.getModuleById(`\0${INDEX_MODULE}`)
        if (index !== undefined) {
          server.moduleGraph.invalidateModule(index)
          server.ws.send({ type: 'full-reload' })
        }
      })
      server.middlewares.use(async (request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/^\//, '')
        if (!path.startsWith('samples/')) {
          next()
          return
        }
        try {
          const content = (await ready()).files.get(path)
          if (content === undefined) {
            next()
            return
          }
          response.setHeader('Content-Type', MEDIA_TYPES[path.split('.').pop()!] ?? 'application/octet-stream')
          response.end(content)
        } catch (error) {
          server.config.logger.error(`The samples could not be built: ${error instanceof Error ? error.message : String(error)}`)
          next()
        }
      })
    },
    generateBundle() {
      return ready().then(({ files }) => {
        for (const [fileName, source] of files) {
          this.emitFile({ type: 'asset', fileName, source })
        }
      })
    },
  }
}
