/// <reference path="../virtualSamples.d.ts" />
/**
 * The samples built into both applications. Each is a classic script, `samples/<id>.<hash>.js`, which
 * hands its game archive to a function of the page, once the page inserts it: a classic script loads
 * from a double-clicked file, a web server and an Electron window alike, where `fetch` would be
 * refused on `file://`. The hash is in the name so that no cache can serve a script of another
 * release. `sampleBuild.ts` writes the scripts and the index; this file is what the page and the build share.
 */

/** What the index says of each sample: all the shelves show before one is picked. */
export interface SampleIndexEntry {
  id: string
  name: string
  description: string
  /** SHA-256 of the game as exported, without its date of export, in hexadecimal: what "the same content" means. */
  hash: string
  /** The sample's script, relative to the page; its name holds the start of the hash. */
  script: string
  /** The cover's file, relative to the page; null for a sample without one. */
  cover: string | null
}

/** The name of the page's function a sample's script calls with its archive. */
export const SAMPLE_CALLBACK = 'cyberdeckSample'

/** The identifier of a sample's game, in Datajack's library and as a Cyberdeck project made from it is named after. */
export const sampleGameId = (sampleId: string) => `sample-${sampleId}`

export const sampleScriptPath = (sampleId: string, hash: string) => `samples/${sampleId}.${hash.slice(0, 12)}.js`

/** The script of a sample: its hash and its archive in base64, given to the page's function. */
export const sampleScriptOf = (sampleId: string, hash: string, base64: string) =>
  `window.${SAMPLE_CALLBACK}(${JSON.stringify(sampleId)}, ${JSON.stringify(hash)}, ${JSON.stringify(base64)})\n`

type Callback = (sampleId: string, hash: string, base64: string) => void

function bytesOfBase64(base64: string): Uint8Array<ArrayBuffer> {
  const text = atob(base64)
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index++) {
    bytes[index] = text.charCodeAt(index)
  }
  return bytes
}

/** What a script inserted waits for: the hash it must give, and what to do with the archive or the failure. */
const waiting = new Map<string, { hash: string; settle: (result: Uint8Array<ArrayBuffer> | Error) => void }>()
/** The loads under way, by sample: asking again for a sample being loaded gives the same promise. */
const loading = new Map<string, Promise<Uint8Array<ArrayBuffer>>>()

/** Long enough for the biggest sample, about 10 MB, on a slow connection. */
export const SAMPLE_LOAD_TIMEOUT_MILLISECONDS = 120_000

/**
 * Loads a sample's game archive by inserting its script; rejects when the script cannot be loaded
 * (offline, the first time), gives nothing, gives another release than the index's, or takes too long.
 */
export function loadSample(sample: Pick<SampleIndexEntry, 'id' | 'hash' | 'script'>, page: Document = document, timeoutMilliseconds = SAMPLE_LOAD_TIMEOUT_MILLISECONDS): Promise<Uint8Array<ArrayBuffer>> {
  const inFlight = loading.get(sample.id)
  if (inFlight !== undefined) {
    return inFlight
  }
  const callbacks = page.defaultView as unknown as Record<string, Callback | undefined>
  callbacks[SAMPLE_CALLBACK] = (loadedId, hash, base64) => {
    const wanted = waiting.get(loadedId)
    wanted?.settle(hash === wanted.hash ? bytesOfBase64(base64) : new Error(`The sample ${loadedId} is not the release this page lists`))
  }
  const promise = new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const script = page.createElement('script')
    const timer = setTimeout(() => settle(new Error(`The sample ${sample.id} took too long to load`)), timeoutMilliseconds)
    function settle(result: Uint8Array<ArrayBuffer> | Error) {
      clearTimeout(timer)
      waiting.delete(sample.id)
      script.remove()
      if (result instanceof Error) {
        reject(result)
      } else {
        resolve(result)
      }
    }
    waiting.set(sample.id, { hash: sample.hash, settle })
    script.onerror = () => settle(new Error(`The sample ${sample.id} could not be loaded`))
    script.onload = () => {
      // The script has run: if it gave nothing, nothing is coming.
      if (waiting.has(sample.id)) {
        settle(new Error(`The sample ${sample.id} gave no game`))
      }
    }
    script.src = new URL(sample.script, page.baseURI).href
    page.head.append(script)
  })
  loading.set(sample.id, promise)
  const forget = () => loading.delete(sample.id)
  promise.then(forget, forget)
  return promise
}
