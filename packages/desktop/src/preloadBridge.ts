import { contextBridge, ipcRenderer } from 'electron'

/**
 * Runs in the sandboxed page before it loads: hands it the channels named, through one `invoke`
 * function, and nothing else of Electron. The list is the application's: any other channel is refused.
 */
export function exposeChannels(bridgeName: string, channels: Readonly<Record<string, true>>) {
  contextBridge.exposeInMainWorld(bridgeName, {
    invoke: (channel: string, ...parameters: unknown[]) => Object.hasOwn(channels, channel)
      ? ipcRenderer.invoke(channel, ...parameters)
      : Promise.reject(new Error(`No desktop channel ${channel}`)),
  })
}
