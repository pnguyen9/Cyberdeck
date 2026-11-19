/**
 * Where a full-body sprite's feet are: the lowest row of its picture that is drawn, as a share of its
 * height. A sprite with empty space under its feet grows or shrinks with depth around them, not
 * around the bottom of its file, so that a character nearer or farther keeps standing on the same
 * line. Worked out once per picture, from a small copy of it; until then, or when the picture cannot
 * be read, the feet are the bottom edge.
 */

/** A pixel this opaque or more is drawn; fainter ones, a soft shadow's edge, are not. */
const DRAWN_ALPHA = 32
/** A row is drawn when this share of its pixels is, and at least this many: a few stray pixels are not feet. */
const DRAWN_SHARE_OF_ROW = 0.01
const DRAWN_PIXELS_AT_LEAST = 3
/** The copy read is at most this tall: a fraction of a percent, enough on a stage 1080 pixels high. */
const READ_HEIGHT = 540

/**
 * The feet of a picture given as RGBA pixels, row after row: the bottom of its lowest drawn row, as a
 * share of the height, 1 when that row is the last; 1 too for a picture with nothing drawn.
 */
export function feetOfPixels(pixels: ArrayLike<number>, width: number, height: number): number {
  const drawnInRow = Math.max(DRAWN_PIXELS_AT_LEAST, Math.ceil(width * DRAWN_SHARE_OF_ROW))
  for (let row = height - 1; row >= 0; row--) {
    let drawn = 0
    for (let column = 0, alpha = (row * width) * 4 + 3; column < width; column++, alpha += 4) {
      if ((pixels[alpha] ?? 0) >= DRAWN_ALPHA && ++drawn >= drawnInRow) {
        return (row + 1) / height
      }
    }
  }
  return 1
}

/** The point a sprite grows and shrinks around, in its own box: its middle, at its feet. */
export function feetOrigin(feet: number): string {
  return `50% ${Number((feet * 100).toFixed(2))}%`
}

const feetByUrl = new Map<string, number>()
const measuring = new Map<string, Promise<number>>()

/** The feet of a picture already worked out; undefined until then. */
export function knownFeet(url: string): number | undefined {
  return feetByUrl.get(url)
}

/** The feet of a picture, worked out the first time only; the bottom edge when it cannot be read. */
export function spriteFeet(url: string): Promise<number> {
  const known = feetByUrl.get(url)
  if (known !== undefined) {
    return Promise.resolve(known)
  }
  let pending = measuring.get(url)
  if (pending === undefined) {
    pending = measure(url).catch(() => 1).then(feet => {
      feetByUrl.set(url, feet)
      measuring.delete(url)
      return feet
    })
    measuring.set(url, pending)
  }
  return pending
}

async function measure(url: string): Promise<number> {
  if (typeof document === 'undefined') {
    return 1
  }
  const image = new Image()
  image.src = url
  await image.decode()
  const scale = Math.min(1, READ_HEIGHT / image.naturalHeight)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) {
    return 1
  }
  context.drawImage(image, 0, 0, width, height)
  // A picture from another origin taints the canvas, and reading it throws: the bottom edge then.
  return feetOfPixels(context.getImageData(0, 0, width, height).data, width, height)
}
