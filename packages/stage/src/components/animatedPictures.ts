/**
 * Animated pictures decoded frame by frame, for the stage to play them itself. Each file is decoded
 * once, the first time it is shown, and its frames kept for every later showing.
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

const decodedByUrl = new Map<string, Promise<DecodedAnimation | null>>()

/** The picture's frames if it moves; null for a still picture, or a browser that cannot decode them. */
export function decodedAnimation(url: string): Promise<DecodedAnimation | null> {
  const known = decodedByUrl.get(url)
  if (known !== undefined) {
    return known
  }
  const decoding = decode(url).catch(() => null)
  decodedByUrl.set(url, decoding)
  return decoding
}

/** The kind of picture its first bytes say it is, whatever the file is called: only these may move. */
function movingPictureType(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (text(0, 4) === 'GIF8') {
    return 'image/gif'
  }
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (bytes[0] === 0x89 && text(1, 4) === 'PNG') {
    return 'image/png'
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
