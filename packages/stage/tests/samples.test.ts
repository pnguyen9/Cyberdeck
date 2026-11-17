import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSample, sampleScriptOf, sampleScriptPath } from '../src/app/samples'

/** A page that does what a browser does with a script: runs it, or fails it, when it is inserted. */
function fakePage(onInsert: (script: { src: string; onload: () => void; onerror: () => void }, callbacks: Record<string, (...given: string[]) => void>) => void) {
  const callbacks: Record<string, (...given: string[]) => void> = {}
  const inserted: Array<{ src: string; removed: boolean }> = []
  const page = {
    defaultView: callbacks,
    baseURI: 'http://localhost/app/',
    createElement: () => {
      const script = { src: '', removed: false, onload: () => {}, onerror: () => {}, remove() { this.removed = true } }
      inserted.push(script)
      return script
    },
    head: { append: (script: Parameters<typeof onInsert>[0]) => onInsert(script, callbacks) },
  }
  return { page: page as unknown as Document, inserted }
}

const hash = 'a'.repeat(64)
const sample = { id: 'pairs', hash, script: sampleScriptPath('pairs', hash) }

describe('loading a sample', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('names the script after the start of the hash, and has it give the hash back', () => {
    expect(sample.script).toBe(`samples/pairs.${'a'.repeat(12)}.js`)
    expect(sampleScriptOf('pairs', hash, 'AAAA')).toBe(`window.cyberdeckSample("pairs", "${hash}", "AAAA")\n`)
  })

  it('gives the archive of the script that ran, and removes the script', async () => {
    const { page, inserted } = fakePage((script, callbacks) => {
      callbacks.cyberdeckSample!('pairs', hash, btoa('PK'))
      script.onload()
    })
    expect([...await loadSample(sample, page)]).toEqual([80, 75])
    expect(inserted[0]!.src).toBe(`http://localhost/app/${sample.script}`)
    expect(inserted[0]!.removed).toBe(true)
  })

  it('refuses a script of another release than the index’s', async () => {
    const { page } = fakePage((script, callbacks) => {
      callbacks.cyberdeckSample!('pairs', 'b'.repeat(64), btoa('PK'))
      script.onload()
    })
    await expect(loadSample(sample, page)).rejects.toThrow('not the release')
  })

  it('rejects a script that fails, or that gives nothing', async () => {
    await expect(loadSample(sample, fakePage(script => script.onerror()).page)).rejects.toThrow('could not be loaded')
    await expect(loadSample(sample, fakePage(script => script.onload()).page)).rejects.toThrow('gave no game')
  })

  it('gives the load under way to a second ask, and loads again after it ends', async () => {
    let inserts = 0
    const { page } = fakePage((script, callbacks) => {
      inserts += 1
      setTimeout(() => {
        callbacks.cyberdeckSample!('pairs', hash, btoa('PK'))
        script.onload()
      }, 10)
    })
    const first = loadSample(sample, page)
    const second = loadSample(sample, page)
    expect(second).toBe(first)
    await vi.advanceTimersByTimeAsync(10)
    await first
    expect(inserts).toBe(1)
    const third = loadSample(sample, page)
    await vi.advanceTimersByTimeAsync(10)
    await third
    expect(inserts).toBe(2)
  })

  it('gives up after the time allowed, and removes the script', async () => {
    const { page, inserted } = fakePage(() => {})
    const loading = loadSample(sample, page, 1000)
    const rejection = expect(loading).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(1000)
    await rejection
    expect(inserted[0]!.removed).toBe(true)
    // It can be asked again.
    const again = loadSample(sample, page, 1000)
    const second = expect(again).rejects.toThrow('took too long')
    await vi.advanceTimersByTimeAsync(1000)
    await second
  })
})
