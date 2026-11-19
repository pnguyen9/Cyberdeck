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

  it('remembers what it installed, profile by profile and sample by sample, and shrugs at storage that fails', () => {
    const storage = memoryStorage()
    const record = createSampleRecord(() => storage)
    record.write('sam', 'knee-deep', 'abc')
    record.write('sam', 'pairs', 'def')
    record.write('alex', 'pairs', 'older')
    expect(createSampleRecord(() => storage).read('sam')).toEqual({ 'knee-deep': 'abc', pairs: 'def' })
    expect(record.read('alex')).toEqual({ pairs: 'older' })

    storage.setItem('datajack:samples', 'not json')
    expect(record.read('sam')).toEqual({})

    const failing = createSampleRecord(() => { throw new Error('blocked') })
    expect(failing.read('sam')).toEqual({})
    expect(() => failing.write('sam', 'pairs', 'def')).not.toThrow()
  })

  it('reads the record of an earlier Datajack for a profile with none of its own, as its games went to every profile', () => {
    const storage = memoryStorage()
    storage.setItem('datajack:samples', JSON.stringify({ pairs: 'abc' }))
    const record = createSampleRecord(() => storage)
    expect(record.read('sam')).toEqual({ pairs: 'abc' })

    record.write('sam', 'knee-deep', 'def')
    expect([record.read('sam'), record.read('alex')]).toEqual([{ pairs: 'abc', 'knee-deep': 'def' }, { pairs: 'abc' }])
  })

  it('gives the record of an earlier Datajack to the profiles that received its games, then drops it: a new profile starts with none', () => {
    const storage = memoryStorage()
    storage.setItem('datajack:samples', JSON.stringify({ pairs: 'abc', sam: { 'knee-deep': 'def' } }))
    const record = createSampleRecord(() => storage)

    record.adoptEarlier(['sam', 'alex'])

    expect([record.read('sam'), record.read('alex'), record.read('kim')]).toEqual([{ 'knee-deep': 'def' }, { pairs: 'abc' }, {}])
  })
})
