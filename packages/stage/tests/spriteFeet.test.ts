import { describe, expect, it } from 'vitest'
import { feetOfPixels, feetOrigin } from '../src/components/spriteFeet'

/** A picture as RGBA pixels, transparent but for the rows and columns given, drawn fully opaque. */
function picture(width: number, height: number, drawn: (column: number, row: number) => boolean): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (drawn(column, row)) {
        pixels[(row * width + column) * 4 + 3] = 255
      }
    }
  }
  return pixels
}

describe('a sprite\'s feet', () => {
  it('are the bottom edge of a picture drawn to its last row', () => {
    expect(feetOfPixels(picture(40, 100, (column, row) => row >= 10 && column > 10 && column < 30), 40, 100)).toBe(1)
  })

  it('are the bottom of the lowest drawn row, as a share of the height, with room below them', () => {
    // As the battle sample's creatures: 810 high, feet near 470.
    expect(feetOfPixels(picture(64, 81, (column, row) => row >= 5 && row < 47 && column > 20 && column < 44), 64, 81)).toBeCloseTo(47 / 81)
  })

  it('pass over a few stray pixels and a faint shadow below them', () => {
    const pixels = picture(100, 100, (column, row) => row < 60 && column > 30 && column < 70)
    pixels[(95 * 100 + 50) * 4 + 3] = 255
    pixels[(95 * 100 + 51) * 4 + 3] = 255
    for (let column = 20; column < 80; column++) {
      pixels[(70 * 100 + column) * 4 + 3] = 20
    }
    expect(feetOfPixels(pixels, 100, 100)).toBeCloseTo(0.6)
  })

  it('are the bottom edge of a picture with nothing drawn', () => {
    expect(feetOfPixels(picture(10, 10, () => false), 10, 10)).toBe(1)
  })

  it('are where a sprite grows and shrinks around, in its own box', () => {
    expect(feetOrigin(1)).toBe('50% 100%')
    expect(feetOrigin(470 / 810)).toBe('50% 58.02%')
  })
})
