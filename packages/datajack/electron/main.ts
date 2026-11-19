import { startSecureApp, type ChannelContext } from '@cyberdeck/desktop/app'
import type { IpcMainInvokeEvent } from 'electron'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INSTALLED_ASSETS_PATH, type DesktopChannel, type DesktopChannels, type DialogLanguage } from './bridge.js'
import { LibraryFiles, mediaTypeOfAsset } from './libraryFiles.js'
import { ProfileFiles } from './profileFiles.js'

type Handlers = {
  [Channel in DesktopChannel]: (
    event: IpcMainInvokeEvent,
    ...parameters: Parameters<DesktopChannels[Channel]>
  ) => Promise<ReturnType<DesktopChannels[Channel]>>
}

startSecureApp({
  name: 'Datajack',
  scheme: 'datajack',
  pageFolder: fileURLToPath(new URL('../dist/', import.meta.url)),
  preloadPath: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
  backgroundColor: '#000000',
  start: context => {
    const libraryFiles = new LibraryFiles(join(app.getPath('userData'), 'library'))
    const profileFiles = new ProfileFiles({
      settingsFolder: app.getPath('userData'),
      documentsFolder: app.getPath('documents'),
      createId: randomUUID,
      now: () => new Date().toISOString(),
    })
    return {
      channels: channelsOf(profileFiles, libraryFiles, context),
      routes: [{
        prefix: INSTALLED_ASSETS_PATH,
        find: async fileName => {
          const mediaType = mediaTypeOfAsset(fileName)
          return mediaType === null ? null : { path: libraryFiles.assetPath(fileName), mediaType }
        },
      }],
    }
  },
})

const FOLDER_DIALOG_TITLES: Readonly<Record<DialogLanguage, string>> = {
  en: 'Where to keep the saves',
  fr: 'Où conserver les sauvegardes',
}

/** The title of the folder picker in the page's language; English for a language the shell does not know. */
function folderDialogTitle(language: unknown): string {
  return typeof language === 'string' && Object.hasOwn(FOLDER_DIALOG_TITLES, language)
    ? FOLDER_DIALOG_TITLES[language as DialogLanguage]
    : FOLDER_DIALOG_TITLES.en
}

/** The player's channels: profiles and their saves, and the library of installed games; save folders only as picked. */
function channelsOf(profileFiles: ProfileFiles, libraryFiles: LibraryFiles, { chooseFolder, pickedFolder }: ChannelContext): Handlers {
  return {
    'profiles:list': async _event => profileFiles.list(),
    'profiles:defaultSaveFolder': async (_event, name) => profileFiles.defaultSaveFolder(name),
    'profiles:chooseFolder': async (event, language) => chooseFolder(event, folderDialogTitle(language)),
    'profiles:create': async (_event, name, saveFolder) =>
      profileFiles.create(name, saveFolder === null ? null : pickedFolder(saveFolder)),
    'profiles:rename': async (_event, profileId, name) => profileFiles.rename(profileId, name),
    'profiles:remove': async (_event, profileId) => profileFiles.remove(profileId),
    'profiles:use': async (_event, profileId) => profileFiles.use(profileId),
    'profiles:changeSaveFolder': async (_event, profileId, saveFolder) =>
      profileFiles.changeSaveFolder(profileId, pickedFolder(saveFolder)),
    'saves:read': async (_event, profileId, gameId, slot) => profileFiles.readSave(profileId, gameId, slot),
    'saves:write': async (_event, profileId, gameId, slot, text) => profileFiles.writeSave(profileId, gameId, slot, text),
    'saves:eraseAll': async (_event, profileId) => profileFiles.eraseSaves(profileId),
    'saves:erase': async (_event, profileId, gameId, slots) => profileFiles.eraseGameSlots(profileId, gameId, slots),
    'saves:games': async (_event, profileId) => profileFiles.savedGames(profileId),
    'library:listManifests': async (_event, profileId) => libraryFiles.listManifests(profileId),
    'library:listAllManifests': async _event => libraryFiles.listAllManifests(),
    'library:readManifest': async (_event, profileId, gameId) => libraryFiles.readManifest(profileId, gameId),
    'library:writeManifest': async (_event, profileId, gameId, text) => libraryFiles.writeManifest(profileId, gameId, text),
    'library:readChapter': async (_event, profileId, gameId, chapterId) => libraryFiles.readChapter(profileId, gameId, chapterId),
    'library:writeChapter': async (_event, profileId, gameId, chapterId, text) => libraryFiles.writeChapter(profileId, gameId, chapterId, text),
    'library:hasAsset': async (_event, fileName) => libraryFiles.hasAsset(fileName),
    'library:writeAsset': async (_event, fileName, bytes) => libraryFiles.writeAsset(fileName, bytes),
    'library:readAsset': async (_event, fileName) => libraryFiles.readAsset(fileName),
    'library:removeGame': async (_event, profileId, gameId) => libraryFiles.removeGame(profileId, gameId),
    'library:removeLibrary': async (_event, profileId) => libraryFiles.removeLibrary(profileId),
    'library:removeAssetsExcept': async (_event, fileNames) => libraryFiles.removeAssetsExcept(fileNames),
    'library:listEarlierManifests': async _event => libraryFiles.listEarlierManifests(),
    'library:readEarlierChapter': async (_event, gameId, chapterId) => libraryFiles.readEarlierChapter(gameId, chapterId),
    'library:removeEarlierGame': async (_event, gameId) => libraryFiles.removeEarlierGame(gameId),
  }
}
