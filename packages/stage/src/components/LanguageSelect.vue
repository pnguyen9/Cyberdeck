<script setup lang="ts">
import { languageMessages } from '../i18n/languageMessages'
import { LOCALE_NAMES, LOCALES, useMessages, type LanguageChoice } from '../i18n/locale'

/** The language of the screens: the system's, or one the player picks. Each language is named in its own words. */
const choice = defineModel<LanguageChoice>({ required: true })
const text = useMessages(languageMessages)
</script>

<template>
  <select v-model="choice" class="language-select">
    <option value="system">{{ text.system }}</option>
    <option v-for="locale in LOCALES" :key="locale" :value="locale" :lang="locale">{{ LOCALE_NAMES[locale] }}</option>
  </select>
</template>

<style scoped>
.language-select {
  padding: 0.25em 0.4em;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
}
</style>
