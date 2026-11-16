<script setup lang="ts">
import { LESS_MOTION, TOUCH_SCREEN_QUERY, useMediaQuery, useMessages } from '@cyberdeck/stage'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { landscapeMessages } from '../i18n/landscapeMessages'
import { landscapeAsk } from './landscape'

/**
 * Over a game played on a phone or a tablet: asks to turn the device sideways and offers full
 * screen, where the orientation is then locked if the browser allows. Computers never see it.
 * Held upright, the request covers the game, as a dialog; sideways, the offer is a box in the top
 * right corner, clear of the stage's *Leave* button, which the game goes on beside. Either takes the
 * focus as it appears; Escape says *Not now*.
 */
const props = defineProps<{ isDismissed: boolean }>()
const emit = defineEmits<{ dismiss: [] }>()
const text = useMessages(landscapeMessages)
/** The player's Motion setting, as Datajack gives it: the device drawn turning stands still with less motion. */
const lessMotion = inject(LESS_MOTION, ref(false))

const isTouchScreen = useMediaQuery(TOUCH_SCREEN_QUERY)
const isPortrait = useMediaQuery('(orientation: portrait)')
const isFullscreen = ref(document.fullscreenElement !== null)
const canFullscreen = document.fullscreenEnabled === true

const onFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement !== null
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

const ask = computed(() => landscapeAsk({
  isTouchScreen: isTouchScreen.value,
  isPortrait: isPortrait.value,
  isFullscreen: isFullscreen.value,
  canFullscreen,
  isDismissed: props.isDismissed,
}))

/** The first button, full screen where there is one, takes the focus each time the offer appears or changes. */
const box = useTemplateRef<HTMLElement>('box')
watch(ask, async current => {
  if (current !== 'none') {
    await nextTick()
    box.value?.querySelector('button')?.focus()
  }
}, { immediate: true })

/** `ScreenOrientation.lock`, which the DOM's types no longer carry: Chrome on Android has it, in full screen. */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> }

/** Full screen, then the orientation locked sideways where the browser allows; elsewhere the player turns the device. */
async function playFullscreen() {
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    return
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape')
  } catch {
    // Locking is refused: the message asks to turn the device while it is held upright.
  }
}
</script>

<template>
  <div
    v-if="ask !== 'none'"
    class="landscape-offer"
    :class="[ask, { 'less-motion': lessMotion }]"
    :role="ask === 'turn' ? 'dialog' : 'region'"
    :aria-modal="ask === 'turn' ? 'true' : undefined"
    aria-labelledby="landscape-offer-text"
    @keydown.esc.stop.prevent="emit('dismiss')"
  >
    <div ref="box" class="box">
      <div v-if="ask === 'turn'" class="device" aria-hidden="true" />
      <p id="landscape-offer-text">{{ ask === 'turn' ? text.turn : text.fullscreenOffer }}</p>
      <div class="buttons">
        <button v-if="canFullscreen && !isFullscreen" class="button primary" @click="playFullscreen">{{ text.playFullscreen }}</button>
        <button class="button" @click="emit('dismiss')">{{ text.notNow }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.landscape-offer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--look-ground) 92%, transparent);
  font: 18px/1.4 var(--look-font);
  color: var(--look-text);
  text-align: center;
}

/*
 * Sideways already: a box in the top right corner, leaving the stage's Leave button (top left) and
 * its text box (below) in sight.
 */
.landscape-offer.offerFullscreen {
  inset: 8px 8px auto auto;
  max-width: min(32em, calc(100% - 200px));
  padding: 10px 14px;
  border: var(--look-control-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--look-ground) 92%, transparent);
  font-size: 16px;
}

.box {
  display: grid;
  justify-items: center;
  gap: 16px;
  max-width: 28em;
}

.offerFullscreen .box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 16px;
  max-width: none;
}

.box p {
  margin: 0;
}

/* A phone drawn upright, turning on its side. */
.device {
  width: 48px;
  height: 80px;
  border: 3px solid var(--look-accent);
  border-radius: 8px;
  animation: turn 2.4s ease-in-out infinite;
}

@keyframes turn {
  0%, 30% { transform: rotate(0deg); }
  60%, 100% { transform: rotate(-90deg); }
}

.less-motion .device {
  animation: none;
  transform: rotate(-90deg);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.button {
  min-height: 44px;
  padding: 8px 20px;
}
</style>
