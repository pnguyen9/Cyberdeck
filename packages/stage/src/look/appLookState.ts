import { inject, provide, ref, watch, type InjectionKey, type Ref } from 'vue'
import './appLook.css'
import { applyAppLook, createAppLookStore, DEFAULT_APP_LOOK, type AppLook } from './appLook'

const APP_LOOK: InjectionKey<Ref<AppLook>> = Symbol('app look')

/**
 * The application's look, read from storage under `key`, given to the page's root at once and
 * again with each change, kept, and offered to every screen below. Called once, at the root.
 */
export function provideAppLook(storage: () => Storage, key: string, root: Pick<HTMLElement, 'style' | 'dataset'> = document.documentElement): Ref<AppLook> {
  const store = createAppLookStore(storage, key)
  const look = ref<AppLook>(store.read())
  applyAppLook(look.value, root)
  watch(look, value => {
    applyAppLook(value, root)
    store.write(value)
  }, { deep: true })
  provide(APP_LOOK, look)
  return look
}

/** The application's look, as its root provided it; the default, kept nowhere, without one. */
export function useAppLook(): Ref<AppLook> {
  return inject(APP_LOOK, () => ref<AppLook>(DEFAULT_APP_LOOK), true)
}
