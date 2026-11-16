import { onUnmounted, ref, type Ref } from 'vue'

/**
 * A screen without a mouse, a finger its pointer. `(hover: none)` alone would also hold where there
 * is no pointer at all (a headless browser, a television), which is no phone to turn sideways.
 */
export const TOUCH_SCREEN_QUERY = '(hover: none) and (pointer: coarse)'

/** Whether a media query holds, followed while the component lives; false where there is no window. */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const list = typeof window === 'undefined' ? undefined : window.matchMedia?.(query)
  const matches = ref(list?.matches === true)
  const follow = (event: MediaQueryListEvent) => {
    matches.value = event.matches
  }
  list?.addEventListener('change', follow)
  onUnmounted(() => list?.removeEventListener('change', follow))
  return matches
}
