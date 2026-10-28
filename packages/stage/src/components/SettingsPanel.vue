<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { actionOf, DEFAULT_BINDINGS, describeInput as describeInputIn, rebind, unbind, type InputBinding, type PlayerAction } from '../input/bindings'
import { useLocale, useMessages, type LanguageChoice } from '../i18n/locale'
import { settingsMessages } from '../i18n/settingsMessages'
import { DEFAULT_PLAYER_SETTINGS, TEXT_SCALES, TEXT_SPEED_RANGE, type PlayerSettings } from '../settings/playerSettings'
import LanguageSelect from './LanguageSelect.vue'

/**
 * The player's settings, one category at a time: text speed, volumes, full screen and language;
 * accessibility; the inputs of each action.
 */
const settings = defineModel<PlayerSettings>({ required: true })
/** The language of the application, offered when it is given: an application may choose it elsewhere. */
const languageChoice = defineModel<LanguageChoice | undefined>('languageChoice')
defineProps<{ isFullscreen: boolean }>()
const emit = defineEmits<{ close: []; toggleFullscreen: [] }>()

const locale = useLocale()
const text = useMessages(settingsMessages)
const describeInput = (input: InputBinding) => describeInputIn(input, locale.value)
const actionLabel = (action: PlayerAction) => text.value.actions[action]
const actions = Object.keys(DEFAULT_BINDINGS) as PlayerAction[]

/** The action waiting for an input to be given to it; the next key or mouse button pressed is taken. */
const listeningFor = ref<PlayerAction | null>(null)
const notice = ref<string | null>(null)

const isInstant = () => settings.value.textSpeed === 0

const CATEGORIES = ['general', 'accessibility', 'controls'] as const
const category = ref<(typeof CATEGORIES)[number]>('general')
const canReadAloud = typeof speechSynthesis !== 'undefined'

function resetSpeedAndVolumes() {
  const { textSpeed, musicVolume, soundVolume, voiceVolume } = DEFAULT_PLAYER_SETTINGS
  update({ textSpeed, musicVolume, soundVolume, voiceVolume })
}

function resetAccessibility() {
  const { textScale, readableFont, strongContrast, readAloud, untimedChoices, captions } = DEFAULT_PLAYER_SETTINGS
  update({ textScale, readableFont, strongContrast, readAloud, untimedChoices, captions })
}

function update(change: Partial<PlayerSettings>) {
  settings.value = { ...settings.value, ...change }
}

function setInstant(isOn: boolean) {
  update({ textSpeed: isOn ? 0 : DEFAULT_PLAYER_SETTINGS.textSpeed })
}

function listen(action: PlayerAction) {
  listeningFor.value = action
  notice.value = text.value.pressInputFor(actionLabel(action), describeInput({ type: 'key', code: 'Escape' }))
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
    ? text.value.inputMovedFrom(describeInput(input), actionLabel(action), actionLabel(previous))
    : text.value.inputNowDoes(describeInput(input), actionLabel(action))
}

function remove(action: PlayerAction, input: InputBinding) {
  update({ bindings: unbind(settings.value.bindings, action, input) })
  notice.value = settings.value.bindings[action].length === 0 ? text.value.nothingDoes(actionLabel(action)) : null
}

function resetKeys() {
  update({ bindings: DEFAULT_BINDINGS })
  notice.value = text.value.defaultKeysBack
}

