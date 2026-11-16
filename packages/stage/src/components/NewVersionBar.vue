<script setup lang="ts">
import { useAboutApp } from '../app/aboutApp'
import { aboutMessages } from '../i18n/aboutMessages'
import { useMessages } from '../i18n/locale'

/**
 * At the top of an application's first screen, in the page's flow (it covers nothing, and comes
 * first to the keyboard): the offer to reload into a new version once one is online.
 */
const about = useAboutApp()
const text = useMessages(aboutMessages)
</script>

<template>
  <div v-if="about !== null && about.newVersion.value !== null && !about.isNewVersionPutOff.value" class="new-version" role="status">
    <span>{{ text.newVersion(about.name) }}</span>
    <span class="new-version-buttons">
      <button class="button primary" type="button" @click="about.newVersion.value?.()">{{ text.reload }}</button>
      <button class="button" type="button" @click="about.isNewVersionPutOff.value = true">{{ text.later }}</button>
    </span>
  </div>
</template>

<style scoped>
.new-version {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin: 0 0 24px;
  padding: 10px 16px;
  border: 2px solid var(--look-accent);
  border-radius: 8px;
  background: var(--look-ground);
  font-size: 16px;
  color: var(--look-text);
}

.new-version-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
