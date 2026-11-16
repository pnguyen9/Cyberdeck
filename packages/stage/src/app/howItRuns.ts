/**
 * How an application runs: its desktop build, its double-click build (files opened in a browser), or
 * its web build, either as a web page or installed from the browser (a progressive web app).
 */
export type HowItRuns = 'desktop' | 'files' | 'web' | 'installed'

export interface WhereItRuns {
  /** The desktop shell handed the page its bridge (`window.cyberdeckDesktop`, `window.datajackDesktop`). */
  hasDesktopBridge: boolean
  /** The page's `location.protocol`. */
  protocol: string
  /** The page fills a window of its own, as installed applications do. */
  isStandalone: boolean
}

export function howItRuns({ hasDesktopBridge, protocol, isStandalone }: WhereItRuns): HowItRuns {
  if (hasDesktopBridge) {
    return 'desktop'
  }
  if (protocol === 'file:') {
    return 'files'
  }
  return isStandalone ? 'installed' : 'web'
}

/** Served by a web host, where the browser alone keeps what the application stores, and may erase it. */
export function isHosted(how: HowItRuns): boolean {
  return how === 'web' || how === 'installed'
}

/** How this page runs, from the browser. */
export function howThisPageRuns(hasDesktopBridge: boolean): HowItRuns {
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true
    // Safari on iPhones and iPads says so its own way.
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return howItRuns({ hasDesktopBridge, protocol: window.location.protocol, isStandalone })
}
