import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ProjectFolders } from '../../electron/projectFolders.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cyberdeck-folders-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Projects in a temporary Documents folder; the trash is a folder beside it. */
function createFolders() {
  return new ProjectFolders({
    settingsFolder: join(root, 'settings'),
    documentsFolder: join(root, 'Documents'),
    trash: async path => {
      await mkdir(join(root, 'Trash'), { recursive: true })
      await rename(path, join(root, 'Trash', basename(path)))
    },
  })
}

const project = (id: string, extra: object = {}) => JSON.stringify({ id, name: 'Game', ...extra })

describe('ProjectFolders', () => {
  it('keeps each project in its own folder of Documents/Cyberdeck', async () => {
    const folders = createFolders()
    await folders.writeProject('project-1', project('project-1'))
    await folders.writeChapter('project-1', 'chapter-1', JSON.stringify({ id: 'chapter-1', nodes: [] }))
    await folders.writeAsset('project-1', 'asset-1', new Uint8Array([1, 2]))

    const folder = join(root, 'Documents', 'Cyberdeck', 'project-1')
    expect(await readdir(folder)).toEqual(['assets', 'chapters', 'project.json'])
    expect(await readFile(join(folder, 'chapters', 'chapter-1.json'), 'utf8')).toBe('{"id":"chapter-1","nodes":[]}')
    expect(await folders.listProjects()).toEqual([project('project-1')])
    expect(await folders.readChapters('project-1')).toEqual(['{"id":"chapter-1","nodes":[]}'])
    expect(await folders.readAsset('project-1', 'asset-1')).toEqual(new Uint8Array([1, 2]))
  })

  it('leaves alone folders that are not projects', async () => {
    const folders = createFolders()
    await mkdir(join(root, 'Documents', 'Cyberdeck', 'notes'), { recursive: true })
    await writeFile(join(root, 'Documents', 'Cyberdeck', 'notes', 'todo.txt'), 'mine')
    expect(await folders.listProjects()).toEqual([])
  })

  it('refuses a document that is not the one its file is named after, and paths out of the folder', async () => {
    const folders = createFolders()
    await expect(folders.writeProject('project-1', project('project-2'))).rejects.toThrow('Expected the document of project-1')
    await expect(folders.writeChapter('project-1', 'chapter-1', 'not json')).rejects.toThrow('Expected the document')
    await expect(folders.writeProject('../escape', project('../escape'))).rejects.toThrow('Invalid project identifier')
    await expect(folders.writeAsset('project-1', '../../escape', new Uint8Array())).rejects.toThrow('Invalid asset identifier')
  })

  it('finds an asset with the media type its project gives it', async () => {
    const folders = createFolders()
    await folders.writeProject('project-1', project('project-1', { assets: [{ id: 'asset-1', mediaType: 'image/png' }] }))
    await folders.writeAsset('project-1', 'asset-1', new Uint8Array([1]))
    expect(await folders.asset('project-1', 'asset-1')).toEqual({ path: join(root, 'Documents', 'Cyberdeck', 'project-1', 'assets', 'asset-1'), mediaType: 'image/png' })
    expect(await folders.asset('project-1', 'asset-2')).toBeNull()
  })

  it('moves deleted projects to the trash, and deletes chapters and assets', async () => {
    const folders = createFolders()
    await folders.writeProject('project-1', project('project-1'))
    await folders.writeChapter('project-1', 'chapter-1', JSON.stringify({ id: 'chapter-1' }))
    await folders.deleteChapter('project-1', 'chapter-1')
    await folders.deleteChapter('project-1', 'chapter-1')
    expect(await folders.readChapters('project-1')).toEqual([])

    await folders.deleteProject('project-1')
    expect(await folders.listProjects()).toEqual([])
    expect(existsSync(join(root, 'Trash', 'project-1', 'project.json'))).toBe(true)
  })

  it('uses the folder the author chose, remembered across starts', async () => {
    const folders = createFolders()
    const chosen = join(root, 'Dropbox', 'Stories')
    await folders.changeFolder(chosen)
    await folders.writeProject('project-1', project('project-1'))

    expect(await createFolders().folder()).toBe(chosen)
    expect(existsSync(join(chosen, 'project-1', 'project.json'))).toBe(true)
  })
})
