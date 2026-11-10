<script setup lang="ts">
import type { StoredChoice } from '@cyberdeck/core'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useMessages } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'

const props = defineProps<{
  choice: StoredChoice
  /** For a timed choice: the time left and the whole time, which the bar shows running out. */
  time?: { leftMs: number; limitMs: number } | null
}>()
const text = useMessages(playerMessages)
const timeBarStyle = computed(() => props.time == null ? undefined : {
  '--time-left': String(props.time.leftMs / props.time.limitMs),
  animationDuration: `${props.time.leftMs}ms`,
})
const emit = defineEmits<{ choose: [optionId: string] }>()
/** The option taken when the time runs out, while it runs: it carries the bar and a clock, so that waiting says what it picks. */
const waitedOptionId = computed(() => timeBarStyle.value === undefined ? null : props.choice.options.find(option => option.timeout === true)?.id ?? null)

/**
 * Players press keys and click quickly to get through text. Options start unfocused and ignore
 * clicks for a moment, so that a press meant for the previous page never picks an option.
 */
const ARMING_DELAY_MILLISECONDS = 400

/** From five options on, they are drawn smaller and closer, so that more fit above the text box. */
const COMPACT_FROM = 5
const isCompact = computed(() => props.choice.options.length >= COMPACT_FROM)

/**
 * A list still longer than its place scrolls, its edges fading where more options lie beyond; the
 * wheel scrolls it rather than going back or on, until it reaches an end.
 */
const menu = useTemplateRef<HTMLElement>('menu')
const moreAbove = ref(false)
const moreBelow = ref(false)
function measureScroll() {
  const element = menu.value
  if (element === null) {
    return
  }
  moreAbove.value = element.scrollTop > 1
  moreBelow.value = element.scrollTop + element.clientHeight < element.scrollHeight - 1
}
function onWheel(event: WheelEvent) {
  if ((event.deltaY < 0 && moreAbove.value) || (event.deltaY > 0 && moreBelow.value)) {
    event.stopPropagation()
  }
}

const optionButtons = useTemplateRef<HTMLButtonElement[]>('optionButtons')
const isArmed = ref(false)
let armingTimer: ReturnType<typeof setTimeout> | undefined

function choose(optionId: string) {
  if (isArmed.value) {
    emit('choose', optionId)
  }
}

/**
 * Up and down arrows focus the options, the first press entering the menu; Enter or Space then
 * picks, as on any button. Left and right stay free for going back and forward.
 */
function onKeydown(event: KeyboardEvent) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.code]
  const buttons = optionButtons.value ?? []
  if (step === undefined || buttons.length === 0) {
    return
  }
  event.preventDefault()
  const focusedIndex = buttons.findIndex(button => button === document.activeElement)
  const nextIndex = focusedIndex === -1 ? (step > 0 ? 0 : buttons.length - 1) : focusedIndex + step
  const next = buttons[(nextIndex + buttons.length) % buttons.length]
  next?.focus()
  next?.scrollIntoView({ block: 'nearest' })
}

/** A larger text, or a smaller window, may make the list overflow: it is measured again then. */
const resizeObserver = new ResizeObserver(measureScroll)

onMounted(() => {
  void nextTick(measureScroll)
  if (menu.value !== null) {
    resizeObserver.observe(menu.value)
  }
  armingTimer = setTimeout(() => {
    isArmed.value = true
  }, ARMING_DELAY_MILLISECONDS)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  resizeObserver.disconnect()
  clearTimeout(armingTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="menu"
    class="choice-menu"
    :class="{ armed: isArmed, compact: isCompact, 'more-above': moreAbove, 'more-below': moreBelow }"
    role="menu"
    @scroll="measureScroll"
    @wheel="onWheel"
  >
    <button
      v-for="option in choice.options"
      ref="optionButtons"
      :key="option.id"
      class="option"
      :class="{ waited: option.id === waitedOptionId }"
      role="menuitem"
      :aria-label="option.id === waitedOptionId ? text.takenWhenTimeRunsOut(option.text) : undefined"
      @click.stop="choose(option.id)"
    >
      <span v-if="option.id === waitedOptionId" class="clock" aria-hidden="true">⏱ </span>{{ option.text }}
      <span v-if="option.id === waitedOptionId" class="time" aria-hidden="true">
        <span class="time-left" :style="timeBarStyle" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.choice-menu {
  position: absolute;
  inset: 24px 0 360px;
  /* One column as wide as the widest option, so that all of them share its width. */
  display: grid;
  grid-template-columns: fit-content(100%);
  justify-content: center;
  /* Centred while the options fit; from the top once they overflow, so that none is out of reach. */
  align-content: safe center;
  gap: 28px;
  overflow-y: auto;
  padding: 12px 0;
  scrollbar-width: thin;
  scrollbar-color: rgb(120 220 255 / 0.4) transparent;
}

.option {
  flex: none;
  min-width: 900px;
  padding: 26px 48px;
  border-radius: 14px;
  border: 2px solid rgb(120 220 255 / 0.4);
  background: rgb(8 10 16 / 0.85);
  font: calc(38px * var(--text-scale, 1))/1.3 Georgia, serif;
  color: #f2f4f8;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.armed .option {
  opacity: 1;
}

.compact {
  gap: 14px;
}

.compact .option {
  padding: 14px 40px;
  font-size: calc(32px * var(--text-scale, 1));
}

/* Where more options lie beyond the edge, the list fades out there. */
.more-below {
  mask-image: linear-gradient(black calc(100% - 80px), transparent);
}

.more-above {
  mask-image: linear-gradient(transparent, black 80px);
}

.more-above.more-below {
  mask-image: linear-gradient(transparent, black 80px, black calc(100% - 80px), transparent);
}

.armed .option:hover,
.armed .option:focus-visible {
  outline: none;
  border-color: #9eeaff;
  background: #0e2a36;
  box-shadow: 0 0 30px rgb(0 200 255 / 0.25);
}

/* The option waiting takes: a clock before it, the time running out along its lower edge. */
.clock {
  opacity: 0.7;
}

.option.waited {
  position: relative;
  overflow: hidden;
}

.time {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  background: rgb(120 220 255 / 0.15);
}

.time-left {
  display: block;
  height: 100%;
  background: #9eeaff;
  transform-origin: left;
  animation-name: run-out;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes run-out {
  from {
    transform: scaleX(var(--time-left));
  }
  to {
    transform: scaleX(0);
  }
}

</style>
