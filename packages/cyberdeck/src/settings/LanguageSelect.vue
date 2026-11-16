<script setup lang="ts">
import { LanguageSelect, useMessages } from '@cyberdeck/stage'
import { appMessages } from '../i18n/appMessages'
import { useLanguageChoice } from './languageChoice'

/** Cyberdeck's language, the system's or one the author picks, with its label. */
const choice = useLanguageChoice()
const text = useMessages(appMessages)
</script>

<template>
  <label class="language">
    <span>{{ text.language }}</span>
    <LanguageSelect v-model="choice" />
  </label>
</template>

<style scoped>
.language {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--look-soft);
}

/* The menu is the stage's, which keeps its own look in a game: here it wears the application's. */
.language :deep(.language-select) {
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  background: var(--look-surface);
  color: var(--look-text);
}

</style>
