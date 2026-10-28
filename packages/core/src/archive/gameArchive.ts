import { checkChapterDocument, checkProjectDocument, DocumentError, isPlainIdentifier } from '../format/checkDocuments'
import { flattenStoredNodes, mapInnerLists, type Asset, type ChapterDocument, type ProjectDocument, type StageCommand, type StoredNode } from '../format/storyFormat'
import { STYLE_PROPERTIES_OF_1_1 } from '../format/textStyles'
import { ArchiveError } from './archiveError'
import { isSafeArchivePath, readZip, writeZip, type ZipEntryToWrite } from './zip'

/**
 * A game as players download it, a ZIP archive:
 *
 * - `game.json`: what belongs to the whole game: the project (decisions, characters, backgrounds,
 *   music, positions, dates), the release, every chapter with whether this archive includes it,
 *   and the file of each asset with its SHA-256, so that a file altered after export is refused;
 * - `chapters/<id>/chapter.json` for each included chapter;
 * - `scenes/<id>/scene.json` for every scene, in every archive: any chapter may play them;
 * - `assets/cover.<extension>`, in every archive of the game, so that the library always shows it;
 * - `assets/backgrounds/<name>`, `assets/characters/<character>/<expression>` and
 *   `assets/illustrations/<name>`, `assets/music/<name>` and `assets/sounds/<name>`, named after
 *   their entries; content used by
 *   several entries is stored once.
 *
 * The whole game and a few chapters are the same format: installing merges archives of one game.
 * What only the editor needs, such as the file a chapter was imported from, is left out.
 */
export const ARCHIVE_FORMAT = 1

export const MANIFEST_PATH = 'game.json'

export interface ArchivedChapter {
  id: string
  title: string | null
  included: boolean
}

export interface ArchivedAssetFile {
  path: string
  sha256: string
}

export interface GameManifest {
  archiveFormat: typeof ARCHIVE_FORMAT
  /** Chosen by the author and shown to players: `1.0`, `Chapter 3`… Installing orders archives by `exportedAt`. */
  release: string
  exportedAt: string
  project: ProjectDocument
  /** Every chapter of the game in playing order, so that players see which ones they do not have. */
  chapters: ArchivedChapter[]
  /** The file of each asset the archive includes, by asset identifier. */
  assetFiles: Record<string, ArchivedAssetFile>
}

export interface GameArchive {
  manifest: GameManifest
  /** The included chapters, in playing order. */
  chapters: ChapterDocument[]
  /** Every scene of the game, in the order of `project.sceneOrder`. */
  scenes: ChapterDocument[]
  /** Contents of the asset files, by archive path; each matches its SHA-256. */
  assetFiles: Map<string, Uint8Array<ArrayBuffer>>
}

export interface GameArchiveSource {
  project: ProjectDocument
  /** Every chapter of the project, and its scenes: chapters left out are still listed by title. */
  chapters: readonly ChapterDocument[]
  includedChapterIds: readonly string[]
  readAsset: (asset: Asset) => Promise<Uint8Array<ArrayBuffer>>
  release: string
  exportedAt: Date
}

/** The files a game may carry, and the extension each is stored under. */
const EXTENSIONS_BY_MEDIA_TYPE: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/webm': 'weba',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
}

export const MEDIA_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  weba: 'audio/webm',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

/** The cover, or a file of one of the asset folders, with an extension Datajack plays. */
export const ASSET_FILE_PATH = new RegExp(`^assets/(cover|(backgrounds|illustrations|music|sounds|fonts|characters/[^/]+)/[^/]+)\\.(${Object.keys(MEDIA_TYPES_BY_EXTENSION).join('|')})$`)

