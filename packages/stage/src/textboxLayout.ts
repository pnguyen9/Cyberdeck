import type { PageLayout } from '@cyberdeck/core'

/**
 * The stage is laid out at this size, then scaled to the window: pages are cut for this
 * textbox once, at import, and display the same on every screen.
 */
export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

export const TEXTBOX_TEXT_WIDTH = 1520
export const TEXTBOX_FONT_SIZE = 44
export const TEXTBOX_LINE_HEIGHT = 1.5
export const TEXTBOX_FONT_FAMILY = 'Georgia, "Times New Roman", serif'
export const TEXTBOX_MAX_LINES = 2

/** Measures with the textbox font, so pagination agrees with what the textbox will show. */
export function createTextboxLayout(): PageLayout {
  const context = document.createElement('canvas').getContext('2d')
  if (context === null) {
    throw new Error('This browser cannot measure text')
  }
  context.font = `${TEXTBOX_FONT_SIZE}px ${TEXTBOX_FONT_FAMILY}`

  return {
    // A small margin absorbs rounding differences between canvas measurement and text layout.
    lineWidth: TEXTBOX_TEXT_WIDTH - TEXTBOX_FONT_SIZE / 2,
    maxLines: TEXTBOX_MAX_LINES,
    measureText: text => context.measureText(text).width,
  }
}
