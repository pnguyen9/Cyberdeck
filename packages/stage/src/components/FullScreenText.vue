<script setup lang="ts">
import { computed } from 'vue'
import { textRuns, type StyledPart } from '../textRuns'

/**
 * Text over the whole screen, as in a book: the pages of the screen one under the other, the last
 * one typed as the text box would.
 */
const props = defineProps<{
  pages: readonly { id: string; speaker: string | null; text: string; styles: readonly StyledPart[] }[]
  /** Characters shown of the last page; earlier ones are complete. */
  visibleLength: number
  isComplete: boolean
}>()

const paragraphs = computed(() => props.pages.map((page, index) => ({
  id: page.id,
  speaker: page.speaker,
  runs: textRuns(page.text, index === props.pages.length - 1 ? props.visibleLength : page.text.length, page.styles),
})))
</script>

<template>
  <div class="full-text" aria-live="polite">
    <div v-for="paragraph in paragraphs" :key="paragraph.id" class="paragraph">
      <div v-if="paragraph.speaker !== null" class="speaker">{{ paragraph.speaker }}</div>
      <p class="paragraph-text">
        <span v-for="run in paragraph.runs" :key="run.start" :class="run.classes">{{ run.text }}</span>
      </p>
    </div>
    <div v-if="isComplete" class="continue-mark" aria-hidden="true">▼</div>
  </div>
</template>

<style scoped>
/* Room for a full screen: five pages of two lines, names on their plates, the menu below. */
.full-text {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: 70px 260px 150px;
  background: rgb(5 7 12 / 0.82);
  /* The line height in pixels, inherited as such: a larger style keeps the lines where they are. */
  font: 34px/49px Georgia, serif;
  color: #f2f4f8;
}

.paragraph {
  margin: 0 0 18px;
}

.paragraph-text {
  margin: 0;
}

/* The plate of the text box, smaller: the name apart from what is said. */
.speaker {
  display: inline-block;
  margin-bottom: 6px;
  padding: 4px 18px;
  border: 2px solid rgb(120 220 255 / 0.5);
  border-radius: 8px;
  background: #0e2a36;
  font: 600 24px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

.not-yet-shown {
  visibility: hidden;
}

.continue-mark {
  position: absolute;
  right: 120px;
  bottom: 80px;
  font-size: 28px;
  color: rgb(120 220 255 / 0.8);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to {
    visibility: hidden;
  }
}
</style>

