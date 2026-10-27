import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { importText } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

/**
 * Each `tests/import/<name>.txt` is imported and compared with `<name>.expected.json`, written by
 * hand. Pages are 2 lines of 40 characters (see `monospaceLayout`), so expected splits can be
 * counted on the fingers.
 */
const examplesDirectory = new URL('./import/', import.meta.url)
const inputFileNames = readdirSync(examplesDirectory).filter(fileName => fileName.endsWith('.txt')).sort()

describe('import examples', () => {
  for (const inputFileName of inputFileNames) {
    const exampleName = inputFileName.replace(/\.txt$/, '')

    it(exampleName, () => {
      const input = readFileSync(new URL(inputFileName, examplesDirectory), 'utf8')
      const expected = JSON.parse(readFileSync(new URL(`${exampleName}.expected.json`, examplesDirectory), 'utf8'))

      expect(importText(input, { layout: monospaceLayout, locale: 'en' })).toEqual(expected)
    })
  }
})
