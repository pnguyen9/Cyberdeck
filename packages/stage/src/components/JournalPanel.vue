<script setup lang="ts">
import { journalOf, type PlayableStory, type PlayerSnapshot } from '@cyberdeck/core'
import { computed } from 'vue'
import { describeInput } from '../input/bindings'
import { useLocale, useMessages } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'

/**
 * What the player holds, as far as the author shows it: the items of a bag, a counter's number, the
 * endings reached. Nothing the author did not choose to show.
 */
const props = defineProps<{ story: PlayableStory; snapshot: PlayerSnapshot; endingIds: readonly string[] }>()
const emit = defineEmits<{ close: [] }>()
const locale = useLocale()
const text = useMessages(playerMessages)
const escapeKey = computed(() => describeInput({ type: 'key', code: 'Escape' }, locale.value))
const journal = computed(() => journalOf(props.story.project, props.snapshot, props.endingIds))
const isEmpty = computed(() => journal.value.entries.length === 0 && journal.value.endings === null)
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="text.journal" @click.stop @wheel.stop>
    <header class="overlay-header">
      <h2>{{ text.journal }}</h2>
      <button class="close-button" @click="emit('close')">{{ text.close }} <kbd>{{ escapeKey }}</kbd></button>
    </header>
    <div class="entries">
      <p v-if="isEmpty" class="empty">{{ text.journalEmpty }}</p>
      <section v-for="entry in journal.entries" :key="entry.id" class="entry">
        <h3>{{ entry.name }}</h3>
        <ul v-if="entry.kind === 'decision'" class="items">
          <li v-for="item in entry.items" :key="item">{{ item }}</li>
        </ul>
        <p v-else class="count">{{ entry.items[0] }}</p>
      </section>
      <section v-if="journal.endings !== null" class="entry">
        <h3>{{ text.endingsReached(journal.endings.reached.length, journal.endings.total) }}</h3>
        <ul class="items">
          <li v-for="ending in journal.endings.reached" :key="ending">★ {{ ending }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 48px 160px;
  background: rgb(5 7 12 / 0.92);
  cursor: default;
}

.overlay-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 24px;
}

h2 {
  margin: 0;
  font: 600 48px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

.close-button {
  padding: 10px 24px;
  border: 1px solid rgb(120 220 255 / 0.5);
  border-radius: 8px;
  background: #0e2a36;
  font: 26px/1.2 system-ui, sans-serif;
  color: #9eeaff;
  cursor: pointer;
}

kbd {
  margin-left: 8px;
  font: inherit;
  opacity: 0.6;
}

.entries {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
  align-content: start;
  gap: 28px;
  overflow-y: auto;
}

.entry {
  padding: 22px 28px;
  border: 1px solid rgb(120 220 255 / 0.25);
  border-radius: 12px;
  background: rgb(14 20 30 / 0.8);
}

h3 {
  margin: 0 0 12px;
  font: 600 calc(28px * var(--text-scale, 1))/1.3 system-ui, sans-serif;
  color: #9eeaff;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
  font: calc(34px * var(--text-scale, 1))/1.5 Georgia, serif;
  color: #e6e9ef;
}

.count {
  margin: 0;
  font: 600 calc(48px * var(--text-scale, 1))/1.2 Georgia, serif;
  color: #e6e9ef;
}

.empty {
  font: calc(34px * var(--text-scale, 1))/1.5 Georgia, serif;
  color: #7b8597;
}
</style>
