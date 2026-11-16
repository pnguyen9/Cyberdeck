<script setup lang="ts">
import { useMessages } from '@cyberdeck/stage'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { landscapeMessages } from '../i18n/landscapeMessages'
import { landscapeAsk, TOUCH_SCREEN_QUERY } from './landscape'

/**
 * Over a game played on a phone or a tablet: asks to turn the device sideways and offers full
 * screen, where the orientation is then locked if the browser allows. Computers never see it.
 */
const props = defineProps<{ isDismissed: boolean }>()
const emit = defineEmits<{ dismiss: [] }>()
const text = useMessages(landscapeMessages)

const touchQuery = window.matchMedia(TOUCH_SCREEN_QUERY)
const portraitQuery = window.matchMedia('(orientation: portrait)')
const isTouchScreen = ref(touchQuery.matches)
const isPortrait = ref(portraitQuery.matches)
const isFullscreen = ref(document.fullscreenElement !== null)
const canFullscreen = document.fullscreenEnabled === true

const onTouchChange = () => {
  isTouchScreen.value = touchQuery.matches
}
const onPortraitChange = () => {
  isPortrait.value = portraitQuery.matches
}
const onFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement !== null
}
onMounted(() => {
  touchQuery.addEventListener('change', onTouchChange)
  portraitQuery.addEventListener('change', onPortraitChange)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  touchQuery.removeEventListener('change', onTouchChange)
  portraitQuery.removeEventListener('change', onPortraitChange)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

const ask = computed(() => landscapeAsk({
  isTouchScreen: isTouchScreen.value,
  isPortrait: isPortrait.value,
  isFullscreen: isFullscreen.value,
  canFullscreen,
  isDismissed: props.isDismissed,
}))

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
  <div v-if="ask !== 'none'" class="landscape-offer" :class="ask" role="dialog" aria-modal="true" :aria-label="ask === 'turn' ? text.turn : text.fullscreenOffer">
    <div class="box">
      <div v-if="ask === 'turn'" class="device" aria-hidden="true" />
      <p>{{ ask === 'turn' ? text.turn : text.fullscreenOffer }}</p>
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
  background: rgb(5 7 10 / 0.92);
  font: 18px/1.4 system-ui, sans-serif;
  color: #e6e9ef;
  text-align: center;
}

/* Sideways already: a band over the top of the stage, whose text box still shows below it. */
.landscape-offer.offerFullscreen {
  inset: 0 0 auto;
  padding: 12px 16px;
  background: rgb(5 7 10 / 0.85);
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
  border: 3px solid #9eeaff;
  border-radius: 8px;
  animation: turn 2.4s ease-in-out infinite;
}

@keyframes turn {
  0%, 30% { transform: rotate(0deg); }
  60%, 100% { transform: rotate(-90deg); }
}

@media (prefers-reduced-motion: reduce) {
  .device {
    animation: none;
    transform: rotate(-90deg);
  }
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
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
  cursor: pointer;
}

.button.primary {
  border-color: #9eeaff;
  background: #0e2a36;
  color: #9eeaff;
}
</style>
