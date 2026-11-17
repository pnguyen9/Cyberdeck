import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createGameArchive, ENGLISH_STORY_WORDS, previewImport, readGameArchive, type ChapterDocument, type Environment, type PageLayout } from '@cyberdeck/core'
import { sampleGameId } from '../../packages/stage/src/app/samples'
import { createNewProject, OpenProject } from '../../packages/cyberdeck/src/projects/openProject'
import { memoryProjectStore } from '../../packages/cyberdeck/tests/projects/memoryProjectStore'
import { withStableIds } from './stableIds'
import { FALLBACK_WIDTH, GEORGIA_WIDTHS } from './textWidths'

/** A sample of docs/sample: where its files are, and how the shelves present it. */
export interface SampleSource {
  /** What its files, its built script and its project are named after: `knee-deep`. */
  id: string
  /** The folder of docs/sample holding `<id>.txt` and `<id>-assets.zip`. */
  folder: string
  name: string
  description: string
}

export const SAMPLES: readonly SampleSource[] = [
  { id: 'sakura-week', folder: 'sakura-week', name: 'Sakura Week', description: 'A school week in April, five days before the cherry blossom festival: friends to make, a job to choose, and an evening under the lanterns. Many choices, several endings.' },
  { id: 'knee-deep', folder: 'knee-deep', name: 'Knee-Deep', description: 'A humorous dungeon crawl with a very small hero, a very large debt to a tavern keeper, and a Delve that keeps changing its mind. Fights, shops, bargains, bosses and endings that the next game remembers.' },
  { id: 'battle', folder: 'minigames/battle', name: 'Battle', description: 'A minigame: two creatures in an arena, with fire, leaf and water special moves, guards and potions. A single duel or three in a row.' },
  { id: 'blackjack', folder: 'minigames/blackjack', name: 'Blackjack', description: 'A minigame: cards against the dealer, with a shoe of one to eight decks, hitting, standing, doubling and a purse that is kept from one game to the next.' },
  { id: 'minesweeper', folder: 'minigames/minesweeper', name: 'Minesweeper', description: 'A minigame: a grid with hidden mines, numbers to read and flags to plant.' },
  { id: 'pairs', folder: 'minigames/pairs', name: 'Pairs', description: 'A minigame: sixteen tiles face down, eight pairs of animals to find, and a count of the turns it took.' },
  { id: 'rock-paper-scissors', folder: 'minigames/rock-paper-scissors', name: 'Rock, paper, scissors', description: 'A minigame: the oldest duel there is, played against a computer that may or may not be cheating.' },
  { id: 'virtual-pet', folder: 'minigames/virtual-pet', name: 'Virtual pet', description: 'A minigame: Pip needs feeding, playing with, petting and sleep, and notices the time of day you come to visit.' },
]

/** A sample as the shelves hold it. */
export interface BuiltSample {
  id: string
  name: string
  description: string
  /** SHA-256 of the exported game, without its date of export, in hexadecimal: what "the same content" means. */
  hash: string
  /** The game archive, as Datajack installs it and Cyberdeck makes a project from it. */
  archive: Uint8Array<ArrayBuffer>
  /** The game's cover file, if it has one. */
  cover: { fileName: string; bytes: Uint8Array<ArrayBuffer> } | null
}

/** How wide the pages may run: the text box of the stage, measured by the width of each character in Georgia. */
const PAGE_LAYOUT: PageLayout = {
  lineWidth: 1520 - 22,
  maxLines: 2,
  measureText: text => [...text].reduce((total, character) => total + (GEORGIA_WIDTHS[character] ?? FALLBACK_WIDTH), 0),
}

/**
 * The date written in the documents the importer makes. A fixed one, so that building twice gives the
 * same game but for its date of export: that, and only that, tells two releases of one content apart.
 */
const MADE_AT = '2026-01-01T00:00:00.000Z'

/** Identifiers made of the sample's name and a count, as the importer asks for them; `withStableIds` then replaces them by ones that last. The first is the project's. */
export function sampleEnvironment(id: string): Environment {
  let count = 0
  return {
    createId: () => {
      count += 1
      return count === 1 ? sampleGameId(id) : `${sampleGameId(id)}-${count}`
    },
    now: () => MADE_AT,
  }
}

/** What "the same content" means: the game as exported, but for the date it was exported on (its files by their hashes). */
export async function contentHash(archive: Uint8Array<ArrayBuffer>): Promise<string> {
  const { manifest, chapters, scenes } = await readGameArchive(archive)
  return createHash('sha256').update(JSON.stringify({ manifest: { ...manifest, exportedAt: '' }, chapters, scenes })).digest('hex')
}

/**
 * Makes a sample's game as an author would in Cyberdeck: the text imported, the zip of files added, a
 * description written, then exported, with identifiers that stay the same when the text is edited.
 * `exportedAt` is the build's time, so that an archive installed over an older one is always the newer export.
 */
export function buildSample(source: SampleSource, samplesFolder: string, exportedAt: Date): Promise<BuiltSample> {
  const text = readFileSync(join(samplesFolder, source.folder, `${source.id}.txt`), 'utf8')
  const assets = readFileSync(join(samplesFolder, source.folder, `${source.id}-assets.zip`))
  return buildSampleFrom(source, text, new Uint8Array(assets), exportedAt)
}

/** `buildSample` for a text and a zip given: what the samples' own files are read into, and what the tests edit. */
export async function buildSampleFrom(source: SampleSource, text: string, assets: Uint8Array<ArrayBuffer>, exportedAt: Date): Promise<BuiltSample> {
  const memory = memoryProjectStore()
  const environment = sampleEnvironment(source.id)
  const created = await createNewProject(memory.store, source.name, 'en', environment)
  const open = await OpenProject.open(memory.store, created.id, environment)
  const preview = previewImport(text, open.project, PAGE_LAYOUT, { words: ENGLISH_STORY_WORDS })
  if (preview.problems.length > 0) {
    throw new Error(`The sample ${source.id} does not import: ${JSON.stringify(preview.problems)}`)
  }
  await open.importText(preview, { type: 'newChapters' }, `${source.id}.txt`)
  await open.addFiles([{ name: `${source.id}-assets.zip`, mediaType: 'application/zip', bytes: assets }])
  await open.updateDetails({ description: source.description })
  const documents = (await memory.store.readChapters(open.project.id)) as ChapterDocument[]
  const stable = withStableIds(open.project, documents)
  const archive = await createGameArchive({
    project: stable.project,
    chapters: stable.documents,
    includedChapterIds: stable.project.chapterOrder,
    readAsset: asset => memory.store.readAsset(open.project.id, stable.assetIds.get(asset.id)!),
    release: '1.0',
    exportedAt,
  })
  const coverAsset = open.project.assets.find(asset => asset.id === open.project.details.coverAssetId)
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    hash: await contentHash(archive),
    archive,
    cover: coverAsset === undefined ? null : { fileName: coverAsset.fileName, bytes: await memory.store.readAsset(open.project.id, coverAsset.id) },
  }
}
