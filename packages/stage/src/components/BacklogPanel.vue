<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { describeInput } from '../input/bindings'
import { backlogMessages } from '../i18n/backlogMessages'
import { useLocale, useMessages } from '../i18n/locale'
import { textRuns, type StyledPart } from '../textRuns'

export interface BacklogLine {
  stopIndex: number
  speaker: string | null
  text: string
  styles: readonly StyledPart[]
  isChoice: boolean
}

const props = defineProps<{ lines: BacklogLine[] }>()

/** Lines in their styles as they were read, without shaking: a list scrolled through stays still. */
const shownLines = computed(() => props.lines.map(line => ({
  ...line,
  runs: textRuns(line.text, line.text.length, line.styles.map(part => ({ ...part, properties: part.properties.filter(property => property !== 'shaking') }))),
})))
const emit = defineEmits<{ close: []; goBack: [stopIndex: number] }>()

const list = useTemplateRef<HTMLElement>('list')
const locale = useLocale()
const text = useMessages(backlogMessages)
const escapeKey = computed(() => describeInput({ type: 'key', code: 'Escape' }, locale.value))

/** The most recent lines are at the bottom, where the reader's eye already is. */
onMounted(() => {
  if (list.value !== null) {
    list.value.scrollTop = list.value.scrollHeight
  }
})
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="text.log" @click.stop @wheel.stop>
    <header class="overlay-header">
      <h2>{{ text.log }}</h2>
      <span class="hint">{{ text.hint }}</span>
      <button class="close-button" @click="emit('close')">{{ text.close }} <kbd>{{ escapeKey }}</kbd></button>
    </header>
    <ol ref="list" class="lines">
      <li v-if="lines.length === 0" class="empty">{{ text.nothingRead }}</li>
      <li v-for="line in shownLines" :key="line.stopIndex">
        <button class="line" :class="{ choice: line.isChoice }" @click="emit('goBack', line.stopIndex)">
          <span v-if="line.speaker !== null" class="speaker">{{ line.speaker }}</span>
          <span class="text"><template v-if="line.isChoice">▸ </template><span v-for="run in line.runs" :key="run.start" :class="run.classes">{{ run.text }}</span></span>
        </button>
      </li>
    </ol>
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
  gap: 32px;
  margin-bottom: 24px;
}

h2 {
  margin: 0;
  font: 600 48px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

.hint {
  flex: 1;
  font: 26px/1.2 system-ui, sans-serif;
  color: #7b8597;
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

.lines {
  flex: 1;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.line {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 24px;
  width: 100%;
  padding: 16px 20px;
  border: none;
  border-radius: 10px;
  background: none;
  text-align: left;
  font: 36px/1.45 Georgia, serif;
  color: #e6e9ef;
  cursor: pointer;
}

.line:hover,
.line:focus-visible {
  outline: none;
  background: rgb(120 220 255 / 0.08);
}

.speaker {
  font: 600 30px/1.6 system-ui, sans-serif;
  color: #9eeaff;
}

.text {
  grid-column: 2;
}

.choice .text {
  color: #f5c451;
}

.empty {
  font: 32px/1.4 system-ui, sans-serif;
  color: #7b8597;
}
</style>

