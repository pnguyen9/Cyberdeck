<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { decodedAnimation, type DecodedAnimation } from './animatedPictures'

/**
 * A picture of the stage: a character, a background, an illustration, a grid's tile. An animated one
 * (GIF, WebP, PNG) is played here, frame by frame on a canvas,
 * from its first frame each time it is shown: a browser left to play it may play it once per page
 * only (Firefox shows its last frame from then on). It holds its last frame once played, and shows it
 * at once to players who ask for less motion. A still picture, or a browser that cannot decode
 * frames, is an image as before. Classes given to it, for its size and place, go to either.
 */
const props = defineProps<{ url: string; alt: string }>()

/** `pending` while it is found out whether the picture moves: nothing is shown, rather than the browser's own playing. */
const animation = ref<DecodedAnimation | null | 'pending'>('pending')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let frameTimer: ReturnType<typeof setTimeout> | undefined
let showing = 0

function draw(frameIndex: number) {
  const decoded = animation.value
  const context = canvas.value?.getContext('2d')
  if (decoded === null || decoded === 'pending' || context == null) {
    return
  }
  context.clearRect(0, 0, decoded.width, decoded.height)
  context.drawImage(decoded.frames[frameIndex]!.bitmap, 0, 0)
}

/** Plays from the first frame, as many times as the file says; the last frame stays. */
function play(decoded: DecodedAnimation, round = 0, frameIndex = 0) {
  draw(frameIndex)
  const isLastFrame = frameIndex === decoded.frames.length - 1
  if (isLastFrame && round >= decoded.repetitions) {
    return
  }
  frameTimer = setTimeout(() => play(decoded, isLastFrame ? round + 1 : round, isLastFrame ? 0 : frameIndex + 1), decoded.frames[frameIndex]!.durationMs)
}

watch(() => props.url, async url => {
  clearTimeout(frameTimer)
  const thisShowing = ++showing
  animation.value = 'pending'
  const decoded = await decodedAnimation(url)
  if (thisShowing !== showing) {
    return
  }
  animation.value = decoded
  if (decoded === null) {
    return
  }
  await nextTick()
  if (thisShowing !== showing) {
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Less motion: a picture that plays once shows where it ends, one that loops where it starts.
    draw(Number.isFinite(decoded.repetitions) ? decoded.frames.length - 1 : 0)
  } else {
    play(decoded)
  }
}, { immediate: true })

onBeforeUnmount(() => {
  clearTimeout(frameTimer)
  showing++
})
</script>

<template>
  <canvas
    v-if="animation !== null && animation !== 'pending'"
    ref="canvas"
    :width="animation.width"
    :height="animation.height"
    :role="alt === '' ? undefined : 'img'"
    :aria-label="alt === '' ? undefined : alt"
    :aria-hidden="alt === '' ? 'true' : undefined"
  />
  <img
    v-else
    :class="{ pending: animation === 'pending' }"
    :src="url"
    :alt="alt"
    draggable="false"
  >
</template>

<style scoped>
.pending {
  visibility: hidden;
}
</style>
