import { isFileError, isJsonObject, SAFE_SEGMENT, writeAtomically } from '@cyberdeck/desktop/files'
import { mkdir, readdir, readFile, unlink } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

export interface ProjectFoldersOptions {
  /** The application's own data folder, which remembers where projects are. */
  settingsFolder: string
  /** Where projects go until the author chooses: `Cyberdeck` in it. */
  documentsFolder: string
  /** Moves a folder to the system's trash, from where the author can bring it back. */
  trash: (path: string) => Promise<void>
}

const MAXIMUM_DOCUMENT_LENGTH = 20_000_000

/**
 * Projects as folders on the disk, in a folder the author chooses: `<project>/project.json`,
 * `<project>/chapters/<chapter>.json` and `<project>/assets/<asset>`, each named after its
 * identifier. Documents are replaced in one move, so that a crash never leaves half of one;
 * operations run one after another; a deleted project goes to the trash.
 */
export class ProjectFolders {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: ProjectFoldersOptions) {}

  folder(): Promise<string> {
    return this.inTurn(() => this.projectsFolder())
  }

  changeFolder(folder: string): Promise<void> {
    return this.inTurn(async () => {
      if (!isAbsolute(folder)) {
        throw new Error('The projects folder must be an absolute path')
      }
      await mkdir(this.options.settingsFolder, { recursive: true })
      await writeAtomically(this.settingsPath, JSON.stringify({ projectsFolder: folder }, null, 2))
    })
  }

  /** The `project.json` of every project folder; folders that are not projects are left alone. */
  listProjects(): Promise<string[]> {
    return this.inTurn(async () => {
      const root = await this.projectsFolder()
      const folders = await readdir(root, { withFileTypes: true }).catch(() => [])
      const projects: string[] = []
      for (const folder of folders.filter(entry => entry.isDirectory() && SAFE_SEGMENT.test(entry.name))) {
        const text = await readOptional(join(root, folder.name, 'project.json'))
        if (text !== null) {
          projects.push(text)
        }
      }
      return projects
    })
  }

  readProject(projectId: string): Promise<string | null> {
    return this.inTurn(async () => readOptional(join(await this.projectFolder(projectId), 'project.json')))
  }

  /** The project document, refused unless it is the project of its folder. */
  writeProject(projectId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const folder = await this.projectFolder(projectId)
      checkDocument(text, projectId)
      await mkdir(folder, { recursive: true })
      await writeAtomically(join(folder, 'project.json'), text)
    })
  }

  readChapters(projectId: string): Promise<string[]> {
    return this.inTurn(async () => {
      const folder = join(await this.projectFolder(projectId), 'chapters')
      const files = (await readdir(folder).catch(() => [])).filter(fileName => fileName.endsWith('.json') && SAFE_SEGMENT.test(fileName.slice(0, -5)))
      return Promise.all(files.map(fileName => readFile(join(folder, fileName), 'utf8')))
    })
  }

  writeChapter(projectId: string, chapterId: string, text: string): Promise<void> {
    return this.inTurn(async () => {
      const folder = join(await this.projectFolder(projectId), 'chapters')
      checkDocument(text, checkedSegment(chapterId, 'chapter'))
      await mkdir(folder, { recursive: true })
      await writeAtomically(join(folder, `${chapterId}.json`), text)
    })
  }

  deleteChapter(projectId: string, chapterId: string): Promise<void> {
    return this.inTurn(async () => {
      await unlink(join(await this.projectFolder(projectId), 'chapters', `${checkedSegment(chapterId, 'chapter')}.json`)).catch(ignoreMissing)
    })
  }

  writeAsset(projectId: string, assetId: string, bytes: Uint8Array): Promise<void> {
    return this.inTurn(async () => {
      if (!(bytes instanceof Uint8Array)) {
        throw new Error('Expected the bytes of a file')
      }
      const folder = join(await this.projectFolder(projectId), 'assets')
      await mkdir(folder, { recursive: true })
      await writeAtomically(join(folder, checkedSegment(assetId, 'asset')), bytes)
    })
  }

  readAsset(projectId: string, assetId: string): Promise<Uint8Array> {
    return this.inTurn(async () => new Uint8Array(await readFile(await this.assetPathNow(projectId, assetId))))
  }

  deleteAsset(projectId: string, assetId: string): Promise<void> {
    return this.inTurn(async () => {
      await unlink(await this.assetPathNow(projectId, assetId)).catch(ignoreMissing)
    })
  }

  /** Moves the whole project folder to the trash; nothing is erased. */
  deleteProject(projectId: string): Promise<void> {
    return this.inTurn(async () => {
      const folder = await this.projectFolder(projectId)
      const exists = await readdir(folder).then(() => true, () => false)
      if (exists) {
        await this.options.trash(folder)
      }
    })
  }

  /** Where an asset is, and its media type as the project lists it, for the page to show or play it. */
  asset(projectId: string, assetId: string): Promise<{ path: string; mediaType: string } | null> {
    return this.inTurn(async () => {
      const project = await readOptional(join(await this.projectFolder(projectId), 'project.json'))
      const assets: unknown = project === null ? [] : (JSON.parse(project) as { assets?: unknown }).assets
      const asset = Array.isArray(assets) ? assets.find(candidate => typeof candidate === 'object' && candidate !== null && candidate.id === assetId) : undefined
      return typeof asset?.mediaType === 'string' ? { path: await this.assetPathNow(projectId, assetId), mediaType: asset.mediaType } : null
    })
  }

  private get settingsPath() {
    return join(this.options.settingsFolder, 'settings.json')
  }

  private async projectsFolder(): Promise<string> {
    const settings = await readOptional(this.settingsPath)
    try {
      const folder: unknown = settings === null ? null : (JSON.parse(settings) as { projectsFolder?: unknown }).projectsFolder
      if (typeof folder === 'string' && isAbsolute(folder)) {
        return folder
      }
    } catch {
      // An unreadable setting leaves the default folder.
    }
    return join(this.options.documentsFolder, 'Cyberdeck')
  }

  private async projectFolder(projectId: string): Promise<string> {
    return join(await this.projectsFolder(), checkedSegment(projectId, 'project'))
  }

  private async assetPathNow(projectId: string, assetId: string): Promise<string> {
    return join(await this.projectFolder(projectId), 'assets', checkedSegment(assetId, 'asset'))
  }

  private inTurn<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => undefined)
    return result
  }
}

/** A JSON object whose `id` is the one its file is named after. */
function checkDocument(text: string, id: string) {
  if (!isJsonObject(text, MAXIMUM_DOCUMENT_LENGTH) || (JSON.parse(text) as { id?: unknown }).id !== id) {
    throw new Error(`Expected the document of ${id}`)
  }
}

function checkedSegment(identifier: string, kind: string): string {
  if (typeof identifier !== 'string' || !SAFE_SEGMENT.test(identifier)) {
    throw new Error(`Invalid ${kind} identifier ${JSON.stringify(identifier)}`)
  }
  return identifier
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isFileError(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}

function ignoreMissing(error: unknown) {
  if (!isFileError(error, 'ENOENT')) {
    throw error
  }
}

