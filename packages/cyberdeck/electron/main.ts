import { startSecureApp, type ChannelContext } from '@cyberdeck/desktop/app'
import { app, shell, type IpcMainInvokeEvent } from 'electron'
import { fileURLToPath } from 'node:url'
import { PROJECT_ASSETS_PATH, type DesktopChannel, type DesktopChannels } from './bridge.js'
import { ProjectFolders } from './projectFolders.js'

type Handlers = {
  [Channel in DesktopChannel]: (
    event: IpcMainInvokeEvent,
    ...parameters: Parameters<DesktopChannels[Channel]>
  ) => Promise<ReturnType<DesktopChannels[Channel]>>
}

startSecureApp({
  name: 'Cyberdeck',
  scheme: 'cyberdeck',
  pageFolder: fileURLToPath(new URL('../dist/', import.meta.url)),
  preloadPath: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
  backgroundColor: '#0b0d12',
  start: context => {
    const projectFolders = new ProjectFolders({
      settingsFolder: app.getPath('userData'),
      documentsFolder: app.getPath('documents'),
      trash: path => shell.trashItem(path),
    })
    return {
      channels: channelsOf(projectFolders, context),
      routes: [{
        prefix: PROJECT_ASSETS_PATH,
        find: async rest => {
          const [projectId = '', assetId = ''] = rest.split('/')
          return projectFolders.asset(projectId, assetId)
        },
      }],
    }
  },
})

/** The editor's channels: project folders, and the folder holding them, only as picked by the author. */
function channelsOf(projectFolders: ProjectFolders, { chooseFolder, pickedFolder }: ChannelContext): Handlers {
  return {
    'projects:folder': async _event => projectFolders.folder(),
    'projects:chooseFolder': async event => {
      const folder = await chooseFolder(event, 'Where to keep the projects')
      if (folder !== null) {
        await projectFolders.changeFolder(pickedFolder(folder))
      }
      return folder
    },
    'projects:list': async _event => projectFolders.listProjects(),
    'projects:readProject': async (_event, projectId) => projectFolders.readProject(projectId),
    'projects:writeProject': async (_event, projectId, text) => projectFolders.writeProject(projectId, text),
    'projects:readChapters': async (_event, projectId) => projectFolders.readChapters(projectId),
    'projects:writeChapter': async (_event, projectId, chapterId, text) => projectFolders.writeChapter(projectId, chapterId, text),
    'projects:deleteChapter': async (_event, projectId, chapterId) => projectFolders.deleteChapter(projectId, chapterId),
    'projects:writeAsset': async (_event, projectId, assetId, bytes) => projectFolders.writeAsset(projectId, assetId, bytes),
    'projects:readAsset': async (_event, projectId, assetId) => projectFolders.readAsset(projectId, assetId),
    'projects:deleteAsset': async (_event, projectId, assetId) => projectFolders.deleteAsset(projectId, assetId),
    'projects:deleteProject': async (_event, projectId) => projectFolders.deleteProject(projectId),
  }
}
