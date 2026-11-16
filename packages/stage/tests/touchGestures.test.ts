import { describe, expect, it } from 'vitest'
import {
  actionForSwipe,
  classifyTouch,
  LONG_PRESS_MILLISECONDS,
  staysInPlace,
  SWIPE_MAX_MILLISECONDS,
  SWIPE_MIN_DISTANCE_PIXELS,
  TAP_SLOP_PIXELS,
} from '../src/input/touchGestures'

describe('classifyTouch', () => {
  it('takes a short touch in place for a tap', () => {
    expect(classifyTouch({ dx: 0, dy: 0, durationMs: 80 })).toBe('tap')
    expect(classifyTouch({ dx: 6, dy: -6, durationMs: LONG_PRESS_MILLISECONDS - 1 })).toBe('tap')
  })

  it('takes a finger resting in place for a long press', () => {
    expect(classifyTouch({ dx: 0, dy: 0, durationMs: LONG_PRESS_MILLISECONDS })).toBe('longPress')
    expect(classifyTouch({ dx: 3, dy: 4, durationMs: 2000 })).toBe('longPress')
  })

  it('lets a finger wander a little and still tap, as a tile of a game board asks', () => {
    expect(staysInPlace(TAP_SLOP_PIXELS, 0)).toBe(true)
    expect(staysInPlace(TAP_SLOP_PIXELS + 1, 0)).toBe(false)
    expect(classifyTouch({ dx: TAP_SLOP_PIXELS, dy: 0, durationMs: 100 })).toBe('tap')
  })

  it('tells swipes by their direction', () => {
    expect(classifyTouch({ dx: 120, dy: 10, durationMs: 200 })).toBe('swipeRight')
    expect(classifyTouch({ dx: -120, dy: -10, durationMs: 200 })).toBe('swipeLeft')
    expect(classifyTouch({ dx: SWIPE_MIN_DISTANCE_PIXELS, dy: 0, durationMs: SWIPE_MAX_MILLISECONDS })).toBe('swipeRight')
  })

  it('ignores a move too short, too steep or too slow to be a swipe, or a tap', () => {
    expect(classifyTouch({ dx: SWIPE_MIN_DISTANCE_PIXELS - 1, dy: 0, durationMs: 200 })).toBe('none')
    expect(classifyTouch({ dx: 100, dy: 80, durationMs: 200 })).toBe('none')
    expect(classifyTouch({ dx: 0, dy: 200, durationMs: 200 })).toBe('none')
    expect(classifyTouch({ dx: 200, dy: 0, durationMs: SWIPE_MAX_MILLISECONDS + 1 })).toBe('none')
  })
})

describe('actionForSwipe', () => {
  it('goes back to the right, as a book turns back, and moves on to the left', () => {
    expect(actionForSwipe('swipeRight')).toBe('back')
    expect(actionForSwipe('swipeLeft')).toBe('advance')
  })

  it('leaves taps and long presses to the buttons they stand for', () => {
    expect(actionForSwipe('tap')).toBeNull()
    expect(actionForSwipe('longPress')).toBeNull()
    expect(actionForSwipe('none')).toBeNull()
  })
})
