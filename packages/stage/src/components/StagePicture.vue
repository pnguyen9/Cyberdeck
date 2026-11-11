<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { LESS_MOTION, systemAsksLessMotion } from '../settings/lessMotion'
import { decodedAnimation, decodedStill, releaseAnimation, type DecodedAnimation } from './animatedPictures'

/**
 * A picture of the stage: a character, a background, an illustration, a grid's tile. An animated one
 * (GIF, WebP, PNG) is played here, frame by frame on a canvas,
 * from its first frame each time it is shown: a browser left to play it may play it once per page
 * only (Firefox shows its last frame from then on). It holds its last frame once played, and shows it
 * at once to players who ask for less motion. A still picture, or a browser that cannot decode
 * frames, is an image as before. Classes given to it, for its size and place, go to either.
 *
 * A new picture is shown once ready, decoded: until then the one before stays, so that an expression
 * changes without a blink, and a first picture stays hidden rather than drawn in pieces.
 */
const props = defineProps<{ url: string; alt: string }>()

/** The picture drawn, with its frames when it moves; null until the first one is ready. */
const shown = shallowRef<{ url: string; animation: DecodedAnimation | null } | null>(null)
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
/** The player's choice of motion; outside the player, the system's. */
const lessMotion = inject(LESS_MOTION, null)
let frameTimer: ReturnType<typeof setTimeout> | undefined
let showing = 0

function draw(decoded: DecodedAnimation, frameIndex: number) {
  const context = canvas.value?.getContext('2d')
  if (context == null) {
    return
  }
  context.clearRect(0, 0, decoded.width, decoded.height)
  context.drawImage(decoded.frames[frameIndex]!.bitmap, 0, 0)
}

/** Plays from the first frame, as many times as the file says; the last frame stays. */
function play(decoded: DecodedAnimation, round = 0, frameIndex = 0) {
  draw(decoded, frameIndex)
  const isLastFrame = frameIndex === decoded.frames.length - 1
  if (isLastFrame && round >= decoded.repetitions) {
    return
  }
  frameTimer = setTimeout(() => play(decoded, isLastFrame ? round + 1 : round, isLastFrame ? 0 : frameIndex + 1), decoded.frames[frameIndex]!.durationMs)
}

watch(() => props.url, async url => {
  const thisShowing = ++showing
  const decoded = await decodedAnimation(url)
  if (decoded === null) {
    await decodedStill(url)
  }
  if (thisShowing !== showing) {
    releaseAnimation(url)
    return
  }
  clearTimeout(frameTimer)
  const before = shown.value
  shown.value = { url, animation: decoded }
  if (before !== null) {
    releaseAnimation(before.url)
  }
  if (decoded === null) {
    return
  }
  await nextTick()
  if (thisShowing !== showing) {
    return
  }
  if (lessMotion?.value ?? systemAsksLessMotion()) {
    // Less motion: a picture that plays once shows where it ends, one that loops where it starts.
    draw(decoded, Number.isFinite(decoded.repetitions) ? decoded.frames.length - 1 : 0)
  } else {
    play(decoded)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  clearTimeout(frameTimer)
  showing++
  if (shown.value !== null) {
    releaseAnimation(shown.value.url)
  }
})
</script>

<template>
  <canvas
    v-if="shown?.animation != null"
    :key="shown.url"
    ref="canvas"
    :width="shown.animation.width"
    :height="shown.animation.height"
    :role="alt === '' ? undefined : 'img'"
    :aria-label="alt === '' ? undefined : alt"
    :aria-hidden="alt === '' ? 'true' : undefined"
  />
  <img
    v-else
    :class="{ pending: shown === null }"
    :src="shown?.url ?? url"
    :alt="alt"
    draggable="false"
  >
</template>

<style scoped>
.pending {
  visibility: hidden;
}
</style>
