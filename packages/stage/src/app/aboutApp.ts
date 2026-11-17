/// <reference path="../appVersion.d.ts" />
import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { Locale } from '../i18n/locale'
import { provideAppLook } from '../look/appLookState'
import { howThisPageRuns, isHosted, type HowItRuns } from './howItRuns'
import { keepOffline, SERVICE_WORKER } from './offline'

export { GUIDE_ADDRESS, LICENSE_ADDRESS, REPOSITORY_ADDRESS } from './projectAddresses'

export interface AppOptions {
  /** `Cyberdeck` or `Datajack`. */
  name: string
  hasDesktopBridge: boolean
  /** What keeps the work safe should the browser erase it, in each language: exporting it. */
  keepSafe: Readonly<Record<Locale, string>>
  /** Where its look is kept, the first holding one read (Datajack: the profile's, then the device's); `<name>:look` without. */
  lookKeys?: () => readonly string[]
}

/** What the first screen says of the application: its version, how it runs, and a new version once online. */
export interface AboutApp {
  name: string
  version: string
  howItRuns: HowItRuns
  keepSafe: Readonly<Record<Locale, string>>
  /** Reloads into the new version waiting; null while there is none. */
  newVersion: Readonly<Ref<(() => void) | null>>
  /** *Later* was said to the new version: it is offered again on the next visit. */
  isNewVersionPutOff: Ref<boolean>
}

const ABOUT_APP: InjectionKey<AboutApp> = Symbol('about-app')

/**
 * Given once at the application's root: its version (`__APP_VERSION__`) and how the page runs, for
 * its first screen and the setting of its look; its own look, kept under `<name>:look` or `lookKeys`; and on a
 * web host, the service worker that keeps the application offline and tells of new versions (never
 * on the development server, whose files change as they are edited).
 */
export function provideApp(options: AppOptions): AboutApp {
  const how = howThisPageRuns(options.hasDesktopBridge)
  const newVersion = ref<(() => void) | null>(null)
  if (!import.meta.env.DEV && isHosted(how) && 'serviceWorker' in navigator) {
    keepOffline(
      navigator.serviceWorker,
      `./${SERVICE_WORKER}`,
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
  const about: AboutApp = { name: options.name, version: __APP_VERSION__, howItRuns: how, keepSafe: options.keepSafe, newVersion, isNewVersionPutOff: ref(false) }
  provide(ABOUT_APP, about)
  provideAppLook(() => window.localStorage, options.lookKeys ?? `${options.name.toLowerCase()}:look`)
  return about
}

export function useAboutApp(): AboutApp | null {
  return inject(ABOUT_APP, null)
}
