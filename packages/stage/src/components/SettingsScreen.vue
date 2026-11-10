<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import type { LanguageChoice } from '../i18n/locale'
import type { PlayerSettings } from '../settings/playerSettings'
import { STAGE_HEIGHT, STAGE_WIDTH } from '../textboxLayout'
import SettingsPanel from './SettingsPanel.vue'
import { useFullscreen, useStageScale } from './stageWindow'

/** The player's settings on a screen of their own, outside any game: drawn on a stage the size of a game's, scaled to the window. */
const settings = defineModel<PlayerSettings>({ required: true })
const languageChoice = defineModel<LanguageChoice | undefined>('languageChoice')
const emit = defineEmits<{ close: [] }>()

const viewport = useTemplateRef<HTMLElement>('viewport')
const scale = useStageScale(viewport)
const { isFullscreen, toggleFullscreen } = useFullscreen()

/** Escape closes, as in a game; while the panel waits for a key to give, it takes Escape first. */
function onKeyDown(event: KeyboardEvent) {
  if (event.code === 'Escape') {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div ref="viewport" class="settings-screen">
    <div class="stage" :style="{ width: `${STAGE_WIDTH}px`, height: `${STAGE_HEIGHT}px`, transform: `translate(-50%, -50%) scale(${scale})` }">
      <SettingsPanel
        v-model="settings"
        v-model:language-choice="languageChoice"
        :is-fullscreen="isFullscreen"
        @close="emit('close')"
        @toggle-fullscreen="toggleFullscreen"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-screen {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #05070c;
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
}
</style>