const SHA_256 = /^[0-9a-f]{64}$/
const MAXIMUM_RELEASE_LENGTH = 40
/** Characters Windows refuses in file names; control characters are removed too. */
const UNSAFE_FILE_NAME_CHARACTERS = /[<>:"/\\|?*\p{Cc}]/gu
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/i

export function isSupportedAssetMediaType(mediaType: string): boolean {
  return Object.hasOwn(EXTENSIONS_BY_MEDIA_TYPE, mediaType)
}

export async function createGameArchive(source: GameArchiveSource): Promise<Uint8Array<ArrayBuffer>> {
  const { project, includedChapterIds } = source
  const chaptersById = new Map(source.chapters.map(chapter => [chapter.id, chapter]))
  const unknownChapterId = includedChapterIds.find(chapterId => !project.chapterOrder.includes(chapterId) || !chaptersById.has(chapterId))
  if (unknownChapterId !== undefined) {
    throw new Error(`No chapter ${unknownChapterId} in the project`)
  }
  const included = project.chapterOrder.filter(chapterId => includedChapterIds.includes(chapterId)).map(chapterId => chaptersById.get(chapterId)!)
  const scenes = project.sceneOrder.map(sceneId => {
    const scene = chaptersById.get(sceneId)
    if (scene === undefined) {
      throw new Error(`No scene ${sceneId} in the project`)
    }
    return scene
  })

  const release = source.release.trim()
  if (release === '' || release.length > MAXIMUM_RELEASE_LENGTH) {
    throw new Error(`A release needs 1 to ${MAXIMUM_RELEASE_LENGTH} characters`)
  }

  const assetFiles: Record<string, ArchivedAssetFile> = {}
  const pathsByContent = new Map<string, string>()
  const takenPaths = new Set<string>()
  const assetEntries: ZipEntryToWrite[] = []
  const usedAssetIds = assetsUsedBy(project, [...included, ...scenes])
  if (project.details.coverAssetId !== null) {
    usedAssetIds.add(project.details.coverAssetId)
  }
  for (const asset of project.assets.filter(candidate => usedAssetIds.has(candidate.id))) {
    const extension = EXTENSIONS_BY_MEDIA_TYPE[asset.mediaType]
    if (extension === undefined) {
      throw new Error(`${asset.fileName}: Datajack does not play ${asset.mediaType} files`)
    }
    const bytes = await source.readAsset(asset)
    const hash = await sha256(bytes)
    let path = pathsByContent.get(hash)
    if (path === undefined) {
      path = uniquePath(assetFolderAndName(project, asset.id), extension, takenPaths)
      pathsByContent.set(hash, path)
      assetEntries.push({ path, bytes, compress: false })
    }
    assetFiles[asset.id] = { path, sha256: hash }
  }

  const formatVersion = playerFormatVersion(project)
  const manifest: GameManifest = {
    archiveFormat: ARCHIVE_FORMAT,
    release,
    exportedAt: source.exportedAt.toISOString(),
    project: { ...project, formatVersion },
    chapters: project.chapterOrder.map(chapterId => ({
      id: chapterId,
      title: chaptersById.get(chapterId)?.title ?? null,
      included: includedChapterIds.includes(chapterId),
    })),
    assetFiles,
  }
  return writeZip([
    jsonEntry(MANIFEST_PATH, manifest),
    ...included.map(chapter => jsonEntry(chapterPath(chapter.id), forPlayers(chapter, formatVersion))),
    ...scenes.map(scene => jsonEntry(scenePath(scene.id), forPlayers(scene, formatVersion))),
    ...assetEntries,
  ], source.exportedAt)
}

/**
 * The oldest format that holds the game, so that players who have not updated Datajack can still
 * play what it draws: 1.1 unless a style uses a property 1.0 does not know, which it would refuse.
 * What 1.0 does not know besides, the CSS and title cards, it leaves out.
 */
export function playerFormatVersion(project: ProjectDocument): string {
  // Datajack 1.0 refuses a style word it does not know, and a font file, which it takes for a misplaced file.
  const needsNewer = project.fonts.some(font => font.assetId !== null)
    || project.styles.some(style => style.properties.some(property => !STYLE_PROPERTIES_OF_1_1.includes(property)))
  return needsNewer ? '1.2' : '1.1'
}

/** A chapter as players get it: without where it was imported from, nor where definitions are written, which play nothing. */
function forPlayers({ importedFrom: _editorHistory, ...chapter }: ChapterDocument, formatVersion: string): ChapterDocument {
  const withoutDefinitions = (nodes: readonly StoredNode[]): StoredNode[] => nodes
    .filter(node => node.type !== 'definition')
    .map(node => mapInnerLists(node, list => withoutDefinitions(list.nodes)))
  return { ...chapter, formatVersion, nodes: withoutDefinitions(chapter.nodes) }
}

/** Reads and checks a downloaded archive; throws an error worded for the player when it cannot be played. */
export async function readGameArchive(bytes: Uint8Array<ArrayBuffer>): Promise<GameArchive> {
  const entries = new Map(readZip(bytes).map(entry => [entry.path, entry]))
  const readJson = async (path: string) => {
    const entry = entries.get(path)
    if (entry === undefined) {
      throw new ArchiveError({ code: 'notAGame', path })
    }
    try {
      return JSON.parse(new TextDecoder().decode(await entry.read())) as unknown
    } catch (error) {
      throw error instanceof SyntaxError ? new ArchiveError({ code: 'invalidJson', path }) : error
    }
  }

  const manifest = checkGameManifest(await readJson(MANIFEST_PATH))
  const chapters: ChapterDocument[] = []
  for (const archived of manifest.chapters.filter(chapter => chapter.included)) {
    const path = chapterPath(archived.id)
    const value = await readJson(path)
    const chapter = withDocumentPath(path, () => checkChapterDocument(value, 'chapter'))
    if (chapter.id !== archived.id) {
      throw new ArchiveError({ code: 'otherChapter', path })
    }
    chapters.push(chapter)
  }
  const scenes: ChapterDocument[] = []
  for (const sceneId of manifest.project.sceneOrder) {
    const path = scenePath(sceneId)
    const value = await readJson(path)
    const scene = withDocumentPath(path, () => checkChapterDocument(value, 'scene'))
    if (scene.id !== sceneId) {
      throw new ArchiveError({ code: 'otherScene', path })
    }
    scenes.push(scene)
  }

  const assetFiles = new Map<string, Uint8Array<ArrayBuffer>>()
  for (const { path, sha256: expectedHash } of Object.values(manifest.assetFiles)) {
    if (assetFiles.has(path)) {
      continue
    }
    const entry = entries.get(path)
    if (entry === undefined) {
      throw new ArchiveError({ code: 'missingFile', path })
    }
    const content = await entry.read()
    if (await sha256(content) !== expectedHash) {
      throw new ArchiveError({ code: 'alteredFile', path })
    }
    assetFiles.set(path, content)
  }
  return { manifest, chapters, scenes, assetFiles }
}

/** Assets shown or played by the chapters: what an archive of these chapters must carry. */
export function assetsUsedBy(project: ProjectDocument, chapters: readonly ChapterDocument[]): Set<string> {
  // Fonts are named by the CSS, which any chapter's styles may use: every archive carries them all.
  const used = new Set<string>(project.fonts.flatMap(font => font.assetId === null ? [] : [font.assetId]))
  const add = (assetId: string | null | undefined) => {
    if (assetId != null) {
      used.add(assetId)
    }
  }
  const visit = (command: StageCommand) => {
    switch (command.type) {
      case 'enter':
      case 'expression':
        add(project.characters.find(character => character.id === command.characterId)
          ?.expressions.find(expression => expression.id === command.expressionId)?.assetId)
        break
      case 'background':
        add(project.backgrounds.find(background => background.id === command.backgroundId)?.assetId)
        break
      case 'music':
        add(project.music.find(track => track.id === command.musicId)?.assetId)
        break
      case 'sound':
        add(project.sounds.find(sound => sound.id === command.soundId)?.assetId)
        break
      case 'illustration':
        add(project.illustrations.find(illustration => illustration.id === command.illustrationId)?.assetId)
        break
    }
  }
  for (const node of chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes))) {
    if (node.type === 'page') {
      node.commandsBefore.forEach(visit)
      node.inlineCommands.forEach(visit)
    } else if (node.type === 'stage') {
      node.commands.forEach(visit)
    }
  }
  return used
}

