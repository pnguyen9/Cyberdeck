/**
 * Animated pictures decoded frame by frame, for the stage to play them itself. Each file is decoded
 * once, the first time it is shown or readied ahead of it, and its frames kept while it is shown and
 * for a while after, for an expression shown again soon.
 */

export interface DecodedAnimation {
  frames: readonly { bitmap: ImageBitmap; durationMs: number }[]
  /** Times played again after the first; `Infinity` for one that loops for ever. */
  repetitions: number
  width: number
  height: number
}

/** A frame said to last no time at all, as many GIFs are, lasts what browsers give it. */
const SHORTEST_FRAME_MS = 20
const UNSAID_FRAME_MS = 100

/** Frames no picture shows any more are let go of after this long. */
const KEPT_UNSHOWN_MS = 60_000

const decodedByUrl = new Map<string, { decoding: Promise<DecodedAnimation | null>; shownBy: number; releaseTimer?: ReturnType<typeof setTimeout> }>()

/**
 * The picture's frames if it moves; null for a still picture, or a browser that cannot decode them.
 * Each call is matched by `releaseAnimation` once the picture is no longer shown.
 */
export function decodedAnimation(url: string): Promise<DecodedAnimation | null> {
  const known = decodedByUrl.get(url)
  if (known !== undefined) {
    clearTimeout(known.releaseTimer)
    known.shownBy++
    return known.decoding
  }
  const decoding = decode(url).catch(() => null)
  decodedByUrl.set(url, { decoding, shownBy: 1 })
  return decoding
}

/** A picture no longer shown: its frames are let go of a while after nothing shows them. */
export function releaseAnimation(url: string) {
  const known = decodedByUrl.get(url)
  if (known === undefined || --known.shownBy > 0) {
    return
  }
  known.releaseTimer = setTimeout(() => {
    decodedByUrl.delete(url)
    void known.decoding.then(decoded => decoded?.frames.forEach(frame => frame.bitmap.close()))
  }, KEPT_UNSHOWN_MS)
}

/** Still pictures decoded ahead of their showing, held as long as frames are, so that the browser keeps them ready. */
const stillsReady = new Map<string, { image: HTMLImageElement; releaseTimer: ReturnType<typeof setTimeout> }>()

/** A still picture decoded, so that an image showing it draws it at once; a broken file is let through, to show broken as before. */
export async function decodedStill(url: string): Promise<void> {
  const known = stillsReady.get(url)
  const image = known?.image ?? new Image()
  clearTimeout(known?.releaseTimer)
  if (known === undefined) {
    image.src = url
  }
  stillsReady.set(url, { image, releaseTimer: setTimeout(() => stillsReady.delete(url), KEPT_UNSHOWN_MS) })
  await image.decode().catch(() => undefined)
}

/**
 * A picture readied before it is needed: its frames if it moves, else the picture decoded, so that
 * it is drawn at once when shown, instead of after a moment empty.
 */
export async function preparePicture(url: string): Promise<void> {
  const decoded = await decodedAnimation(url)
  if (decoded === null) {
    await decodedStill(url)
  }
  releaseAnimation(url)
}

/**
 * The kind of picture its bytes say it is, whatever the file is called, when it may move: a GIF, a
 * WebP marked animated, a PNG with an animation chunk before its image data. A still PNG or WebP is
 * told apart from its first chunks, without decoding it.
 */
function movingPictureType(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (text(0, 4) === 'GIF8') {
    return 'image/gif'
  }
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') {
    const ANIMATION_FLAG = 0x02
    return text(12, 16) === 'VP8X' && ((bytes[20] ?? 0) & ANIMATION_FLAG) !== 0 ? 'image/webp' : null
  }
  if (bytes[0] === 0x89 && text(1, 4) === 'PNG') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    // Chunks follow the 8-byte signature: length, type, data, checksum.
    for (let offset = 8; offset + 8 <= bytes.length; offset += 12 + view.getUint32(offset)) {
      const type = text(offset + 4, offset + 8)
      if (type === 'acTL') {
        return 'image/png'
      }
      if (type === 'IDAT') {
        return null
      }
    }
    return null
  }
  return null
}

async function decode(url: string): Promise<DecodedAnimation | null> {
  if (typeof ImageDecoder === 'undefined') {
    return null
  }
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  const type = movingPictureType(bytes)
  if (type === null || !(await ImageDecoder.isTypeSupported(type))) {
    return null
  }
  const decoder = new ImageDecoder({ data: bytes, type })
  try {
    await decoder.tracks.ready
    const track = decoder.tracks.selectedTrack
    if (track === null || !track.animated || track.frameCount < 2) {
      return null
    }
    await decoder.completed
    const frames: { bitmap: ImageBitmap; durationMs: number }[] = []
    for (let frameIndex = 0; frameIndex < track.frameCount; frameIndex++) {
      const { image } = await decoder.decode({ frameIndex })
      const durationMs = image.duration === null ? UNSAID_FRAME_MS : image.duration / 1000
      frames.push({ bitmap: await createImageBitmap(image), durationMs: durationMs < SHORTEST_FRAME_MS ? UNSAID_FRAME_MS : durationMs })
      image.close()
    }
    const first = frames[0]!.bitmap
    return { frames, repetitions: track.repetitionCount, width: first.width, height: first.height }
  } finally {
    decoder.close()
  }
}
