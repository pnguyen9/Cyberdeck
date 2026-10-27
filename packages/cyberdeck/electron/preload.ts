import { exposeChannels } from '@cyberdeck/desktop/preload'
import type { DesktopChannel } from './bridge.js'

const CHANNELS: Record<DesktopChannel, true> = {
  'projects:folder': true,
  'projects:chooseFolder': true,
  'projects:list': true,
  'projects:readProject': true,
  'projects:writeProject': true,
  'projects:readChapters': true,
  'projects:writeChapter': true,
  'projects:deleteChapter': true,
  'projects:writeAsset': true,
  'projects:readAsset': true,
  'projects:deleteAsset': true,
  'projects:deleteProject': true,
}

exposeChannels('cyberdeckDesktop', CHANNELS)
