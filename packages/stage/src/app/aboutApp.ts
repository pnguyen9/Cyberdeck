import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { Locale } from '../i18n/locale'
import { howThisPageRuns, keepsOffline, type HowItRuns } from './howItRuns'
import { keepOffline } from './offline'

/** Where the project lives, and its guide, online: the About panel links to them. */
export const REPOSITORY_ADDRESS = 'https://github.com/pnguyen9/Cyberdeck'
export const LICENSE_ADDRESS = `${REPOSITORY_ADDRESS}/blob/main/LICENSE`
export const GUIDE_ADDRESS = 'https://pnguyen9.github.io/Cyberdeck/guide/'

export interface AboutAppOptions {
  /** `Cyberdeck` or `Datajack`. */
  name: string
  version: string
  hasDesktopBridge: boolean
  /** What keeps the work safe should the browser erase it, in each language: exporting it. */
  keepSafe: Readonly<Record<Locale, string>>
  /** The service worker's address in a built page; null on the development server, which has none. */
  serviceWorker: string | null
}

/** What the first screen says of the application: its version, how it runs, and a new version once online. */
export interface AboutApp {
  name: string
  version: string
  howItRuns: HowItRuns
  keepSafe: Readonly<Record<Locale, string>>
  /** Reloads into the new version waiting; null while there is none. */
  newVersion: Readonly<Ref<(() => void) | null>>
}

const ABOUT_APP: InjectionKey<AboutApp> = Symbol('about-app')

/**
 * Given once at the application's root: says how the page runs, and on a web host registers the
 * service worker that keeps the application offline and tells of new versions.
 */
export function provideAboutApp(options: AboutAppOptions): AboutApp {
  const how = howThisPageRuns(options.hasDesktopBridge)
  const newVersion = ref<(() => void) | null>(null)
  if (options.serviceWorker !== null && keepsOffline(how, true) && 'serviceWorker' in navigator) {
    keepOffline(
      navigator.serviceWorker,
      options.serviceWorker,
      takeOver => {
        newVersion.value = takeOver
      },
      () => window.location.reload(),
      check => document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          check()
        }
      }),
    ).catch(() => {
      // A browser refusing service workers (private windows, some settings) still runs the page, online.
    })
  }
  const about: AboutApp = { name: options.name, version: options.version, howItRuns: how, keepSafe: options.keepSafe, newVersion }
  provide(ABOUT_APP, about)
  return about
}

export function useAboutApp(): AboutApp | null {
  return inject(ABOUT_APP, null)
}
