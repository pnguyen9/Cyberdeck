<script setup lang="ts">
import type { PlayableStory, SaveData } from '@cyberdeck/core'
import { onMounted, shallowRef } from 'vue'
import { OpenProject } from './openProject'
import ProjectEditor from './ProjectEditor.vue'
import type { ProjectStore } from './projectStore'

const props = defineProps<{ store: ProjectStore; projectId: string }>()
const emit = defineEmits<{ close: []; preview: [story: PlayableStory, resumeFrom: SaveData | null] }>()

const open = shallowRef<OpenProject | null>(null)
const errorMessage = shallowRef<string | null>(null)

onMounted(async () => {
  try {
    open.value = await OpenProject.open(props.store, props.projectId)
  } catch (error) {
    errorMessage.value = `This project cannot be opened: ${error instanceof Error ? error.message : String(error)}`
  }
})
</script>

<template>
  <ProjectEditor v-if="open !== null" :open="open" @close="emit('close')" @preview="(story, resumeFrom) => emit('preview', story, resumeFrom)" />
  <main v-else-if="errorMessage !== null" class="editor-page">
    <button class="link-button" @click="emit('close')">← Projects</button>
    <p class="error" role="alert">{{ errorMessage }}</p>
  </main>
</template>
