import { describe, expect, it } from 'vitest'
import { createSampleRecord, sampleState } from '../../src/library/sampleShelf'
import { memoryStorage } from '../memoryStorage'

const sample = { id: 'knee-deep', hash: 'abc' }

describe('the shelf of samples', () => {
  it('offers a sample that is not in the library to be added', () => {
    expect(sampleState(sample, new Set(['sample-pairs']), { 'knee-deep': 'abc' })).toBe('add')
  })

  it('says a sample is in the library when it was installed with the content built in', () => {
    expect(sampleState(sample, new Set(['sample-knee-deep']), { 'knee-deep': 'abc' })).toBe('inLibrary')
  })

  it('offers the update when the content built in differs from what the shelf installed', () => {
    expect(sampleState(sample, new Set(['sample-knee-deep']), { 'knee-deep': 'older' })).toBe('update')
  })

  it('offers the update of a sample installed without a record', () => {
    expect(sampleState(sample, new Set(['sample-knee-deep']), {})).toBe('update')
  })

  it('remembers what it installed, sample by sample, and shrugs at storage that fails', () => {
    const storage = memoryStorage()
    const record = createSampleRecord(() => storage)
    record.write('knee-deep', 'abc')
    record.write('pairs', 'def')
    expect(createSampleRecord(() => storage).read()).toEqual({ 'knee-deep': 'abc', pairs: 'def' })

    storage.setItem('datajack:samples', 'not json')
    expect(record.read()).toEqual({})

    const failing = createSampleRecord(() => { throw new Error('blocked') })
    expect(failing.read()).toEqual({})
    expect(() => failing.write('pairs', 'def')).not.toThrow()
  })
})