onUnmounted(stopListening)
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="text.settings" @click.stop @wheel.stop @contextmenu.stop.prevent>
    <header class="overlay-header">
      <h2>{{ text.settings }}</h2>
      <button class="close-button" @click="emit('close')">{{ text.close }} <kbd>{{ describeInput({ type: 'key', code: 'Escape' }) }}</kbd></button>
    </header>

    <nav class="categories" :aria-label="text.settings">
      <button
        v-for="name in CATEGORIES"
        :key="name"
        class="category-button"
        :class="{ active: category === name }"
        :aria-pressed="category === name"
        @click="category = name"
      >
        {{ text.categories[name] }}
      </button>
    </nav>

    <section v-if="category === 'general'" class="category general">
      <label class="setting">
        <span class="setting-name">{{ text.textSpeed }}</span>
        <input
          type="range"
          :min="TEXT_SPEED_RANGE.slowest"
          :max="TEXT_SPEED_RANGE.fastest"
          :value="isInstant() ? TEXT_SPEED_RANGE.fastest : settings.textSpeed"
          :disabled="isInstant()"
          :aria-label="text.charactersPerSecond"
          @input="update({ textSpeed: Number(($event.target as HTMLInputElement).value) })"
        >
        <span class="setting-value">{{ isInstant() ? text.instant : text.speed(settings.textSpeed) }}</span>
      </label>
      <label class="check">
        <input type="checkbox" :checked="isInstant()" @change="setInstant(($event.target as HTMLInputElement).checked)">
        {{ text.showPagesAtOnce }}
      </label>
      <label class="setting">
        <span class="setting-name">{{ text.music }}</span>
        <input type="range" min="0" max="100" :value="Math.round(settings.musicVolume * 100)" :aria-label="text.musicVolume" @input="update({ musicVolume: Number(($event.target as HTMLInputElement).value) / 100 })">
        <span class="setting-value">{{ text.percent(Math.round(settings.musicVolume * 100)) }}</span>
      </label>
      <label class="setting">
        <span class="setting-name">{{ text.soundEffects }}</span>
        <input type="range" min="0" max="100" :value="Math.round(settings.soundVolume * 100)" :aria-label="text.soundEffectsVolume" @input="update({ soundVolume: Number(($event.target as HTMLInputElement).value) / 100 })">
        <span class="setting-value">{{ text.percent(Math.round(settings.soundVolume * 100)) }}</span>
      </label>
      <label class="setting">
        <span class="setting-name">{{ text.voices }}</span>
        <input type="range" min="0" max="100" :value="Math.round(settings.voiceVolume * 100)" :aria-label="text.voicesVolume" @input="update({ voiceVolume: Number(($event.target as HTMLInputElement).value) / 100 })">
        <span class="setting-value">{{ text.percent(Math.round(settings.voiceVolume * 100)) }}</span>
      </label>
      <button class="wide-button" @click="emit('toggleFullscreen')">{{ isFullscreen ? text.leaveFullscreen : text.fullscreen }}</button>
      <button class="wide-button" @click="resetSpeedAndVolumes">{{ text.defaultSpeedAndVolumes }}</button>
      <label v-if="languageChoice !== undefined" class="setting">
        <span class="setting-name">{{ text.language }}</span>
        <LanguageSelect v-model="languageChoice" class="language" />
      </label>
    </section>

    <section v-else-if="category === 'accessibility'" class="category general">
      <div class="setting">
        <span class="setting-name">{{ text.textSize }}</span>
        <div class="choices" role="radiogroup" :aria-label="text.textSize">
          <button
            v-for="scale in TEXT_SCALES"
            :key="scale"
            class="choice-button"
            role="radio"
            :class="{ active: settings.textScale === scale }"
            :aria-checked="settings.textScale === scale"
            @click="update({ textScale: scale })"
          >
            {{ text.percent(scale * 100) }}
          </button>
        </div>
      </div>
      <label class="check">
        <input type="checkbox" :checked="settings.readableFont" @change="update({ readableFont: ($event.target as HTMLInputElement).checked })">
        {{ text.readableFont }}
      </label>
      <label class="check">
        <input type="checkbox" :checked="settings.strongContrast" @change="update({ strongContrast: ($event.target as HTMLInputElement).checked })">
        {{ text.strongContrast }}
      </label>
      <label class="check">
        <input type="checkbox" :checked="settings.readAloud" :disabled="!canReadAloud" @change="update({ readAloud: ($event.target as HTMLInputElement).checked })">
        {{ text.readAloud }}
      </label>
      <p class="setting-value hint">{{ canReadAloud ? text.readAloudHelp : text.readAloudUnavailable }}</p>
      <label class="check">
        <input type="checkbox" :checked="settings.untimedChoices" @change="update({ untimedChoices: ($event.target as HTMLInputElement).checked })">
        {{ text.untimedChoices }}
      </label>
      <label class="check">
        <input type="checkbox" :checked="settings.captions" @change="update({ captions: ($event.target as HTMLInputElement).checked })">
        {{ text.captions }}
      </label>
      <p class="setting-value">{{ text.accessibilityHelp }}</p>
      <button class="wide-button" @click="resetAccessibility">{{ text.defaultAccessibility }}</button>
    </section>

    <section v-else class="category keys" :aria-label="text.keys">
      <div v-for="action in actions" :key="action" class="key-row" :class="{ listening: listeningFor === action }">
        <span class="setting-name">{{ actionLabel(action) }}</span>
        <span class="inputs">
          <span v-for="input in settings.bindings[action]" :key="JSON.stringify(input)" class="input">
            {{ describeInput(input) }}
            <button class="remove" :aria-label="text.removeInput(describeInput(input))" @click="remove(action, input)">×</button>
          </span>
          <span v-if="settings.bindings[action].length === 0" class="none">{{ text.noInput }}</span>
        </span>
        <button class="add" @click="listen(action)">{{ listeningFor === action ? text.pressInput : text.addKey }}</button>
      </div>
      <button class="wide-button" @click="resetKeys">{{ text.defaultKeys }}</button>
    </section>
    <p class="notice" role="status">{{ notice ?? (category === 'controls' ? text.keyPositions : '') }}</p>
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

.categories {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.category-button,
.choice-button {
  padding: 10px 28px;
  border: 1px solid rgb(120 220 255 / 0.35);
  border-radius: 8px;
  background: transparent;
  font: 24px/1.2 system-ui, sans-serif;
  color: #a3acbb;
  cursor: pointer;
}

.category-button.active,
.choice-button.active {
  border-color: rgb(120 220 255 / 0.8);
  background: #0e2a36;
  color: #9eeaff;
}

.choices {
  display: flex;
  gap: 12px;
}

.category {
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
}

.general {
  max-width: 900px;
}

.setting {
  display: grid;
  gap: 6px;
}

.setting-name {
  font-weight: 600;
  color: #9eeaff;
}

.hint {
  margin: -14px 0 0 36px;
  font-size: 20px;
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

.language {
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
