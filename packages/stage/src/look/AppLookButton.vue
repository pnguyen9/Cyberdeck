<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useLocale, useMessages } from '../i18n/locale'
import { lookMessages } from '../i18n/lookMessages'
import {
  BORDER_KINDS,
  DEFAULT_APP_LOOK,
  FONT_CHOICES,
  FONT_STACKS,
  LOOK_PRESETS,
  PRESET_LOOKS,
  presetOf,
  READABLE_CONTRAST,
  worstContrast,
  type AppLook,
  type Corners,
} from './appLook'
import { useAppLook } from './appLookState'
import ColourField from './ColourField.vue'

defineOptions({ inheritAttrs: false })
/** The button opening the setting of the application's own look, and the setting, over the screen. */
const props = defineProps<{ app: string }>()
const look = useAppLook()
const locale = useLocale()
const text = useMessages(lookMessages)
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const isOpen = ref(false)

const preset = computed(() => presetOf(look.value))
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const textContrast = computed(() => worstContrast(look.value.textColour, look.value))
const accentContrast = computed(() => worstContrast(look.value.accentColour, look.value))
const isLow = computed(() => Math.min(textContrast.value, accentContrast.value) < READABLE_CONTRAST)

async function open() {
  isOpen.value = true
  await nextTick()
  dialog.value?.showModal()
}

function change(fields: Partial<AppLook>) {
  look.value = { ...look.value, ...fields }
}

function changeCorner(index: number, colour: string) {
  const corners = [...look.value.corners]
  corners[index] = colour
  change({ corners: corners as unknown as Corners })
}

/** How a preset looks, on its button. */
function swatchOf(preset: (typeof LOOK_PRESETS)[number]) {
  const shown = PRESET_LOOKS[preset]
  const [topLeft, topRight, bottomLeft, bottomRight] = shown.corners
  const flat = shown.backgroundKind === 'colour'
  return {
    background: flat ? shown.backgroundColour : `linear-gradient(to right, ${bottomLeft}, ${bottomRight})`,
    '--swatch-top': flat ? 'none' : `linear-gradient(to right, ${topLeft}, ${topRight})`,
    color: shown.textColour,
    fontFamily: FONT_STACKS[shown.font],
    border: `${shown.borderKind === 'double' ? 3 : 1}px ${shown.borderKind === 'none' ? 'solid transparent' : `${shown.borderKind} ${shown.borderColour}`}`,
  }
}

/** A click on the shade around the setting closes it, as Escape does. */
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) {
    dialog.value?.close()
  }
}
</script>

