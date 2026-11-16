<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMessages } from '../i18n/locale'
import { lookMessages } from '../i18n/lookMessages'
import { isHexColour } from './appLook'

/** A colour picked from the system's picker, or typed as `#rrggbb` for those who would rather use the keyboard. */
const colour = defineModel<string>({ required: true })
defineProps<{ label: string }>()
const text = useMessages(lookMessages)

const typed = ref(colour.value)
watch(colour, value => {
  typed.value = value
})
function onTyped(value: string) {
  typed.value = value
  const candidate = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`
  if (isHexColour(candidate)) {
    colour.value = candidate.toLowerCase()
  }
}
</script>

<template>
  <div class="colour-field">
    <label class="picker">
      <input type="color" :value="colour" @input="colour = ($event.target as HTMLInputElement).value">
      <span>{{ label }}</span>
    </label>
    <input
      class="hex"
      :value="typed"
      :aria-label="text.hexadecimal(label)"
      :aria-invalid="!isHexColour(typed.trim().startsWith('#') ? typed.trim() : `#${typed.trim()}`)"
      maxlength="7"
      spellcheck="false"
      autocomplete="off"
      @input="onTyped(($event.target as HTMLInputElement).value)"
      @blur="typed = colour"
    >
  </div>
</template>

<style scoped>
.colour-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

input[type='color'] {
  width: 36px;
  height: 28px;
  padding: 0;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.hex {
  width: 6.5em;
  padding: 3px 6px;
  border: var(--look-border-width, 1px) var(--look-border-style, solid) var(--look-border-colour, #2c3442);
  border-radius: 4px;
  background: var(--look-surface, #11151d);
  font: 14px ui-monospace, monospace;
  color: var(--look-text, #e6e9ef);
}

.hex[aria-invalid='true'] {
  outline: 2px solid var(--look-error, #f28b82);
}
</style>
