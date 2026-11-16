<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useMessages } from '../i18n/locale'
import { lookMessages } from '../i18n/lookMessages'
import { isHexColour } from './appLook'

/** A colour picked from the system's picker, or typed as `#rrggbb` for those who would rather use the keyboard. */
const colour = defineModel<string>({ required: true })
defineProps<{ label: string }>()
const text = useMessages(lookMessages)
const helpId = useId()

const typed = ref(colour.value)
watch(colour, value => {
  typed.value = value
})
/** What is typed, with its `#` added when left out. */
const candidate = computed(() => {
  const trimmed = typed.value.trim()
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
})
const isValid = computed(() => isHexColour(candidate.value))

function onTyped(value: string) {
  typed.value = value
  if (isValid.value) {
    colour.value = candidate.value.toLowerCase()
  }
}
</script>

<template>
  <div class="colour-field">
    <label class="picker">
      <input type="color" :value="colour" @input="colour = ($event.target as HTMLInputElement).value">
      <span>{{ label }}</span>
    </label>
    <label class="typed">
      <span class="format">{{ text.asHex }}</span>
      <input
        class="hex"
        :value="typed"
        :aria-label="text.hexadecimal(label)"
        :aria-invalid="!isValid"
        :aria-describedby="isValid ? undefined : helpId"
        maxlength="7"
        spellcheck="false"
        autocomplete="off"
        @input="onTyped(($event.target as HTMLInputElement).value)"
        @blur="typed = colour"
      >
    </label>
    <span v-if="!isValid" :id="helpId" class="invalid">{{ text.notHex }}</span>
  </div>
</template>

<style scoped>
.colour-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.picker,
.typed {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.format {
  font-size: 14px;
  color: var(--look-soft);
}

input[type='color'] {
  width: 36px;
  height: 28px;
  padding: 0;
  border: var(--look-control-border);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.hex {
  width: 6.5em;
  padding: 3px 6px;
  border: var(--look-control-border);
  border-radius: 4px;
  background: var(--look-surface);
  font: 14px ui-monospace, monospace;
  color: var(--look-text);
}

.hex[aria-invalid='true'] {
  outline: 2px solid var(--look-error);
}

.invalid {
  flex-basis: 100%;
  font-size: 14px;
  color: var(--look-error);
}
</style>