<template>
  <button type="button" v-bind="$attrs" :aria-haspopup="'dialog'" @click="open">{{ text.look }}</button>
  <dialog
    v-if="isOpen"
    ref="dialog"
    class="app-look"
    aria-labelledby="app-look-title"
    @close="isOpen = false"
    @click="onDialogClick"
    @keydown.stop
  >
    <header class="look-header">
      <h2 id="app-look-title">{{ text.lookOfApp(props.app) }}</h2>
      <button type="button" class="look-button" @click="dialog?.close()">{{ text.close }}</button>
    </header>
    <p class="look-muted">{{ text.onlyApp(props.app) }}</p>

    <h3>{{ text.presets }}</h3>
    <div class="presets" role="group" :aria-label="text.presets">
      <button
        v-for="name in LOOK_PRESETS"
        :key="name"
        type="button"
        class="preset"
        :aria-pressed="preset === name"
        :data-preset="name"
        @click="look = PRESET_LOOKS[name]"
      >
        <span class="swatch" :style="swatchOf(name)" aria-hidden="true"><span>Aa</span></span>
        <span>{{ text.presetNames[name] }}<template v-if="name === 'cyberpunk'"> ({{ text.byDefault }})</template></span>
      </button>
    </div>
    <p v-if="preset === null" class="look-muted">{{ text.custom }}</p>

    <h3>{{ text.inDepth }}</h3>
    <fieldset>
      <legend>{{ text.background }}</legend>
      <div class="choices">
        <label><input type="radio" name="background-kind" :checked="look.backgroundKind === 'colour'" @change="change({ backgroundKind: 'colour' })"> {{ text.oneColour }}</label>
        <label><input type="radio" name="background-kind" :checked="look.backgroundKind === 'gradient'" @change="change({ backgroundKind: 'gradient' })"> {{ text.gradient }}</label>
      </div>
      <ColourField v-if="look.backgroundKind === 'colour'" :model-value="look.backgroundColour" :label="text.colour" @update:model-value="colour => change({ backgroundColour: colour })" />
      <div v-else class="corners">
        <ColourField v-for="(corner, index) in look.corners" :key="index" :model-value="corner" :label="text.corners[index]!" @update:model-value="colour => changeCorner(index, colour)" />
      </div>
      <label class="check">
        <input type="checkbox" :checked="look.readableBox" aria-describedby="app-look-box-help" @change="change({ readableBox: ($event.target as HTMLInputElement).checked })">
        {{ text.readableBox }}
      </label>
      <p id="app-look-box-help" class="look-muted help">{{ text.readableBoxHelp }}</p>
    </fieldset>

    <fieldset>
      <legend>{{ text.font }}</legend>
      <label class="row">
        <span>{{ text.font }}</span>
        <select :value="look.font" @change="change({ font: ($event.target as HTMLSelectElement).value as AppLook['font'] })">
          <option v-for="font in FONT_CHOICES" :key="font" :value="font" :style="{ fontFamily: FONT_STACKS[font] }">{{ text.fontNames[font] }}</option>
        </select>
      </label>
      <ColourField :model-value="look.textColour" :label="text.textColour" @update:model-value="colour => change({ textColour: colour })" />
      <ColourField :model-value="look.accentColour" :label="text.accentColour" @update:model-value="colour => change({ accentColour: colour })" />
      <p class="contrast" :class="{ low: isLow }" role="status">
        {{ text.contrast(number.format(textContrast), number.format(accentContrast)) }}
        <template v-if="isLow"><br>{{ text.lowContrast }}</template>
      </p>
    </fieldset>

    <fieldset>
      <legend>{{ text.border }}</legend>
      <ColourField :model-value="look.borderColour" :label="text.borderColour" @update:model-value="colour => change({ borderColour: colour })" />
      <label class="row">
        <span>{{ text.borderKind }}</span>
        <select :value="look.borderKind" @change="change({ borderKind: ($event.target as HTMLSelectElement).value as AppLook['borderKind'] })">
          <option v-for="kind in BORDER_KINDS" :key="kind" :value="kind">{{ text.borderKinds[kind] }}</option>
        </select>
      </label>
    </fieldset>

    <footer class="look-footer">
      <button type="button" class="look-button" :disabled="preset === 'cyberpunk'" @click="look = DEFAULT_APP_LOOK">{{ text.backToDefault }}</button>
      <button type="button" class="look-button primary" @click="dialog?.close()">{{ text.close }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.app-look {
  box-sizing: border-box;
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 20px 24px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 10px;
  background: var(--look-ground, #0b0d12);
  font: 15px/1.5 var(--look-font, system-ui, sans-serif);
  color: var(--look-text, #e6e9ef);
}

.app-look::backdrop {
  background: rgb(0 0 0 / 0.6);
}

.look-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}

h2 {
  margin: 0;
  font-size: 22px;
  color: var(--look-accent, #9eeaff);
}

h3 {
  margin: 20px 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--look-muted, #7b8597);
}

.look-muted {
  margin: 4px 0;
  color: var(--look-muted, #7b8597);
}

.help {
  margin-top: 0;
  font-size: 14px;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 6px;
  background: var(--look-surface, #11151d);
  font: inherit;
  color: var(--look-text, #e6e9ef);
  cursor: pointer;
}

.preset[aria-pressed='true'] {
  border-color: var(--look-accent, #9eeaff);
  outline: 2px solid var(--look-accent, #9eeaff);
  outline-offset: -1px;
  font-weight: 600;
}

.swatch {
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  width: 36px;
  height: 28px;
  border-radius: 4px;
  position: relative;
  font-size: 14px;
  font-weight: 600;
}

/* The top edge's gradient over the bottom's, fading out downwards, as behind the screens. */
.swatch::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background-image: var(--swatch-top);
  mask-image: linear-gradient(to bottom, #000, transparent);
}

.swatch > span {
  position: relative;
}

fieldset {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 12px 12px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 6px;
}

legend {
  padding: 0 4px;
  font-weight: 600;
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.corners {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, max-content));
  gap: 8px 24px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
}

select {
  padding: 4px 6px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 4px;
  background: var(--look-surface, #11151d);
  font: inherit;
  color: var(--look-text, #e6e9ef);
}

.contrast {
  margin: 0;
  font-size: 14px;
  color: var(--look-soft, #a3acbb);
}

.contrast.low {
  color: var(--look-warning, #f6c177);
}

.look-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.look-button {
  padding: 6px 14px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 6px;
  background: var(--look-surface, #11151d);
  font: inherit;
  color: var(--look-text, #e6e9ef);
  cursor: pointer;
}

.look-button.primary {
  border-color: var(--look-accent, #9eeaff);
  background: var(--look-accent-fill, #0e2a36);
  color: var(--look-accent, #9eeaff);
  font-weight: 600;
}

.look-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.app-look :focus-visible {
  outline: 2px solid var(--look-accent, #9eeaff);
  outline-offset: 2px;
}
</style>
