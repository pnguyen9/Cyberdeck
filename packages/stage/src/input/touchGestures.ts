import type { PlayerAction } from './bindings'

/**
 * What a finger does on a touch screen, beside the mouse and the keyboard: a tap is a left click,
 * a long press a right click, a swipe to the right goes back and one to the left moves on.
 */
export type TouchGesture = 'tap' | 'longPress' | 'swipeLeft' | 'swipeRight' | 'none'

/** How far a finger may wander, in CSS pixels, and still tap or press where it touched. */
export const TAP_SLOP_PIXELS = 10
/** How long a finger rests before a press is long: iOS and Android open their own menus at about this. */
export const LONG_PRESS_MILLISECONDS = 500
/** How far across a swipe goes, at least. */
export const SWIPE_MIN_DISTANCE_PIXELS = 60
/** A swipe is mostly across: its sideways run at least twice its rise or fall. */
export const SWIPE_MAX_SLOPE = 0.5
/** A slower drag is a finger resting and sliding, not a swipe. */
export const SWIPE_MAX_MILLISECONDS = 1000

/** A finger's way from where it touched to where it was lifted. */
export interface TouchTrace {
  dx: number
  dy: number
  durationMs: number
}

/** Whether a finger is still where it touched, as a tap or a long press asks. */
export function staysInPlace(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) <= TAP_SLOP_PIXELS
}

/** What a finger did, once lifted. */
export function classifyTouch({ dx, dy, durationMs }: TouchTrace): TouchGesture {
  if (staysInPlace(dx, dy)) {
    return durationMs >= LONG_PRESS_MILLISECONDS ? 'longPress' : 'tap'
  }
  const isSwipe = Math.abs(dx) >= SWIPE_MIN_DISTANCE_PIXELS
    && Math.abs(dy) <= Math.abs(dx) * SWIPE_MAX_SLOPE
    && durationMs <= SWIPE_MAX_MILLISECONDS
  if (!isSwipe) {
    return 'none'
  }
  return dx > 0 ? 'swipeRight' : 'swipeLeft'
}

/** What a swipe does: to the right turns back a page, as a book does; to the left moves on. */
export function actionForSwipe(gesture: TouchGesture): PlayerAction | null {
  switch (gesture) {
    case 'swipeRight':
      return 'back'
    case 'swipeLeft':
      return 'advance'
    default:
      return null
  }
}
