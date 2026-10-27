<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { actionOf, DEFAULT_BINDINGS, describeInput, rebind, unbind, type InputBinding, type PlayerAction } from '../input/bindings'
import { DEFAULT_PLAYER_SETTINGS, TEXT_SPEED_RANGE, type PlayerSettings } from '../settings/playerSettings'

/** The player's settings: text speed, volumes, full screen and the inputs of each action. */
const settings = defineModel<PlayerSettings>({ required: true })
defineProps<{ isFullscreen: boolean }>()
const emit = defineEmits<{ close: []; toggleFullscreen: [] }>()

const ACTION_LABELS: Record<PlayerAction, string> = {
  advance: 'Next',
  back: 'Back',
  log: 'Log',
  skip: 'Skip read text',
  hideText: 'Hide the text',
  settings: 'Settings',
  fullscreen: 'Full screen',
  leave: 'Leave the game',
}
const actions = Object.keys(DEFAULT_BINDINGS) as PlayerAction[]

/** The action waiting for an input to be given to it; the next key or mouse button pressed is taken. */
const listeningFor = ref<PlayerAction | null>(null)
const notice = ref<string | null>(null)

const isInstant = () => settings.value.textSpeed === 0

function update(change: Partial<PlayerSettings>) {
  settings.value = { ...settings.value, ...change }
}

function setInstant(isOn: boolean) {
  update({ textSpeed: isOn ? 0 : DEFAULT_PLAYER_SETTINGS.textSpeed })
}

function listen(action: PlayerAction) {
  listeningFor.value = action
  notice.value = `Press a key or a mouse button for “${ACTION_LABELS[action]}”. Esc cancels.`
  window.addEventListener('keydown', takeKey, { capture: true })
  window.addEventListener('mousedown', takeMouseButton, { capture: true })
}

function stopListening() {
  listeningFor.value = null
  window.removeEventListener('keydown', takeKey, { capture: true })
  window.removeEventListener('mousedown', takeMouseButton, { capture: true })
}

/** Inputs are taken before the player sees them: Escape cancels rather than closing the panel. */
function takeKey(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (event.code === 'Escape') {
    stopListening()
    notice.value = null
    return
  }
  give({ type: 'key', code: event.code })
}

function takeMouseButton(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  give({ type: 'mouseButton', button: event.button })
}

function give(input: InputBinding) {
  const action = listeningFor.value
  stopListening()
  if (action === null) {
    return
  }
  const previous = actionOf(settings.value.bindings, input)
  update({ bindings: rebind(settings.value.bindings, action, input) })
  notice.value = previous !== null && previous !== action
    ? `${describeInput(input)} now does “${ACTION_LABELS[action]}”, no longer “${ACTION_LABELS[previous]}”.`
    : `${describeInput(input)} now does “${ACTION_LABELS[action]}”.`
}

function remove(action: PlayerAction, input: InputBinding) {
  update({ bindings: unbind(settings.value.bindings, action, input) })
  notice.value = settings.value.bindings[action].length === 0 ? `Nothing does “${ACTION_LABELS[action]}” any more, apart from its button.` : null
}

function resetKeys() {
  update({ bindings: DEFAULT_BINDINGS })
  notice.value = 'Every action has its default keys again.'
}

onUnmounted(stopListening)
</script>

