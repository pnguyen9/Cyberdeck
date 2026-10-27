import { createInvoke } from '@cyberdeck/desktop/invoke'
import { PROJECT_ASSETS_PATH, type DesktopBridge } from '../../electron/bridge'
import type { ProjectStore } from './projectStore'

declare global {
  interface Window {
    /** Present when the page runs in the desktop editor. */
    cyberdeckDesktop?: DesktopBridge
  }
}

/** Projects as folders on the disk, reached through the preload bridge. */
export function createDesktopProjectStore(bridge: DesktopBridge): ProjectStore {
  const invoke = createInvoke(bridge)
  const parse = (text: string | null): unknown => {
    if (text === null) {
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return {
    listProjects: async () => (await invoke('projects:list')).map(parse),
    readProject: async projectId => parse(await invoke('projects:readProject', projectId)),
    readChapters: async projectId => (await invoke('projects:readChapters', projectId)).map(parse),
    writeProject: project => invoke('projects:writeProject', project.id, JSON.stringify(project, null, 2)),
    writeChapter: (projectId, chapter) => invoke('projects:writeChapter', projectId, chapter.id, JSON.stringify(chapter, null, 2)),
    deleteChapter: (projectId, chapterId) => invoke('projects:deleteChapter', projectId, chapterId),
    writeAsset: (projectId, assetId, bytes) => invoke('projects:writeAsset', projectId, assetId, bytes),
    readAsset: async (projectId, assetId) => new Uint8Array(await invoke('projects:readAsset', projectId, assetId)),
    assetUrl: async (projectId, assetId) => `${location.origin}${PROJECT_ASSETS_PATH}${projectId}/${assetId}`,
    deleteAsset: (projectId, assetId) => invoke('projects:deleteAsset', projectId, assetId),
    deleteProject: projectId => invoke('projects:deleteProject', projectId),
    folder: {
      current: () => invoke('projects:folder'),
      choose: () => invoke('projects:chooseFolder'),
    },
  }
}