/** Where an asset goes in the archive, after the entry that uses it. */
function assetFolderAndName(project: ProjectDocument, assetId: string): { folder: string; name: string } {
  if (project.details.coverAssetId === assetId) {
    return { folder: 'assets', name: 'cover' }
  }
  const background = project.backgrounds.find(candidate => candidate.assetId === assetId)
  if (background !== undefined) {
    return { folder: 'assets/backgrounds', name: background.name }
  }
  const track = project.music.find(candidate => candidate.assetId === assetId)
  if (track !== undefined) {
    return { folder: 'assets/music', name: track.name }
  }
  const illustration = project.illustrations.find(candidate => candidate.assetId === assetId)
  if (illustration !== undefined) {
    return { folder: 'assets/illustrations', name: illustration.name }
  }
  const sound = project.sounds.find(candidate => candidate.assetId === assetId)
  if (sound !== undefined) {
    return { folder: 'assets/sounds', name: sound.name }
  }
  const font = project.fonts.find(candidate => candidate.assetId === assetId)
  if (font !== undefined) {
    return { folder: 'assets/fonts', name: font.name }
  }
  for (const character of project.characters) {
    const expression = character.expressions.find(candidate => candidate.assetId === assetId)
    if (expression !== undefined) {
      return { folder: `assets/characters/${safeFileName(character.name)}`, name: expression.name }
    }
  }
  throw new Error(`No entry uses the asset ${assetId}`)
}

/** Names differing only in case are one file on Windows and macOS: the later one gets a number. */
function uniquePath({ folder, name }: { folder: string; name: string }, extension: string, takenPaths: Set<string>): string {
  const baseName = safeFileName(name)
  for (let number = 1; ; number++) {
    const path = `${folder}/${number === 1 ? baseName : `${baseName} ${number}`}.${extension}`
    if (!takenPaths.has(path.toLocaleLowerCase())) {
      takenPaths.add(path.toLocaleLowerCase())
      return path
    }
  }
}

/** A name every system accepts for a file: `fallback` when nothing of the name is left. */
export function safeFileName(name: string, fallback = 'file'): string {
  const cleaned = name.replace(UNSAFE_FILE_NAME_CHARACTERS, '').trim().replace(/[. ]+$/, '')
  return cleaned === '' ? fallback : RESERVED_WINDOWS_NAMES.test(cleaned) ? `${cleaned}_` : cleaned
}