<template>
  <div class="overlay" role="dialog" aria-label="Settings" @click.stop @wheel.stop @contextmenu.stop.prevent>
    <header class="overlay-header">
      <h2>Settings</h2>
      <button class="close-button" @click="emit('close')">Close <kbd>Esc</kbd></button>
    </header>

    <div class="columns">
      <section class="column">
        <label class="setting">
          <span class="setting-name">Text speed</span>
          <input
            type="range"
            :min="TEXT_SPEED_RANGE.slowest"
            :max="TEXT_SPEED_RANGE.fastest"
            :value="isInstant() ? TEXT_SPEED_RANGE.fastest : settings.textSpeed"
            :disabled="isInstant()"
            aria-label="Characters per second"
            @input="update({ textSpeed: Number(($event.target as HTMLInputElement).value) })"
          >
          <span class="setting-value">{{ isInstant() ? 'instant' : `${settings.textSpeed} characters a second` }}</span>
        </label>
        <label class="check">
          <input type="checkbox" :checked="isInstant()" @change="setInstant(($event.target as HTMLInputElement).checked)">
          Show each page at once
        </label>
        <label class="setting">
          <span class="setting-name">Music</span>
          <input type="range" min="0" max="100" :value="Math.round(settings.musicVolume * 100)" aria-label="Music volume" @input="update({ musicVolume: Number(($event.target as HTMLInputElement).value) / 100 })">
          <span class="setting-value">{{ Math.round(settings.musicVolume * 100) }} %</span>
        </label>
        <label class="setting">
          <span class="setting-name">Sound effects</span>
          <input type="range" min="0" max="100" :value="Math.round(settings.soundVolume * 100)" aria-label="Sound effects volume" @input="update({ soundVolume: Number(($event.target as HTMLInputElement).value) / 100 })">
          <span class="setting-value">{{ Math.round(settings.soundVolume * 100) }} %</span>
        </label>
        <button class="wide-button" @click="emit('toggleFullscreen')">{{ isFullscreen ? 'Leave full screen' : 'Full screen' }}</button>
        <button class="wide-button" @click="settings = { ...DEFAULT_PLAYER_SETTINGS, bindings: settings.bindings }">Default speed and volumes</button>
      </section>

      <section class="column keys" aria-label="Keys">
        <div v-for="action in actions" :key="action" class="key-row" :class="{ listening: listeningFor === action }">
          <span class="setting-name">{{ ACTION_LABELS[action] }}</span>
          <span class="inputs">
            <span v-for="input in settings.bindings[action]" :key="JSON.stringify(input)" class="input">
              {{ describeInput(input) }}
              <button class="remove" :aria-label="`Remove ${describeInput(input)}`" @click="remove(action, input)">×</button>
            </span>
            <span v-if="settings.bindings[action].length === 0" class="none">none</span>
          </span>
          <button class="add" @click="listen(action)">{{ listeningFor === action ? 'Press…' : 'Add a key' }}</button>
        </div>
        <button class="wide-button" @click="resetKeys">Default keys</button>
      </section>
    </div>
    <p class="notice" role="status">{{ notice ?? 'Keys are named as on an English keyboard: on others, the key at the same place.' }}</p>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 48px 120px;
  background: rgb(5 7 12 / 0.94);
  font: 24px/1.3 system-ui, sans-serif;
  color: #e6e9ef;
  cursor: default;
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 28px;
}

h2 {
  margin: 0;
  font: 600 48px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

.close-button,
.wide-button,
.add {
  padding: 10px 24px;
  border: 1px solid rgb(120 220 255 / 0.5);
  border-radius: 8px;
  background: #0e2a36;
  font: 24px/1.2 system-ui, sans-serif;
  color: #9eeaff;
  cursor: pointer;
}

kbd {
  margin-left: 8px;
  font: inherit;
  opacity: 0.6;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  gap: 64px;
  min-height: 0;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.setting {
  display: grid;
  gap: 6px;
}

.setting-name {
  font-weight: 600;
  color: #9eeaff;
}

.setting-value,
.none {
  color: #a3acbb;
}

input[type='range'] {
  width: 100%;
  accent-color: #9eeaff;
}

.check {
  display: flex;
  align-items: center;
  gap: 12px;
}

.check input {
  width: 24px;
  height: 24px;
  accent-color: #9eeaff;
}

.wide-button {
  align-self: flex-start;
}

.keys {
  gap: 10px;
}

.key-row {
  display: grid;
  grid-template-columns: 240px 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 6px 12px;
  border-radius: 8px;
}

.key-row.listening {
  background: #0e2a36;
}

.inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 12px;
  border: 1px solid rgb(120 220 255 / 0.3);
  border-radius: 999px;
  font-size: 20px;
}

.remove {
  border: 0;
  background: none;
  font: inherit;
  color: #a3acbb;
  cursor: pointer;
}

.add {
  padding: 6px 16px;
  font-size: 20px;
}

.notice {
  margin: auto 0 0;
  font-size: 22px;
  color: #a3acbb;
}
</style>
