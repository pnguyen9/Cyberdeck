/**
 * The page's side of the desktop channels, shared by both applications: no Electron in it, only the
 * bridge the preload exposes, typed by the application's list of channels.
 */
/** Each channel's name and how it is called; an interface of the application's channels fits. */
export type ChannelList<Channels> = { [Channel in keyof Channels]: (...parameters: never[]) => unknown }

export interface ChannelBridge<Channels extends ChannelList<Channels>> {
  invoke: <Channel extends keyof Channels & string>(
    channel: Channel,
    ...parameters: Parameters<Channels[Channel]>
  ) => Promise<ReturnType<Channels[Channel]>>
}

/** Electron prefixes errors thrown by the main process with the channel name; people only need the message. */
const REMOTE_ERROR_PREFIX = /^Error invoking remote method '[^']*': (?:Error: )?/

/** Calls the main process, rethrowing its errors with their message alone. */
export function createInvoke<Channels extends ChannelList<Channels>>(bridge: ChannelBridge<Channels>): ChannelBridge<Channels>['invoke'] {
  return async (channel, ...parameters) => {
    try {
      return await bridge.invoke(channel, ...parameters)
    } catch (error) {
      throw new Error(error instanceof Error ? error.message.replace(REMOTE_ERROR_PREFIX, '') : String(error))
    }
  }
}
