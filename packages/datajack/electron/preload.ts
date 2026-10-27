import { exposeChannels } from '@cyberdeck/desktop/preload'
import type { DesktopChannel } from './bridge.js'

const CHANNELS: Record<DesktopChannel, true> = {
  'profiles:list': true,
  'profiles:defaultSaveFolder': true,
  'profiles:chooseFolder': true,
  'profiles:create': true,
  'profiles:rename': true,
  'profiles:remove': true,
  'profiles:use': true,
  'profiles:changeSaveFolder': true,
  'saves:read': true,
  'saves:write': true,
  'library:listManifests': true,
  'library:readManifest': true,
  'library:writeManifest': true,
  'library:readChapter': true,
  'library:writeChapter': true,
  'library:hasAsset': true,
  'library:writeAsset': true,
  'library:removeGame': true,
  'library:removeAssetsExcept': true,
}

exposeChannels('datajackDesktop', CHANNELS)
