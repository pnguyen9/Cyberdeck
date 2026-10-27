<script setup lang="ts">
import type { SaveData } from '@cyberdeck/core'

export interface SlotSummary {
  slot: string
  label: string
  save: SaveData | null
}

/** `file`: the playthrough as a file to download, when saving. */
const props = defineProps<{ mode: 'save' | 'load'; slots: SlotSummary[]; file?: { url: string; name: string } | null }>()
const emit = defineEmits<{ close: []; pick: [slot: string] }>()

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Saving goes into any manual slot; loading needs a save, and never writes the autosave. */
function isEnabled(summary: SlotSummary): boolean {
  return props.mode === 'save' ? summary.slot !== 'auto' : summary.save !== null
}
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="mode === 'save' ? 'Save' : 'Load'" @click.stop @wheel.stop>
    <header class="overlay-header">
      <h2>{{ mode === 'save' ? 'Save' : 'Load' }}</h2>
      <button class="close-button" @click="emit('close')">Close <kbd>Esc</kbd></button>
    </header>
    <div class="slots">
      <button
        v-for="summary in slots"
        :key="summary.slot"
        class="slot"
        :disabled="!isEnabled(summary)"
        @click="emit('pick', summary.slot)"
      >
        <span class="slot-label">{{ summary.label }}</span>
        <template v-if="summary.save !== null">
          <span class="slot-chapter">{{ summary.save.chapter ?? 'Untitled chapter' }}</span>
          <span class="slot-excerpt">{{ summary.save.excerpt }}</span>
          <span class="slot-date">{{ dateFormat.format(new Date(summary.save.savedAt)) }}</span>
        </template>
        <span v-else class="slot-empty">Empty</span>
      </button>
    </div>
    <p v-if="mode === 'save' && file != null" class="to-file">
      <a class="file-link" :href="file.url" :download="file.name" @click="emit('close')">Save to a file</a>
      to keep it, or to go on playing on another computer.
    </p>
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
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 32px;
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

.to-file {
  margin: 32px 0 0;
  font: 24px/1.5 system-ui, sans-serif;
  color: #a3acbb;
}

.file-link {
  display: inline-block;
  margin-right: 12px;
  padding: 10px 24px;
  border: 1px solid rgb(120 220 255 / 0.5);
  border-radius: 8px;
  background: #0e2a36;
  color: #9eeaff;
  text-decoration: none;
}

kbd {
  margin-left: 8px;
  font: inherit;
  opacity: 0.6;
}

.slots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 190px;
  padding: 24px 28px;
  border: 2px solid rgb(120 220 255 / 0.25);
  border-radius: 14px;
  background: rgb(8 10 16 / 0.85);
  text-align: left;
  color: #e6e9ef;
  cursor: pointer;
}

.slot:hover:not(:disabled),
.slot:focus-visible {
  outline: none;
  border-color: #9eeaff;
  background: #0e2a36;
}

.slot:disabled {
  opacity: 0.45;
  cursor: default;
}

.slot-label {
  font: 600 24px/1.2 system-ui, sans-serif;
  color: #9eeaff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.slot-chapter {
  font: 600 30px/1.3 system-ui, sans-serif;
}

.slot-excerpt {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font: 28px/1.4 Georgia, serif;
  color: #c5cad3;
}

.slot-date,
.slot-empty {
  margin-top: auto;
  font: 22px/1.2 system-ui, sans-serif;
  color: #7b8597;
}
</style>
