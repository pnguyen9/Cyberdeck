<script setup lang="ts">
import type { PlayableStory, ProgressData } from '@cyberdeck/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** The illustrations of a game this profile has seen, in any playthrough; the others stay locked. */
const props = defineProps<{ story: PlayableStory; progress: ProgressData }>()
const emit = defineEmits<{ close: [] }>()

const tiles = computed(() => props.story.project.illustrations.map(illustration => ({
  id: illustration.id,
  name: illustration.name,
  isSeen: props.progress.illustrationIds.includes(illustration.id),
  url: illustration.assetId === null ? null : props.story.assetUrls.get(illustration.assetId) ?? null,
})))
const seenCount = computed(() => tiles.value.filter(tile => tile.isSeen).length)
/** The illustration shown on the whole screen; Escape or a click goes back to the gallery. */
const shown = ref<(typeof tiles.value)[number] | null>(null)

function onKeydown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    if (shown.value === null) {
      emit('close')
    } else {
      shown.value = null
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="gallery">
    <header class="gallery-header">
      <h1>{{ story.project.name }} · gallery</h1>
      <span class="count">{{ seenCount }} of {{ tiles.length }} seen</span>
      <button class="button" @click="emit('close')">← Library <kbd>Esc</kbd></button>
    </header>
    <ul class="tiles">
      <li v-for="tile in tiles" :key="tile.id">
        <button v-if="tile.isSeen" class="tile" :aria-label="tile.name" @click="shown = tile">
          <img v-if="tile.url !== null" :src="tile.url" alt="">
          <span v-else class="tile-name">{{ tile.name }}</span>
        </button>
        <div v-else class="tile locked" aria-label="Not seen yet">?</div>
      </li>
    </ul>
    <div v-if="shown !== null" class="shown" role="dialog" :aria-label="shown.name" @click="shown = null">
      <img v-if="shown.url !== null" :src="shown.url" :alt="shown.name">
      <span v-else class="tile-name">{{ shown.name }}</span>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
  font: 16px/1.5 system-ui, sans-serif;
  color: #e6e9ef;
}

.button {
  padding: 8px 16px;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
  cursor: pointer;
}

.gallery-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px 24px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 26px;
}

.count {
  flex: 1;
  color: #a3acbb;
}

kbd {
  margin-left: 6px;
  opacity: 0.6;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tile {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  padding: 0;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
  cursor: pointer;
}

.tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile.locked {
  font-size: 40px;
  color: #3a4252;
  cursor: default;
}

.tile-name {
  padding: 12px;
  text-align: center;
}

.shown {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: #000;
  cursor: pointer;
}

.shown img {
  max-width: 100%;
  max-height: 100%;
}
</style>
