import { inject, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import './appLook.css'
import { applyAppLook, createAppLookStore, DEFAULT_APP_LOOK, presetOf, type AppLook } from './appLook'

/** The look chosen, and the last look made one's own (null before any), which a sixth choice brings back. */
export interface AppLookState {
  look: Ref<AppLook>
  custom: Readonly<Ref<AppLook | null>>
}

const APP_LOOK: InjectionKey<AppLookState> = Symbol('app look')

/** How long the look rests before it is written down: a colour dragged in the picker changes it at every step. */
const WRITE_DELAY_MILLISECONDS = 400

/**
 * The application's look, read from storage under `key`, given to the page's root at once and
 * again with each change (a new object each time: it is never changed in place), kept, and offered
 * to every screen below. Called once, at the root.
 */
export function provideAppLook(storage: () => Storage, key: string, root: HTMLElement = document.documentElement): AppLookState {
  const store = createAppLookStore(storage, key)
  const kept = store.read()
  const look = ref<AppLook>(kept.look)
  const custom = shallowRef<AppLook | null>(kept.custom ?? (presetOf(kept.look) === null ? kept.look : null))
  applyAppLook(look.value, root)
  let writeTimer: ReturnType<typeof setTimeout> | undefined
  const write = () => {
    clearTimeout(writeTimer)
    writeTimer = undefined
    store.write({ look: look.value, custom: custom.value })
  }
  watch(look, value => {
    if (applyAppLook(value, root) === null) {
      custom.value = value
    }
    clearTimeout(writeTimer)
    writeTimer = setTimeout(write, WRITE_DELAY_MILLISECONDS)
  })
  // Closing the page as a change waits still keeps it.
  window.addEventListener('pagehide', () => {
    if (writeTimer !== undefined) {
      write()
    }
  })
  const state: AppLookState = { look, custom }
  provide(APP_LOOK, state)
  return state
}

/** The application's look, as its root provided it; the default, kept nowhere, without one. */
export function useAppLook(): AppLookState {
  return inject(APP_LOOK, () => ({ look: ref<AppLook>(DEFAULT_APP_LOOK), custom: shallowRef<AppLook | null>(null) }), true)
}
