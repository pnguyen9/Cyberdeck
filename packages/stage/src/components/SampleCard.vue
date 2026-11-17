<script setup lang="ts">
import type { SampleIndexEntry } from '../app/samples'

/**
 * A sample on the shelf of Datajack or Cyberdeck: its cover (a letter on the look's colours when it
 * has none), name and description. What can be done with it, and what is said of it, is the slot's.
 */
defineProps<{ sample: SampleIndexEntry }>()
</script>

<template>
  <li class="sample">
    <div class="sample-cover" :class="{ placeholder: sample.cover === null }">
      <img v-if="sample.cover !== null" :src="sample.cover" alt="" loading="lazy">
      <span v-else aria-hidden="true">{{ sample.name.charAt(0) }}</span>
    </div>
    <div class="sample-details">
      <h3>{{ sample.name }}</h3>
      <p class="sample-description">{{ sample.description }}</p>
      <slot />
    </div>
  </li>
</template>

<style scoped>
.sample {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 8px;
  background: var(--look-surface);
}

.sample-cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 6px;
  background: var(--look-ground);
}

.sample-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sample-cover.placeholder {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--look-accent-fill), var(--look-accent));
  font-size: 40px;
  font-weight: 700;
  color: var(--look-text);
}

.sample-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.sample-details h3 {
  margin: 0;
  font-size: 18px;
}

.sample-description {
  flex: 1;
  margin: 0;
  font-size: 14px;
  color: var(--look-text-soft);
}
</style>
