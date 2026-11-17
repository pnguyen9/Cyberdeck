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
 * The application's look, read from storage under the first of `keys` holding one (the default
 * without any), given to the page's root at once and again with each change (a new object each time:
 * it is never changed in place), kept under every one of `keys`, and offered to every screen below.
 * When `keys` change, as when Datajack switches profile, the look is read again from the new ones
 * and written under all of them.
 * Called once, at the root.
 */
export function provideAppLook(storage: () => Storage, keys: string | (() => readonly string[]), root: HTMLElement = document.documentElement): AppLookState {
  const keysNow = typeof keys === 'string' ? () => [keys] : keys
  const read = (from: readonly string[]) => {
    const key = from.find(candidate => {
      try {
        return storage().getItem(candidate) !== null
      } catch {
        return false
      }
    })
    const kept = createAppLookStore(storage, key ?? from[0] ?? '').read()
    return { look: kept.look, custom: kept.custom ?? (presetOf(kept.look) === null ? kept.look : null) }
  }
  let writtenTo = keysNow()
  const kept = read(writtenTo)
  const look = ref<AppLook>(kept.look)
  const custom = shallowRef<AppLook | null>(kept.custom)
  applyAppLook(look.value, root)
  let writeTimer: ReturnType<typeof setTimeout> | undefined
  const write = () => {
    clearTimeout(writeTimer)
    writeTimer = undefined
    writtenTo.forEach(key => createAppLookStore(storage, key).write({ look: look.value, custom: custom.value }))
  }
  watch(look, value => {
    if (applyAppLook(value, root) === null) {
      custom.value = value
    }
    clearTimeout(writeTimer)
    writeTimer = setTimeout(write, WRITE_DELAY_MILLISECONDS)
  })
  watch(() => keysNow().join('\n'), () => {
    if (writeTimer !== undefined) {
      write()
    }
    writtenTo = keysNow()
    const next = read(writtenTo)
    custom.value = next.custom
    look.value = next.look
    // Kept under every new key at once: a profile that took the device's keeps it, the device shows the last profile's.
    write()
  }, { flush: 'sync' })
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
