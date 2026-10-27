import type { ProjectStore } from '../../src/projects/projectStore'

/** Projects in memory; documents go through JSON as they would to a disk. */
export function memoryProjectStore() {
  const projects = new Map<string, string>()
  const chapters = new Map<string, string>()
  const assets = new Map<string, Uint8Array<ArrayBuffer>>()
  const store: ProjectStore = {
    listProjects: async () => [...projects.values()].map(text => JSON.parse(text) as unknown),
    readProject: async projectId => {
      const text = projects.get(projectId)
      return text === undefined ? null : JSON.parse(text) as unknown
    },
    readChapters: async projectId => [...chapters].filter(([key]) => key.startsWith(`${projectId}/`)).map(([, text]) => JSON.parse(text) as unknown),
    writeProject: async project => {
      projects.set(project.id, JSON.stringify(project))
    },
    writeChapter: async (projectId, chapter) => {
      chapters.set(`${projectId}/${chapter.id}`, JSON.stringify(chapter))
    },
    deleteChapter: async (projectId, chapterId) => {
      chapters.delete(`${projectId}/${chapterId}`)
    },
    writeAsset: async (projectId, assetId, bytes) => {
      assets.set(`${projectId}/${assetId}`, bytes)
    },
    readAsset: async (projectId, assetId) => {
      const bytes = assets.get(`${projectId}/${assetId}`)
      if (bytes === undefined) {
        throw new Error(`The file ${assetId} is missing`)
      }
      return bytes
    },
    assetUrl: async (projectId, assetId) => `memory:${projectId}/${assetId}`,
    deleteAsset: async (projectId, assetId) => {
      assets.delete(`${projectId}/${assetId}`)
    },
    deleteProject: async projectId => {
      projects.delete(projectId)
      for (const map of [chapters, assets]) {
        for (const key of [...map.keys()].filter(key => key.startsWith(`${projectId}/`))) {
          map.delete(key)
        }
      }
    },
  }
  return { store, chapters, assets }
}
