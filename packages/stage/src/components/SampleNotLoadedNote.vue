<script setup lang="ts">
import { useAboutApp } from '../app/aboutApp'
import { aboutMessages } from '../i18n/aboutMessages'
import { useMessages } from '../i18n/locale'

/**
 * Why a sample's files could not be loaded, inside the shelf's report. A page kept by the service
 * worker may be an older release than the host's, which keeps only the latest release's samples: once
 * a new version is ready, the sample is said to come with it, with the reload beside.
 */
defineProps<{
  /** The sample's name. */
  sample: string
  /** What to say while no new version is ready: check the connection, or try again. */
  otherwise: string
}>()
const about = useAboutApp()
const text = useMessages(aboutMessages)
</script>

<template>
  <template v-if="about !== null && about.newVersion.value !== null">
    {{ text.sampleWithNewVersion(sample, about.name) }}
    <button class="button primary sample-reload" type="button" @click="about.newVersion.value?.()">{{ text.reload }}</button>
  </template>
  <template v-else>{{ otherwise }}</template>
</template>

<style scoped>
.sample-reload {
  display: block;
  margin-top: 8px;
}
</style>
