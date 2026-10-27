import { describe, expect, it } from 'vitest'
import { readZip, writeZip } from '../src/archive/zip'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const MODIFIED_AT = new Date('2026-10-26T10:00:00Z')

async function readAll(bytes: Uint8Array<ArrayBuffer>, limits?: Parameters<typeof readZip>[1]) {
  const entries = readZip(bytes, limits)
  return Object.fromEntries(await Promise.all(entries.map(async entry => [entry.path, decoder.decode(await entry.read())] as const)))
}

/** Replaces every occurrence of a byte sequence, as a tampered archive would. */
function patch(bytes: Uint8Array<ArrayBuffer>, from: string, to: string): Uint8Array<ArrayBuffer> {
  const patched = bytes.slice()
  const pattern = encoder.encode(from)
  const replacement = encoder.encode(to)
  for (let index = 0; index + pattern.length <= patched.length; index++) {
    if (pattern.every((byte, offset) => patched[index + offset] === byte)) {
      patched.set(replacement, index)
    }
  }
  return patched
}

describe('ZIP archives', () => {
  it('reads back what it wrote, compressed or stored, with names in any script', async () => {
    const text = '— Marie: You came after all. '.repeat(200)
    const bytes = await writeZip([
      { path: 'game.json', bytes: encoder.encode(text), compress: true },
      { path: 'assets/élan-夜.txt', bytes: encoder.encode('stored'), compress: false },
    ], MODIFIED_AT)

    expect(bytes.length).toBeLessThan(text.length)
    expect(await readAll(bytes)).toEqual({ 'game.json': text, 'assets/élan-夜.txt': 'stored' })
  })

  it('writes the same bytes for the same content', async () => {
    const entries = [{ path: 'a.json', bytes: encoder.encode('{}'), compress: true }]
    expect(await writeZip(entries, MODIFIED_AT)).toEqual(await writeZip(entries, MODIFIED_AT))
  })

  it('refuses what is not a ZIP archive', () => {
    expect(() => readZip(encoder.encode('just some text'))).toThrow('not a ZIP archive')
  })

  it('refuses paths that would climb out of their folder or be absolute', async () => {
    const tamperings = [['aa/evil.json', '../evil.json'], ['xevil.json', '/evil.json'], ['a_b.json', 'a\\b.json'], ['C_evil.json', 'C:evil.json']]
    for (const [written, tampered] of tamperings) {
      const bytes = await writeZip([{ path: written!, bytes: encoder.encode('{}'), compress: false }], MODIFIED_AT)
      expect(() => readZip(patch(bytes, written!, tampered!)), tampered).toThrow('Invalid path')
    }
  })

  it('refuses to write unsafe paths', async () => {
    await expect(writeZip([{ path: '../evil.json', bytes: new Uint8Array(), compress: false }], MODIFIED_AT)).rejects.toThrow('Invalid path')
  })

  it('detects a damaged entry', async () => {
    const bytes = patch(await writeZip([{ path: 'a.json', bytes: encoder.encode('{"value":1}'), compress: false }], MODIFIED_AT), '"value":1', '"value":2')
    await expect(readAll(bytes)).rejects.toThrow('damaged')
  })

  it('stops inflating an entry that grows past the size it declares', async () => {
    const bytes = await writeZip([{ path: 'bomb.json', bytes: new Uint8Array(100_000), compress: true }], MODIFIED_AT)
    const lying = bytes.slice()
    const view = new DataView(lying.buffer)
    const centralDirectoryOffset = view.getUint32(lying.length - 6, true)
    view.setUint32(centralDirectoryOffset + 24, 1000, true)
    await expect(readAll(lying)).rejects.toThrow('larger than it declares')
  })

  it('refuses archives over the limits before inflating anything', async () => {
    const bytes = await writeZip([
      { path: 'a.json', bytes: new Uint8Array(5000), compress: true },
      { path: 'b.json', bytes: new Uint8Array(5000), compress: true },
    ], MODIFIED_AT)
    expect(() => readZip(bytes, { maximumEntries: 1, maximumEntrySize: 10_000, maximumTotalSize: 100_000 })).toThrow('too many files')
    expect(() => readZip(bytes, { maximumEntries: 10, maximumEntrySize: 1000, maximumTotalSize: 100_000 })).toThrow('too large')
    expect(() => readZip(bytes, { maximumEntries: 10, maximumEntrySize: 10_000, maximumTotalSize: 8000 })).toThrow('too large')
  })
})
