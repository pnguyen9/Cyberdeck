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
  color: #a3acbb;
}

</style>
