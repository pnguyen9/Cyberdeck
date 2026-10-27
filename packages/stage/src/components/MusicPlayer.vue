<script setup lang="ts">
import { onUnmounted, useTemplateRef, watch } from 'vue'

/** Plays `url` in a loop; another track replaces it, null stops it. `volume` goes from 0 to 1. */
const props = defineProps<{ url: string | null; volume: number }>()

const audio = useTemplateRef<HTMLAudioElement>('audio')

watch([() => props.url, audio], ([url, element]) => {
  if (element === null) {
    return
  }
  if (url === null) {
    element.pause()
    return
  }
  if (element.src !== url) {
    element.src = url
  }
  // Browsers refuse to play before the page received a click or a key; the next track change retries.
  element.play().catch(() => undefined)
}, { immediate: true })

watch([() => props.volume, audio], ([volume, element]) => {
  if (element !== null) {
    element.volume = volume
  }
}, { immediate: true })

onUnmounted(() => audio.value?.pause())
</script>

<template>
  <audio ref="audio" loop />
</template>
