import { flattenStoredNodes, readGameArchive, writeZip, type ChapterDocument } from '@cyberdeck/core'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSample, buildSampleFrom, SAMPLES } from '../../../../scripts/samples/sampleArchives'

const samplesFolder = join(import.meta.dirname, '..', '..', '..', '..', 'docs', 'sample')
const source = SAMPLES.find(sample => sample.id === 'pairs')!

describe('the samples built', () => {
  it('give the same identifiers each time, and the exported date the build gives', async () => {
    const first = await buildSample(source, samplesFolder, new Date('2026-11-17T10:00:00Z'))
    const second = await buildSample(source, samplesFolder, new Date('2026-11-18T10:00:00Z'))
    const [one, two] = await Promise.all([readGameArchive(first.archive), readGameArchive(second.archive)])
    expect(one.manifest.project.id).toBe('sample-pairs')
    expect(one.manifest.project.id).toBe(two.manifest.project.id)
    expect(one.manifest.chapters.map(chapter => chapter.id)).toEqual(two.manifest.chapters.map(chapter => chapter.id))
    expect(Object.keys(one.manifest.assetFiles)).toEqual(Object.keys(two.manifest.assetFiles))
    expect(one.manifest.exportedAt).toBe('2026-11-17T10:00:00.000Z')
    expect(two.manifest.exportedAt).toBe('2026-11-18T10:00:00.000Z')
    expect(first.hash).toBe(second.hash)
    expect(one.manifest.project.details.description).toBe(source.description)
    expect(first.cover?.fileName).toBe('cover.svg')
  })

  it('are made of text and files that import without a problem, every one', async () => {
    for (const sample of SAMPLES) {
      const built = await buildSample(sample, samplesFolder, new Date('2026-11-17T10:00:00Z'))
      const archive = await readGameArchive(built.archive)
      expect(archive.manifest.project.name).toBe(sample.name)
      expect(archive.chapters.length).toBeGreaterThan(0)
      // Rock, paper, scissors is the one sample without a cover.
      expect(built.cover === null).toBe(sample.id === 'rock-paper-scissors')
    }
  }, 120_000)
})

describe('the identifiers of a sample', () => {
  const story = (extra: string) => `[import: story en]

[decision: Which = Left | Right]

# First
A line in the first chapter.
${extra}Another line in the first chapter.

# Second
Same line.
[choice: Which]
> Left = Left
> Right = Right
[if: Which is Left]
Left it is.
[else]
Right it is.
[end]
Same line.

# Third
Nothing changes here.
`
  const made = async (text: string) => {
    const empty = await writeZip([], new Date('2026-01-01T00:00:00Z'))
    const built = await buildSampleFrom({ id: 'tiny', folder: '', name: 'Tiny', description: 'A tiny story.' }, text, empty, new Date('2026-11-17T10:00:00Z'))
    return readGameArchive(built.archive)
  }
  const idsOf = (chapter: ChapterDocument) => [chapter.id, ...flattenStoredNodes(chapter.nodes).map(node => node.id)]

  it('are made of what they name, so that a line inserted moves no other chapter’s, nor the lines around it', async () => {
    const before = await made(story(''))
    const after = await made(story('A new line, inserted.\n'))
    expect(before.chapters.map(chapter => chapter.title)).toEqual(['First', 'Second', 'Third'])
    expect(before.manifest.chapters.map(chapter => chapter.id)).toEqual(after.manifest.chapters.map(chapter => chapter.id))
    expect(before.manifest.project.id).toBe('sample-tiny')

    expect(idsOf(after.chapters[1]!)).toEqual(idsOf(before.chapters[1]!))
    expect(idsOf(after.chapters[2]!)).toEqual(idsOf(before.chapters[2]!))
    // In the chapter edited, every page there was is still there under its own identifier, and one is new.
    const first = idsOf(before.chapters[0]!)
    const edited = idsOf(after.chapters[0]!)
    expect(first.every(id => edited.includes(id))).toBe(true)
    expect(edited.length).toBe(first.length + 1)
    // Identical pages of one chapter get an identifier each.
    const second = idsOf(before.chapters[1]!)
    expect(new Set(second).size).toBe(second.length)
  })

  it('are plain, and none is left of the counter the importer counts with', async () => {
    const archive = await made(story(''))
    const text = JSON.stringify([archive.manifest, archive.chapters])
    expect(text).not.toMatch(/"sample-tiny-\d+"/)
    for (const id of [...archive.manifest.project.decisions.map(decision => decision.id), ...archive.chapters.flatMap(idsOf)]) {
      expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/)
    }
  })

  it('give the same hash for the same content, whatever the date of export, and another for other content', async () => {
    const empty = await writeZip([], new Date('2026-01-01T00:00:00Z'))
    const source = { id: 'tiny', folder: '', name: 'Tiny', description: 'A tiny story.' }
    const first = await buildSampleFrom(source, story(''), empty, new Date('2026-11-17T10:00:00Z'))
    const later = await buildSampleFrom(source, story(''), empty, new Date('2026-12-01T10:00:00Z'))
    const edited = await buildSampleFrom(source, story('A new line.\n'), empty, new Date('2026-11-17T10:00:00Z'))
    const renamed = await buildSampleFrom({ ...source, description: 'Another description.' }, story(''), empty, new Date('2026-11-17T10:00:00Z'))
    expect(later.hash).toBe(first.hash)
    expect(edited.hash).not.toBe(first.hash)
    expect(renamed.hash).not.toBe(first.hash)
  })
})
