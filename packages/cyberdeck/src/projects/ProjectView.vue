<script setup lang="ts">
import type { PlayableStory, SaveData } from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, onMounted, shallowRef } from 'vue'
import { errorText } from '../i18n/errorMessages'
import { projectsMessages } from '../i18n/projectsMessages'
import { OpenProject } from './openProject'
import ProjectEditor from './ProjectEditor.vue'
import type { ProjectStore } from './projectStore'

const props = defineProps<{ store: ProjectStore; projectId: string }>()
const emit = defineEmits<{ close: []; preview: [story: PlayableStory, resumeFrom: SaveData | null] }>()

const open = shallowRef<OpenProject | null>(null)
const failure = shallowRef<{ error: unknown } | null>(null)
const locale = useLocale()
const text = useMessages(projectsMessages)
const errorMessage = computed(() => failure.value === null ? null : text.value.cannotOpen(errorText(failure.value.error, locale.value)))

onMounted(async () => {
  try {
    open.value = await OpenProject.open(props.store, props.projectId)
  } catch (error) {
    failure.value = { error }
  }
})
</script>

<template>
  <ProjectEditor v-if="open !== null" :open="open" @close="emit('close')" @preview="(story, resumeFrom) => emit('preview', story, resumeFrom)" />
  <main v-else-if="errorMessage !== null" class="editor-page">
    <button class="link-button" @click="emit('close')">{{ text.backToProjects }}</button>
    <p class="error" role="alert">{{ errorMessage }}</p>
  </main>
</template>
