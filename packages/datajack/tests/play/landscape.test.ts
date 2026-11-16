import { describe, expect, it } from 'vitest'
import { landscapeAsk, type ScreenState } from '../../src/play/landscape'

const phone: ScreenState = { isTouchScreen: true, isPortrait: true, isFullscreen: false, canFullscreen: true, isDismissed: false }

describe('landscapeAsk', () => {
  it('never asks a computer anything', () => {
    expect(landscapeAsk({ ...phone, isTouchScreen: false })).toBe('none')
    expect(landscapeAsk({ ...phone, isTouchScreen: false, isPortrait: false })).toBe('none')
  })

  it('asks a device held upright to turn', () => {
    expect(landscapeAsk(phone)).toBe('turn')
    expect(landscapeAsk({ ...phone, canFullscreen: false })).toBe('turn')
    expect(landscapeAsk({ ...phone, isFullscreen: true })).toBe('turn')
  })

  it('offers full screen to a device turned sideways, where the browser allows it', () => {
    expect(landscapeAsk({ ...phone, isPortrait: false })).toBe('offerFullscreen')
    expect(landscapeAsk({ ...phone, isPortrait: false, canFullscreen: false })).toBe('none')
    expect(landscapeAsk({ ...phone, isPortrait: false, isFullscreen: true })).toBe('none')
  })

  it('asks nothing more once the player said not now', () => {
    expect(landscapeAsk({ ...phone, isDismissed: true })).toBe('none')
    expect(landscapeAsk({ ...phone, isPortrait: false, isDismissed: true })).toBe('none')
  })
})
