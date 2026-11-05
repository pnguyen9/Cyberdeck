<script setup lang="ts">
import { useLocale } from '@cyberdeck/stage'
import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { languageChoices, languageLabel, languageOfPicked } from '../i18n/languageNames'

/**
 * A field to pick a language: it opens the whole list, which narrows as the author types a name, in
 * the editor's language or the language's own, or a code; a regional code (`pt-BR`) is taken typed in
 * full. A language is taken as soon as the text names one; Enter then goes to the form around it.
 */
const props = defineProps<{ modelValue: string; label: string; isFocused?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [code: string] }>()
const locale = useLocale()
const listId = useId()
const field = useTemplateRef<HTMLInputElement>('field')
const choices = computed(() => languageChoices(locale.value))
const typed = ref(languageLabel(props.modelValue, locale.value))
watch([() => props.modelValue, locale], ([code]) => {
  if (languageOfPicked(typed.value) !== code) {
    typed.value = languageLabel(code, locale.value)
  }
})
onMounted(() => {
  if (props.isFocused === true) {
    field.value?.focus()
  }
})

function onInput() {
  const code = languageOfPicked(typed.value)
  if (code !== null && code !== props.modelValue) {
    emit('update:modelValue', code)
  }
}

/** Leaving the field shows the language taken in full; text naming none goes back to it. */
function settle() {
  typed.value = languageLabel(props.modelValue, locale.value)
}
</script>

<template>
  <label class="field language-picker">
    <span>{{ label }}</span>
    <input
      ref="field"
      v-model="typed"
      class="text-input"
      :list="listId"
      autocomplete="off"
      spellcheck="false"
      @focus="($event.target as HTMLInputElement).select()"
      @input="onInput"
      @change="onInput(); settle()"
    >
    <datalist :id="listId">
      <option v-for="choice in choices" :key="choice.code" :value="choice.label" />
    </datalist>
  </label>
</template>
