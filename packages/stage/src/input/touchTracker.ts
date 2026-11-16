import { classifyTouch, LONG_PRESS_MILLISECONDS, staysInPlace, type TouchGesture } from './touchGestures'

/**
 * Whether the click to come follows a long press or a swipe, rather than a tap: shared by every
 * tracker, since what a long press does may draw the element under the finger anew (a tile marked),
 * whose click then comes to another component than the one that saw the press.
 */
let isClickSwallowed = false

/**
 * Follows one finger through pointer events, those of touch alone: the mouse and the pen keep their
 * clicks as they are. A tap is left to the browser's own click; a long press is told as the finger
 * rests, since iPhones and iPads send no menu event for it; a swipe as the finger is lifted. The
 * click a browser may send after either is swallowed, so that a long press or a swipe never also
 * taps.
 *
 * `accepts`: whether a touch starting there is a gesture (not on a button, say). `onLongPress`
 * and `onSwipe` get the element first touched.
 */
export function createTouchTracker(handlers: {
  accepts: (event: PointerEvent) => boolean
  onLongPress: (target: EventTarget | null) => void
  onSwipe?: (gesture: Extract<TouchGesture, 'swipeLeft' | 'swipeRight'>) => void
}) {
  let touch: { pointerId: number; x: number; y: number; time: number; target: EventTarget | null } | null = null
  let longPressTimer: ReturnType<typeof setTimeout> | undefined
  let fingersDown = 0
  let lastLiftTime = Number.NEGATIVE_INFINITY

  const forget = () => {
    clearTimeout(longPressTimer)
    longPressTimer = undefined
    touch = null
  }

  return {
    onPointerDown(event: PointerEvent) {
      // A new press, of any pointer: the click to come belongs to it.
      isClickSwallowed = false
      if (event.pointerType !== 'touch') {
        return
      }
      fingersDown++
      // A second finger is a pinch, nothing of the game's.
      if (touch !== null || fingersDown > 1 || !handlers.accepts(event)) {
        forget()
        return
      }
      touch = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, target: event.target }
      longPressTimer = setTimeout(() => {
        const pressed = touch
        forget()
        if (pressed !== null) {
          isClickSwallowed = true
          handlers.onLongPress(pressed.target)
        }
      }, LONG_PRESS_MILLISECONDS)
    },
    onPointerMove(event: PointerEvent) {
      if (touch?.pointerId === event.pointerId && longPressTimer !== undefined && !staysInPlace(event.clientX - touch.x, event.clientY - touch.y)) {
        clearTimeout(longPressTimer)
        longPressTimer = undefined
      }
    },
    onPointerUp(event: PointerEvent) {
      if (event.pointerType !== 'touch') {
        return
      }
      fingersDown = Math.max(0, fingersDown - 1)
      lastLiftTime = event.timeStamp
      const lifted = touch
      if (lifted?.pointerId !== event.pointerId) {
        return
      }
      forget()
      const gesture = classifyTouch({ dx: event.clientX - lifted.x, dy: event.clientY - lifted.y, durationMs: event.timeStamp - lifted.time })
      if (gesture === 'swipeLeft' || gesture === 'swipeRight') {
        isClickSwallowed = true
        handlers.onSwipe?.(gesture)
      }
    },
    onPointerCancel(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        fingersDown = Math.max(0, fingersDown - 1)
        lastLiftTime = event.timeStamp
        if (touch?.pointerId === event.pointerId) {
          forget()
        }
      }
    },
    /** Whether the click now arriving followed a long press or a swipe, and is not a tap. */
    swallowsClick(): boolean {
      const isSwallowed = isClickSwallowed
      isClickSwallowed = false
      return isSwallowed
    },
    /**
     * Whether a menu event comes from a finger: Android sends one on a long press, which the
     * tracker tells itself, on every device alike.
     */
    isFromTouch(event: MouseEvent): boolean {
      return fingersDown > 0 || ('pointerType' in event && event.pointerType === 'touch') || event.timeStamp - lastLiftTime < 300
    },
    dispose: forget,
  }
}
