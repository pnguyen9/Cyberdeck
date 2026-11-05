<script setup lang="ts">
import type { StoredChoice } from '@cyberdeck/core'
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
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
  buttons[(nextIndex + buttons.length) % buttons.length]?.focus()
}

onMounted(() => {
  armingTimer = setTimeout(() => {
    isArmed.value = true
  }, ARMING_DELAY_MILLISECONDS)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  clearTimeout(armingTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="choice-menu" :class="{ armed: isArmed }" role="menu">
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
  inset: 0 0 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

.option {
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
