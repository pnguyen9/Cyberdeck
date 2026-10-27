import { describe, expect, it } from 'vitest'
import {
  applyImport,
  assignAsset,
  createProject,
  createProjectBackup,
  matchAssetFile,
  previewImport,
  readProjectBackup,
  readZip,
  writeZip,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = new Date('2026-10-26T12:00:00Z')

function buildProject() {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW.toISOString() }
  const empty = createProject({ name: 'The Letter', locale: 'en' }, environment)
  const preview = previewImport('# One\n[bg: street]\nHello.\n# Two\nGoodbye.', empty, monospaceLayout)
  const applied = applyImport(preview, empty, [], { type: 'newChapters' }, { fileName: 'letter.docx' }, environment)
  const project = assignAsset(applied.project, matchAssetFile('street.png', 'image/png', applied.project)!, { id: 'asset-street', fileName: 'street.png', mediaType: 'image/png', byteSize: 3 })
  return { project, chapters: applied.chapters }
}

const readAsset = async () => new Uint8Array([1, 2, 3])

describe('project backups', () => {
  it('hold the project folder: project, chapters with their import history, and files under their identifier', async () => {
    const { project, chapters } = buildProject()
    const bytes = await createProjectBackup(project, chapters, readAsset, NOW)

    expect(readZip(bytes).map(entry => entry.path)).toEqual([
      `${project.id}/project.json`,
      `${project.id}/chapters/${chapters[0]!.id}.json`,
      `${project.id}/chapters/${chapters[1]!.id}.json`,
      `${project.id}/assets/asset-street`,
    ])
    const backup = await readProjectBackup(bytes)
    expect(backup.project).toEqual(project)
    expect(backup.chapters).toEqual(chapters)
    expect(backup.chapters[0]?.importedFrom?.fileName).toBe('letter.docx')
    expect(backup.assetFiles.get('asset-street')).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('refuse what is not a backup, and damaged files', async () => {
    const { project, chapters } = buildProject()
    await expect(readProjectBackup(await writeZip([{ path: 'game.json', bytes: new Uint8Array(), compress: false }], NOW)))
      .rejects.toThrow('not a Cyberdeck backup')

    const backup = await createProjectBackup(project, chapters, readAsset, NOW)
    const files = new Map(await Promise.all(readZip(backup).map(async entry => [entry.path, await entry.read()] as const)))
    files.set(`${project.id}/assets/asset-street`, new Uint8Array([1]))
    const damaged = await writeZip([...files].map(([path, content]) => ({ path, bytes: content, compress: false })), NOW)
    await expect(readProjectBackup(damaged)).rejects.toThrow('street.png is damaged in the backup')
  })
})
