<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { describeInput } from '../input/bindings'
import { backlogMessages } from '../i18n/backlogMessages'
import { useLocale, useMessages } from '../i18n/locale'
import { textRuns, type StyledPart } from '../textRuns'
import { focusAndReveal, keepScrollingKeys, SCROLLING_KEYS, stepFocus, useDialogFocus } from '../useDialogFocus'

export interface BacklogLine {
  stopIndex: number
  speaker: string | null
  text: string
  styles: readonly StyledPart[]
  isChoice: boolean
}

/** `lockedNote`: in a part played as a game, why the lines can only be read, not gone back to. */
const props = defineProps<{ lines: BacklogLine[]; lockedNote?: string | null }>()

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

const lineButtons = useTemplateRef<HTMLButtonElement[]>('lineButtons')
/** Lines that can be gone back to; in a part played as a game, none, and the list itself scrolls. */
const isLocked = computed(() => props.lockedNote != null)

/** The most recent lines are at the bottom, where the reader's eye already is. */
onMounted(() => {
  if (list.value !== null) {
    list.value.scrollTop = list.value.scrollHeight
  }
})
/**
 * The focus starts on the list, not on a line: a key pressed out of habit (Space, Enter) cannot go
 * back in the story. A first arrow, Home or End enters the lines.
 */
useDialogFocus(() => list.value)

/**
 * The line Tab stops at, the others reached with the arrows: the most recent one until another is
 * focused, so that the Close button is a Tab away whatever the length of the log.
 */
const tabLineIndex = ref(props.lines.length - 1)
watch(() => props.lines.length, length => {
  tabLineIndex.value = length - 1
})

/**
 * From line to line: up and down move a line, Page Up and Page Down a screen's worth, Home and End
 * to the first and the most recent; from the list itself, the first key lands on the most recent
 * line (the first one, for Home). A locked list has no lines to focus and scrolls as any list.
 * These keys stay the log's: none of them reaches the story behind.
 */
function onKeydown(event: KeyboardEvent) {
  keepScrollingKeys(event)
  const buttons = lineButtons.value ?? []
  if (!SCROLLING_KEYS.has(event.code) || isLocked.value || buttons.length === 0 || list.value === null) {
    return
  }
  event.preventDefault()
  const lastIndex = buttons.length - 1
  if (event.code === 'Home' || event.code === 'End') {
    focusAndReveal(buttons[event.code === 'Home' ? 0 : lastIndex])
  } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
    stepFocus(buttons, event.code === 'ArrowUp' ? -1 : 1, lastIndex, false)
  } else {
    const focusedIndex = buttons.findIndex(button => button === document.activeElement)
    focusAndReveal(lineAScreenAway(buttons, focusedIndex === -1 ? lastIndex : focusedIndex, event.code === 'PageDown' ? 1 : -1))
  }
}

/** The line about a screen's height above or below another; measured on screen, so that the stage's scale cancels out. */
function lineAScreenAway(buttons: HTMLButtonElement[], fromIndex: number, direction: 1 | -1) {
  const screenHeight = list.value?.getBoundingClientRect().height ?? 0
  const wantedTop = buttons[fromIndex]!.getBoundingClientRect().top + direction * screenHeight
  let target = buttons[fromIndex]
  for (let index = fromIndex + direction; index >= 0 && index < buttons.length; index += direction) {
    target = buttons[index]
    const top = target!.getBoundingClientRect().top
    if (direction > 0 ? top >= wantedTop : top <= wantedTop) {
      break
    }
  }
  return target
}
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="text.log" @click.stop @wheel.stop @keydown="onKeydown">
    <header class="overlay-header">
      <h2>{{ text.log }}</h2>
      <span class="hint">{{ lockedNote ?? text.hint }}</span>
      <button class="close-button" @click="emit('close')">{{ text.close }} <kbd>{{ escapeKey }}</kbd></button>
    </header>
    <ol ref="list" class="lines panel-focus" :tabindex="isLocked || lines.length === 0 ? 0 : -1" :aria-label="text.log">
      <li v-if="lines.length === 0" class="empty">{{ text.nothingRead }}</li>
      <li v-for="(line, lineIndex) in shownLines" :key="line.stopIndex">
        <button
          ref="lineButtons"
          class="line panel-focus"
          :class="{ choice: line.isChoice }"
          :disabled="isLocked"
          :tabindex="lineIndex === tabLineIndex ? 0 : -1"
          @focus="tabLineIndex = lineIndex"
          @click="emit('goBack', line.stopIndex)"
        >
          <span v-if="line.speaker !== null" class="speaker">{{ line.speaker }}</span>
          <span class="text"><template v-if="line.isChoice">▸ </template><span v-for="run in line.runs" :key="run.start" :class="run.classes">{{ run.text }}</span></span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.line:disabled {
  cursor: default;
}

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

.line:hover {
  background: rgb(var(--stage-cyan) / 0.08);
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

