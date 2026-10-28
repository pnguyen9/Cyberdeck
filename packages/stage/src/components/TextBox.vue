<script setup lang="ts">
import { computed } from 'vue'
import { textRuns, type StyledPart } from '../textRuns'
import {
  TEXTBOX_FONT_FAMILY,
  TEXTBOX_FONT_SIZE,
  TEXTBOX_LINE_HEIGHT,
  TEXTBOX_MAX_LINES,
  TEXTBOX_TEXT_WIDTH,
  STAGE_WIDTH,
} from '../textboxLayout'

const props = defineProps<{
  speaker: string | null
  text: string
  visibleLength: number
  isComplete: boolean
  /** Parts of the text in a style, with the properties of the style. */
  styles?: readonly StyledPart[]
  /** Where the speaker stands on stage, in percent of its width: the name plate sits above; null at the left. */
  speakerX?: number | null
}>()

/** The box is centred on the stage, as wide as its text and padding. */
const BOX_WIDTH = TEXTBOX_TEXT_WIDTH + 2 * 72
const BOX_LEFT = (STAGE_WIDTH - BOX_WIDTH) / 2
/** Keeps the plate over the box, whatever the length of the name. */
const PLATE_MARGIN = 160

const plateStyle = computed(() => {
  if (props.speakerX == null) {
    return undefined
  }
  const centre = Math.min(Math.max(props.speakerX / 100 * STAGE_WIDTH - BOX_LEFT, PLATE_MARGIN), BOX_WIDTH - PLATE_MARGIN)
  return { left: `${centre}px`, transform: 'translateX(-50%)' }
})

const runs = computed(() => textRuns(props.text, props.visibleLength, props.styles ?? []))

const textWidth = `${TEXTBOX_TEXT_WIDTH}px`
const fontSize = `${TEXTBOX_FONT_SIZE}px`
const textHeight = `${TEXTBOX_FONT_SIZE * TEXTBOX_LINE_HEIGHT * TEXTBOX_MAX_LINES}px`
/** In pixels, inherited as such: a larger style draws larger letters without making its line taller. */
const lineHeight = `${TEXTBOX_FONT_SIZE * TEXTBOX_LINE_HEIGHT}px`
</script>

<template>
  <div class="textbox" aria-hidden="true">
    <!-- Typed a letter at a time: screen readers hear the page whole from the player's announcements instead. -->
    <div v-if="speaker !== null" class="speaker" :style="plateStyle">{{ speaker }}</div>
    <p class="text">
      <span v-for="run in runs" :key="run.start" :class="run.classes">{{ run.text }}</span>
    </p>
    <div v-if="isComplete" class="continue-mark" aria-hidden="true">▼</div>
  </div>
</template>

<style scoped>
.textbox {
  position: absolute;
  left: 50%;
  bottom: 48px;
  transform: translateX(-50%);
  box-sizing: content-box;
  width: v-bind(textWidth);
  padding: 44px 72px 40px;
  border-radius: 20px;
  background: rgb(8 10 16 / 0.82);
  border: 2px solid rgb(120 220 255 / 0.35);
  box-shadow: 0 0 40px rgb(0 200 255 / 0.12);
}

.speaker {
  position: absolute;
  transition: left 0.3s ease;
  top: -30px;
  left: 56px;
  padding: 8px 28px;
  border-radius: 10px;
  background: #0e2a36;
  border: 2px solid rgb(120 220 255 / 0.5);
  font: 600 32px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

/*
 * A game's CSS draws within the text's lines, never over the menu or the stage around them. Text the
 * player chose larger, or in a plainer font, takes more lines: the box grows upwards to hold them.
 */
.text {
  contain: paint;
  min-height: calc(v-bind(textHeight) * var(--text-scale, 1));
  margin: 0;
  font-family: v-bind(TEXTBOX_FONT_FAMILY);
  font-size: calc(v-bind(fontSize) * var(--text-scale, 1));
  line-height: calc(v-bind(lineHeight) * var(--text-scale, 1));
  color: #f2f4f8;
  overflow-wrap: normal;
}

/* Laid out but invisible: lines break where they will once fully shown, instead of words jumping lines while typing. */
.not-yet-shown {
  visibility: hidden;
}

.continue-mark {
  position: absolute;
  right: 40px;
  bottom: 20px;
  font-size: 24px;
  color: rgb(120 220 255 / 0.8);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to {
    visibility: hidden;
  }
}

</style>

