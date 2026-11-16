/**
 * What Datajack asks of a phone or a tablet as a game plays: the stage is wide, so the device is
 * best turned sideways, and the game best played in full screen. Computers are never asked.
 */
export type LandscapeAsk = 'none' | 'offerFullscreen' | 'turn'

export interface ScreenState {
  /** A screen without a mouse, a finger its pointer. */
  isTouchScreen: boolean
  isPortrait: boolean
  isFullscreen: boolean
  /** Whether the browser lets a page fill the screen: an iPhone's Safari does not. */
  canFullscreen: boolean
  /** Whether the player said *Not now*, for this game. */
  isDismissed: boolean
}

export function landscapeAsk(state: ScreenState): LandscapeAsk {
  if (!state.isTouchScreen || state.isDismissed) {
    return 'none'
  }
  if (state.isPortrait) {
    return 'turn'
  }
  return state.canFullscreen && !state.isFullscreen ? 'offerFullscreen' : 'none'
}

/** The media query of a screen without a mouse. */
export const TOUCH_SCREEN_QUERY = '(hover: none) and (pointer: coarse)'
