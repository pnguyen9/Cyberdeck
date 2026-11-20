import { nextTick, onBeforeUnmount, onMounted } from 'vue'

/**
 * Keyboard focus for a panel shown over the story: on mount, focus moves into the panel (to
 * whatever `initialTarget` returns once the panel has rendered); on unmount, it goes back to the
 * element that had it before, so closing a panel leaves the player where they were. That element is
 * focused once the screen has settled: one hidden while the panel was open is shown again by then.
 * Only a focus reached by keyboard comes back: after a click on the Log button, Space must go on
 * reading the story, not open the log again.
 */
export function useDialogFocus(initialTarget: () => HTMLElement | null | undefined): void {
  let previousFocus: HTMLElement | null = null

  onMounted(async () => {
    const active = document.activeElement
    previousFocus = active instanceof HTMLElement && active.matches(':focus-visible') ? active : null
    await nextTick()
    initialTarget()?.focus({ preventScroll: true })
  })

  onBeforeUnmount(() => {
    const restored = previousFocus
    void nextTick(() => {
      if (restored?.isConnected === true) {
        restored.focus({ preventScroll: true })
      }
    })
  })
}

/** Keys that move through a panel's content: a line, a screen, or to either end. */
export const SCROLLING_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

/**
 * Keeps the scrolling keys pressed in a panel for the panel: a player who gave one of them to an
 * action (the log, going back) does not also have it done to the story behind.
 */
export function keepScrollingKeys(event: KeyboardEvent): void {
  if (SCROLLING_KEYS.has(event.code)) {
    event.stopPropagation()
  }
}

/** Focuses an element of a list and scrolls the list just enough to show it. */
export function focusAndReveal(element: HTMLElement | undefined): void {
  element?.focus()
  element?.scrollIntoView({ block: 'nearest' })
}

/**
 * Moves the keyboard focus `step` elements along a list (the arrow keys through a menu's options or
 * a log's lines). With none of them focused, the focus enters the list on `enteringIndex`. `wraps`:
 * past one end, the focus goes on from the other; otherwise it stays at the end.
 */
export function stepFocus(elements: readonly HTMLElement[], step: number, enteringIndex: number, wraps: boolean): void {
  if (elements.length === 0) {
    return
  }
  const focusedIndex = elements.findIndex(element => element === document.activeElement)
  const wantedIndex = focusedIndex === -1 ? enteringIndex : focusedIndex + step
  const index = wraps ? (wantedIndex + elements.length) % elements.length : Math.min(Math.max(wantedIndex, 0), elements.length - 1)
  focusAndReveal(elements[index])
}
