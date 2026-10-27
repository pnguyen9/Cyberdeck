import { createInvoke } from '@cyberdeck/desktop/invoke'
import type { DesktopBridge } from '../../electron/bridge'

declare global {
  interface Window {
    /** Present when the page runs in the desktop player. */
    datajackDesktop?: DesktopBridge
  }
}

/** Calls the main process, rethrowing its errors with their message alone. */
export const createDesktopInvoke = (bridge: DesktopBridge) => createInvoke(bridge)
