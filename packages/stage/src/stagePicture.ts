import { effectiveFacing, type StageCatalog, type StageState } from '@cyberdeck/core'
import { STAGE_HEIGHT, STAGE_WIDTH } from './textboxLayout'

/** A sixth of the stage, the shape of the game's cover: enough to recognise a moment in a list of saves. */
const PICTURE_WIDTH = 320
const PICTURE_HEIGHT = 180
/** The sprites' own limits on stage, and how much nearer or farther draws them. */
const SPRITE_MAXIMUM = { width: 800, height: 960 }
const DEPTH_SCALES = { near: 1.25, middle: 1, far: 0.75 } as const
const DEPTH_ORDER = { far: 0, middle: 1, near: 2 } as const

const images = new Map<string, Promise<HTMLImageElement | null>>()

/** An image of the game, loaded once for every picture; null when it cannot be drawn. */
function imageAt(url: string): Promise<HTMLImageElement | null> {
  let loading = images.get(url)
  if (loading === undefined) {
    loading = new Promise(resolve => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = url
    })
    images.set(url, loading)
  }
  return loading
}

/** Draws the image over the whole area, cut to its shape, as `background-size: cover` does. */
function drawCovering(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const scale = Math.max(STAGE_WIDTH / image.naturalWidth, STAGE_HEIGHT / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.drawImage(image, (STAGE_WIDTH - width) / 2, (STAGE_HEIGHT - height) / 2, width, height)
}

/**
 * The stage as it stands, as a small JPEG picture for a save: its background, its characters where
 * they stand, an illustration over them, a screen faded out. Names without a file are left out. Null
 * where the browser cannot draw.
 */
export async function stagePicture(stage: StageState, catalog: StageCatalog): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = PICTURE_WIDTH
  canvas.height = PICTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (context === null) {
    return null
  }
  context.scale(PICTURE_WIDTH / STAGE_WIDTH, PICTURE_HEIGHT / STAGE_HEIGHT)
  context.fillStyle = '#0b0d12'
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  const backgroundUrl = stage.backgroundId === null ? null : catalog.backgroundUrl(stage.backgroundId)
  const background = backgroundUrl === null ? null : await imageAt(backgroundUrl)
  if (background !== null) {
    drawCovering(context, background)
  }
  for (const onStage of [...stage.characters].sort((first, second) => DEPTH_ORDER[first.depth] - DEPTH_ORDER[second.depth])) {
    const url = catalog.expressionUrl(onStage.characterId, onStage.expressionId)
    const sprite = url === null ? null : await imageAt(url)
    if (sprite === null) {
      continue
    }
    const fit = Math.min(1, SPRITE_MAXIMUM.width / sprite.naturalWidth, SPRITE_MAXIMUM.height / sprite.naturalHeight) * DEPTH_SCALES[onStage.depth]
    const width = sprite.naturalWidth * fit
    const height = sprite.naturalHeight * fit
    const centre = onStage.x / 100 * STAGE_WIDTH
    const facing = effectiveFacing(onStage)
    const drawnFacing = catalog.drawnFacing(onStage.characterId)
    context.save()
    if (drawnFacing !== null && facing !== null && facing !== drawnFacing) {
      context.translate(centre * 2, 0)
      context.scale(-1, 1)
    }
    context.drawImage(sprite, centre - width / 2, STAGE_HEIGHT - height, width, height)
    context.restore()
  }
  const illustrationUrl = stage.illustrationId === null ? null : catalog.illustrationUrl(stage.illustrationId)
  const illustration = illustrationUrl === null ? null : await imageAt(illustrationUrl)
  if (illustration !== null) {
    drawCovering(context, illustration)
  }
  if (stage.cover !== null) {
    context.fillStyle = stage.cover === 'white' ? '#fff' : '#000'
    context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  }
  try {
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch {
    // A picture from another origin taints the canvas: the save goes without one.
    return null
  }
}