export function chapterPath(chapterId: string): string {
  return `chapters/${chapterId}/chapter.json`
}

export function scenePath(sceneId: string): string {
  return `scenes/${sceneId}/scene.json`
}

/** Checks a manifest read from an archive, or from where a player stored it. */
export function checkGameManifest(value: unknown): GameManifest {
  return withDocumentPath(MANIFEST_PATH, () => {
    if (typeof value !== 'object' || value === null) {
      throw new DocumentError('game', 'an object')
    }
    const fields = value as Record<string, unknown>
    if (fields.archiveFormat !== ARCHIVE_FORMAT) {
      throw new ArchiveError({ code: 'newerPlayer' })
    }
    if (typeof fields.release !== 'string' || fields.release.trim() === '' || fields.release.length > MAXIMUM_RELEASE_LENGTH) {
      throw new DocumentError('game.release', `1 to ${MAXIMUM_RELEASE_LENGTH} characters`)
    }
    if (typeof fields.exportedAt !== 'string' || Number.isNaN(Date.parse(fields.exportedAt))) {
      throw new DocumentError('game.exportedAt', 'a date')
    }
    const project = checkProjectDocument(fields.project, 'game.project')
    if (!isPlainIdentifier(project.id)) {
      throw new DocumentError('game.project.id', 'a plain identifier')
    }

    const chapterList = Array.isArray(fields.chapters) ? fields.chapters : []
    const chapters = chapterList.map((chapter: unknown, index): ArchivedChapter => {
      const chapterFields = typeof chapter === 'object' && chapter !== null ? chapter as Record<string, unknown> : {}
      const path = `game.chapters[${index}]`
      if (typeof chapterFields.id !== 'string' || !isPlainIdentifier(chapterFields.id)) {
        throw new DocumentError(`${path}.id`, 'a plain identifier')
      }
      if (chapterFields.title !== null && typeof chapterFields.title !== 'string') {
        throw new DocumentError(`${path}.title`, 'a string')
      }
      if (typeof chapterFields.included !== 'boolean') {
        throw new DocumentError(`${path}.included`, 'true or false')
      }
      return { id: chapterFields.id, title: chapterFields.title, included: chapterFields.included }
    })
    if (chapters.map(chapter => chapter.id).join('/') !== project.chapterOrder.join('/')) {
      throw new DocumentError('game.chapters', 'the chapters of game.project.chapterOrder')
    }
    project.sceneOrder.forEach((sceneId, index) => {
      if (!isPlainIdentifier(sceneId)) {
        throw new DocumentError(`game.project.sceneOrder[${index}]`, 'a plain identifier')
      }
    })

    const assetFileFields = typeof fields.assetFiles === 'object' && fields.assetFiles !== null ? fields.assetFiles as Record<string, unknown> : null
    if (assetFileFields === null) {
      throw new DocumentError('game.assetFiles', 'an object')
    }
    const assetFiles: Record<string, ArchivedAssetFile> = {}
    const hashesByPath = new Map<string, string>()
    for (const [assetId, file] of Object.entries(assetFileFields)) {
      const fileFields = typeof file === 'object' && file !== null ? file as Record<string, unknown> : {}
      const { path, sha256: hash } = fileFields
      if (typeof path !== 'string' || !ASSET_FILE_PATH.test(path) || !isSafeArchivePath(path)) {
        throw new DocumentError(`game.assetFiles.${assetId}.path`, 'an asset file Datajack plays')
      }
      if (typeof hash !== 'string' || !SHA_256.test(hash) || (hashesByPath.get(path) ?? hash) !== hash) {
        throw new DocumentError(`game.assetFiles.${assetId}.sha256`, 'the SHA-256 of the file')
      }
      if (!project.assets.some(asset => asset.id === assetId)) {
        throw new DocumentError(`game.assetFiles.${assetId}`, 'an asset of the project')
      }
      hashesByPath.set(path, hash)
      assetFiles[assetId] = { path, sha256: hash }
    }
    return { archiveFormat: ARCHIVE_FORMAT, release: fields.release, exportedAt: fields.exportedAt, project, chapters, assetFiles }
  })
}

/** Prefixes document errors with the file they are in. */
function withDocumentPath<Result>(fileName: string, check: () => Result): Result {
  try {
    return check()
  } catch (error) {
    if (!(error instanceof DocumentError)) {
      throw error
    }
    const code = error.path.endsWith('.formatVersion') ? 'newerFormat' : 'invalidDocument'
    throw new ArchiveError({ code, path: fileName, detail: error.message })
  }
}

function jsonEntry(path: string, value: unknown): ZipEntryToWrite {
  return { path, bytes: new TextEncoder().encode(JSON.stringify(value, null, 2)), compress: true }
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}
