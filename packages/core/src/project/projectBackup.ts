import { readZip, writeZip } from '../archive/zip'
import { checkChapterDocument, checkProjectDocument, DocumentError, isPlainIdentifier } from '../format/checkDocuments'
import type { Asset, ChapterDocument, ProjectDocument } from '../format/storyFormat'

/**
 * A project as its folder, zipped: `<project id>/project.json`, `<project id>/chapters/<chapter
 * id>.json` and `<project id>/assets/<asset id>`, files kept under their identifier whatever their
 * original name. A backup holds everything the editor needs, the history of imports included.
 */
export interface ProjectBackup {
  project: ProjectDocument
  /** In the project's order. */
  chapters: ChapterDocument[]
  /** File contents by asset identifier. */
  assetFiles: Map<string, Uint8Array<ArrayBuffer>>
}

export async function createProjectBackup(
  project: ProjectDocument,
  chapters: readonly ChapterDocument[],
  readAsset: (asset: Asset) => Promise<Uint8Array<ArrayBuffer>>,
  now: Date,
): Promise<Uint8Array<ArrayBuffer>> {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2))
  const folder = project.id
  // Scenes are kept with the chapters, as in the project's folder.
  const ordered = [...project.chapterOrder, ...project.sceneOrder].flatMap(chapterId => chapters.filter(chapter => chapter.id === chapterId))
  const assets = await Promise.all(project.assets.map(async asset => ({ asset, bytes: await readAsset(asset) })))
  return writeZip([
    { path: `${folder}/project.json`, bytes: encode(project), compress: true },
    ...ordered.map(chapter => ({ path: `${folder}/chapters/${chapter.id}.json`, bytes: encode(chapter), compress: true })),
    ...assets.map(({ asset, bytes }) => ({ path: `${folder}/assets/${asset.id}`, bytes, compress: false })),
  ], now)
}

/** Reads and checks a backup; throws an error worded for the author when it cannot be restored. */
export async function readProjectBackup(bytes: Uint8Array<ArrayBuffer>): Promise<ProjectBackup> {
  const entries = new Map(readZip(bytes).map(entry => [entry.path, entry]))
  const projectPath = [...entries.keys()].find(path => /^[^/]+\/project\.json$/.test(path))
  if (projectPath === undefined) {
    throw new Error('This archive has no project.json: it is not a Cyberdeck backup')
  }
  const folder = projectPath.slice(0, -'/project.json'.length)
  const read = async (path: string, description: string) => {
    const entry = entries.get(path)
    if (entry === undefined) {
      throw new Error(`The backup has no ${description} (${path})`)
    }
    return entry.read()
  }
  const readJson = async (path: string, description: string, check: (value: unknown) => unknown) => {
    const text = new TextDecoder().decode(await read(path, description))
    try {
      return check(JSON.parse(text))
    } catch (error) {
      throw new Error(`${path} is invalid: ${error instanceof DocumentError || error instanceof SyntaxError ? error.message : String(error)}`)
    }
  }

  const project = await readJson(projectPath, 'project', value => checkProjectDocument(value, 'project')) as ProjectDocument
  if (!isPlainIdentifier(project.id) || project.id !== folder) {
    throw new Error('The backup folder is not named after its project')
  }
  const chapters: ChapterDocument[] = []
  for (const chapterId of [...project.chapterOrder, ...project.sceneOrder]) {
    if (!isPlainIdentifier(chapterId)) {
      throw new Error(`Invalid chapter identifier ${JSON.stringify(chapterId)}`)
    }
    const chapter = await readJson(`${folder}/chapters/${chapterId}.json`, 'chapter', value => checkChapterDocument(value, 'chapter')) as ChapterDocument
    if (chapter.id !== chapterId) {
      throw new Error(`${folder}/chapters/${chapterId}.json holds another chapter`)
    }
    chapters.push(chapter)
  }
  const assetFiles = new Map<string, Uint8Array<ArrayBuffer>>()
  for (const asset of project.assets) {
    if (!isPlainIdentifier(asset.id)) {
      throw new Error(`Invalid asset identifier ${JSON.stringify(asset.id)}`)
    }
    const content = await read(`${folder}/assets/${asset.id}`, `file of ${asset.fileName}`)
    if (content.length !== asset.byteSize) {
      throw new Error(`${asset.fileName} is damaged in the backup`)
    }
    assetFiles.set(asset.id, content)
  }
  return { project, chapters, assetFiles }
}
