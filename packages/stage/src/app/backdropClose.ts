import type { Ref } from 'vue'

/** Whether a pointer is outside the dialog's box: on its backdrop, not on its padding or between its parts. */
function isOutside(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  const box = dialog.getBoundingClientRect()
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
}

/**
 * A modal `<dialog>` closing on a click on its backdrop, as Escape closes it: only when the press
 * both started and ended outside its box, so that selecting text, or dragging out of a field, never
 * closes it. Bind `onPointerDown` and `onClick` on the dialog.
 */
export function useBackdropClose(dialog: Readonly<Ref<HTMLDialogElement | null>>) {
  let pressedOutside = false
  return {
    onPointerDown(event: PointerEvent) {
      pressedOutside = dialog.value !== null && event.target === dialog.value && isOutside(dialog.value, event)
    },
    onClick(event: MouseEvent) {
      const wasOutside = pressedOutside
      pressedOutside = false
      if (wasOutside && dialog.value !== null && event.target === dialog.value && isOutside(dialog.value, event)) {
        dialog.value.close()
      }
    },
  }
}
