<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useAboutApp } from '../app/aboutApp'
import { useBackdropClose } from '../app/backdropClose'
import { useLocale, useMessages } from '../i18n/locale'
import { lookMessages } from '../i18n/lookMessages'
import {
  BORDER_KINDS,
  DEFAULT_APP_LOOK,
  FONT_CHOICES,
  FONT_STACKS,
  LOOK_PRESETS,
  lookVariables,
  PRESET_LOOKS,
  presetOf,
  READABLE_CONTRAST,
  VISIBLE_CONTRAST,
  worstContrast,
  type AppLook,
  type Corners,
  type LookPreset,
} from './appLook'
import { useAppLook } from './appLookState'
import ColourField from './ColourField.vue'

defineOptions({ inheritAttrs: false })
/** The button opening the setting of the application's own look, and the setting, over the screen. */
const { look, custom } = useAppLook()
const appName = useAboutApp()?.name ?? ''
const locale = useLocale()
const text = useMessages(lookMessages)
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const backdrop = useBackdropClose(dialog)
const isOpen = ref(false)

/** Each preset's button wears it, as the page behind the screens would. */
const PRESET_SWATCHES = Object.fromEntries(LOOK_PRESETS.map(name => [name, lookVariables(PRESET_LOOKS[name])])) as Record<LookPreset, Record<string, string>>
const customSwatch = computed(() => custom.value === null ? null : lookVariables(custom.value))

const preset = computed(() => presetOf(look.value))
const number = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))

/** The contrasts, read again once a colour is chosen rather than at each key typed or step of the picker dragged. */
const contrasts = ref(contrastsOf(look.value))
function contrastsOf(shown: AppLook) {
  return {
    text: worstContrast(shown.textColour, shown),
    accent: worstContrast(shown.accentColour, shown),
    // Without borders, controls keep a faint edge that always stands out enough.
    border: shown.borderKind === 'none' ? null : worstContrast(shown.borderColour, shown),
  }
}
function refreshContrasts() {
  contrasts.value = contrastsOf(look.value)
}
const isTextLow = computed(() => Math.min(contrasts.value.text, contrasts.value.accent) < READABLE_CONTRAST)
/** The presets' borders are drawn soft on purpose (their buttons are told by their fill too): only a look of one's own is warned. */
const isBorderLow = computed(() => preset.value === null && contrasts.value.border !== null && contrasts.value.border < VISIBLE_CONTRAST)

async function open() {
  refreshContrasts()
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

function onDialogClick(event: MouseEvent) {
  backdrop.onClick(event)
  refreshContrasts()
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
    @pointerdown="backdrop.onPointerDown"
    @click="onDialogClick"
    @change="refreshContrasts"
    @keydown.stop
  >
    <header class="look-header">
      <h2 id="app-look-title">{{ text.lookOfApp(appName) }}</h2>
      <button type="button" class="button" @click="dialog?.close()">{{ text.close }}</button>
    </header>
    <p class="look-muted">{{ text.onlyApp(appName) }}</p>

    <h3 id="app-look-presets">{{ text.presets }}</h3>
    <div class="presets" role="group" aria-labelledby="app-look-presets">
      <button
        v-for="name in LOOK_PRESETS"
        :key="name"
        type="button"
        class="preset"
        :aria-pressed="preset === name"
        :data-preset="name"
        @click="look = PRESET_LOOKS[name]"
      >
        <span class="swatch look-swatch" :style="PRESET_SWATCHES[name]" aria-hidden="true"><span>Aa</span></span>
        <span>{{ text.presetNames[name] }}<template v-if="name === 'cyberpunk'"> ({{ text.byDefault }})</template></span>
      </button>
      <button
        v-if="custom !== null && customSwatch !== null"
        type="button"
        class="preset"
        :aria-pressed="preset === null"
        data-preset="custom"
        @click="look = custom"
      >
        <span class="swatch look-swatch" :style="customSwatch" aria-hidden="true"><span>Aa</span></span>
        <span>{{ text.custom }}</span>
      </button>
    </div>

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

    <p class="contrast" :class="{ low: isTextLow || isBorderLow }" role="status">
      {{ text.contrast(number.format(contrasts.text), number.format(contrasts.accent)) }}
      <template v-if="contrasts.border !== null">{{ text.borderContrast(number.format(contrasts.border)) }}</template>
      <template v-if="isTextLow"><br>{{ text.lowContrast }}</template>
      <template v-if="isBorderLow"><br>{{ text.lowBorders }}</template>
    </p>

    <footer class="look-footer">
      <button type="button" class="button" :disabled="preset === 'cyberpunk'" @click="look = DEFAULT_APP_LOOK">{{ text.backToDefault }}</button>
      <button type="button" class="button primary" @click="dialog?.close()">{{ text.close }}</button>
    </footer>
  </dialog>
</template>

<style scoped>
.app-look {
  box-sizing: border-box;
  width: min(640px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 20px 24px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 10px;
  background: var(--look-ground);
  font: 15px/1.5 var(--look-font);
  color: var(--look-text);
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
  color: var(--look-accent);
}

h3 {
  margin: 20px 0 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--look-muted);
}

.look-muted {
  margin: 4px 0;
  color: var(--look-muted);
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
  border: var(--look-control-border);
  border-radius: 6px;
  background: var(--look-surface);
  font: inherit;
  color: var(--look-text);
  cursor: pointer;
}

.preset[aria-pressed='true'] {
  border-color: var(--look-focus);
  outline: 2px solid var(--look-focus);
  outline-offset: -1px;
  font-weight: 600;
}

/* The ground, as behind the screens (appLook.css), in the preset's own variables. */
.swatch {
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  width: 36px;
  height: 28px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 4px;
  font-family: var(--look-font);
  font-size: 14px;
  font-weight: 600;
  color: var(--look-text);
}

.swatch::before {
  border-radius: 3px;
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
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
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
  border: var(--look-control-border);
  border-radius: 4px;
  background: var(--look-surface);
  font: inherit;
  color: var(--look-text);
}

.contrast {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--look-soft);
}

.contrast.low {
  color: var(--look-warning);
}

.look-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.app-look :focus-visible {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}
</style>
