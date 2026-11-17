import { createHash } from 'node:crypto'
import type { ChapterDocument, ProjectDocument } from '@cyberdeck/core'

/**
 * Identifiers that depend on what they name, not on the order things were made in. Saves point at a
 * chapter and a page by identifier, so a sample whose text is edited must keep the identifiers of what
 * it did not edit: the importer's own are a counter's, which an inserted line moves for every later one.
 *
 * - the entries of the project (decisions and their values, counters, characters and their
 *   expressions, backgrounds, music, files…) are named after their names, in their kind;
 * - chapters and scenes are named after their titles;
 * - pages, branches and options are named after their chapter and a short hash of their own content
 *   (what they hold apart from the pages inside them), with a number for the repeats of one chapter.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const isRecord = (value: unknown): value is { [key: string]: Json } => typeof value === 'object' && value !== null && !Array.isArray(value)
const isIdentified = (value: unknown) => isRecord(value) && typeof value.id === 'string'
const hashOf = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 8)

/** Letters and digits of a name, in lower case and without accents, joined by hyphens, short enough for the longest identifier to fit in 100 characters. */
export function slugOf(name: string, fallback: unknown): string {
  const slug = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28).replace(/-+$/, '')
  return slug === '' ? hashOf(fallback) : slug
}

/** Every value of a document, replaced if it is an identifier changed: strings, and the keys of records. */
function replaced(value: Json, changes: ReadonlyMap<string, string>): Json {
  if (typeof value === 'string') {
    return changes.get(value) ?? value
  }
  if (Array.isArray(value)) {
    return value.map(item => replaced(item, changes))
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [changes.get(key) ?? key, replaced(item, changes)]))
  }
  return value
}

/** The entries of an object that are themselves objects with an identifier, or arrays of them: where identifiers are made. */
function identified(value: Json): Array<{ key: string; item: { [key: string]: Json } & { id: string } }> {
  if (!isRecord(value)) {
    return []
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const items = Array.isArray(child) ? child : [child]
    return items.flatMap(item => isIdentified(item) ? [{ key, item: item as { [key: string]: Json } & { id: string } }] : [])
  })
}

/** The identifiers the project's entries and the chapters would have, by the identifier they have. */
function namedChanges(project: ProjectDocument, chapters: readonly ChapterDocument[]): Map<string, string> {
  const changes = new Map<string, string>()
  const taken = new Set<string>([project.id])
  const claim = (old: string, wanted: string) => {
    let identifier = wanted
    for (let number = 2; taken.has(identifier); number++) {
      identifier = `${wanted}-${number}`
    }
    taken.add(identifier)
    changes.set(old, identifier)
    return identifier
  }
  const visit = (parent: { [key: string]: Json }, parentIdentifier: string | null) => {
    for (const { key, item } of identified(parent)) {
      const { id, ...content } = item
      const label = [item.name, item.fileName, item.title].find((value): value is string => typeof value === 'string')
      const own = claim(id, `${parentIdentifier ?? key}-${slugOf(label ?? '', content)}`)
      visit(item, own)
    }
  }
  visit(project as unknown as { [key: string]: Json }, null)
  for (const [ids, kind] of [[project.chapterOrder, 'chapter'], [project.sceneOrder, 'scene']] as const) {
    for (const chapterId of ids) {
      const chapter = chapters.find(candidate => candidate.id === chapterId)!
      claim(chapterId, `${kind}-${slugOf(chapter.title ?? '', chapter.nodes)}`)
    }
  }
  return changes
}

/** The pages, branches and options of a chapter, in reading order, with the content that is theirs alone. */
function* partsOf(value: Json): Generator<{ [key: string]: Json } & { id: string }> {
  for (const { item } of identified(value)) {
    yield item
    yield* partsOf(item)
  }
}

/** The identifiers of a chapter's pages, branches and options: the chapter's, a hash of what they hold, a number for repeats. */
function partChanges(chapter: ChapterDocument): Map<string, string> {
  const changes = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const part of partsOf({ nodes: chapter.nodes } as unknown as Json)) {
    const { id, ...own } = part
    // What the part holds, without the parts inside it: editing a page leaves the choice around it as it was.
    const shallow = Object.fromEntries(Object.entries(own).filter(([, value]) => !(Array.isArray(value) ? value : [value]).some(isIdentified)))
    const key = hashOf(shallow)
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    changes.set(id, `${chapter.id}-${key}${count === 1 ? '' : `-${count}`}`)
  }
  return changes
}

/**
 * The project and its chapters and scenes with stable identifiers, and what each file's was before
 * (`assetIds`: new to old, to read the files by). The project's own identifier stays.
 */
export function withStableIds(project: ProjectDocument, documents: readonly ChapterDocument[]): { project: ProjectDocument; documents: ChapterDocument[]; assetIds: Map<string, string> } {
  const named = namedChanges(project, documents)
  const renamed = documents.map(document => replaced(document as unknown as Json, named) as unknown as ChapterDocument)
  const parts = renamed.map(partChanges)
  const everything = new Map([...named, ...parts.flatMap(changes => [...changes])])
  const result = {
    project: replaced(project as unknown as Json, everything) as unknown as ProjectDocument,
    documents: renamed.map(document => replaced(document as unknown as Json, everything) as unknown as ChapterDocument),
    assetIds: new Map(project.assets.map(asset => [named.get(asset.id)!, asset.id])),
  }
  const leftover = JSON.stringify([result.project, result.documents]).match(new RegExp(`"${project.id}-\\d+"`))
  if (leftover !== null) {
    throw new Error(`An identifier of the sample ${project.id} was not made stable: ${leftover[0]}`)
  }
  return result
}
