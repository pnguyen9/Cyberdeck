<script setup lang="ts">
import type { ProjectDocument } from '@cyberdeck/core'
import { onMounted, ref, shallowRef } from 'vue'
import { createNewProject, listProjects, restoreBackup } from './openProject'
import type { ProjectStore } from './projectStore'

const props = defineProps<{ store: ProjectStore }>()
const emit = defineEmits<{ open: [projectId: string] }>()

const projects = shallowRef<ProjectDocument[]>([])
const isLoaded = ref(false)
const newName = ref('')
const newLocale = ref('en')
const deletingId = ref<string | null>(null)
/** Where the projects are, on the desktop; null in the browser, which keeps them itself. */
const projectsFolder = ref<string | null>(null)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(refresh)

async function refresh() {
  projects.value = await listProjects(props.store)
  projectsFolder.value = await props.store.folder?.current() ?? null
  isLoaded.value = true
}

function chooseFolder() {
  return attempt(async () => {
    const folder = await props.store.folder?.choose()
    if (folder != null) {
      await refresh()
      message.value = `Projects are now kept in ${folder}.`
    }
  })
}

async function attempt(change: () => Promise<void>) {
  message.value = null
  errorMessage.value = null
  try {
    await change()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

function create() {
  return attempt(async () => {
    const project = await createNewProject(props.store, newName.value, newLocale.value)
    emit('open', project.id)
  })
}

function restore(fileList: FileList | null) {
  const file = fileList?.[0]
  if (file === undefined) {
    return
  }
  return attempt(async () => {
    const project = await restoreBackup(props.store, new Uint8Array(await file.arrayBuffer()))
    await refresh()
    message.value = `${project.name} was restored.`
  })
}

function remove(project: ProjectDocument) {
  return attempt(async () => {
    await props.store.deleteProject(project.id)
    deletingId.value = null
    await refresh()
    message.value = `${project.name} was deleted.`
  })
}

const LANGUAGES: Record<string, string> = { en: 'English', fr: 'Français' }
const formatDate = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <main class="editor-page">
    <h1>Cyberdeck</h1>

    <h2 class="section-title">Projects</h2>
    <p v-if="projectsFolder !== null" class="muted folder">
      In <code>{{ projectsFolder }}</code>, a folder per project.
      <button class="link-button" @click="chooseFolder">Change…</button>
    </p>
    <p v-if="isLoaded && projects.length === 0" class="muted">No project yet: create one below, then import its text.</p>
    <ul class="projects">
      <li v-for="project in projects" :key="project.id" class="project">
        <div v-if="deletingId === project.id" class="confirmation">
          <p v-if="projectsFolder !== null">Delete {{ project.name }}? Its folder goes to the trash, from where it can be brought back.</p>
          <p v-else>Delete {{ project.name }}, its chapters and its files? Download a backup first if you may want it back.</p>
          <div class="actions">
            <button class="button danger" @click="remove(project)">Delete</button>
            <button class="button" @click="deletingId = null">Cancel</button>
          </div>
        </div>
        <template v-else>
          <button class="open-project" @click="emit('open', project.id)">
            <span class="project-name">{{ project.name }}</span>
            <span class="muted">
              {{ project.chapterOrder.length }} {{ project.chapterOrder.length === 1 ? 'chapter' : 'chapters' }}
              · {{ LANGUAGES[project.locale] ?? project.locale }} · changed {{ formatDate(project.updatedAt) }}
            </span>
          </button>
          <button class="link-button" @click="deletingId = project.id">Delete</button>
        </template>
      </li>
    </ul>

    <h2 class="section-title">New project</h2>
    <form class="new-project" @submit.prevent="create">
      <label class="field name">
        <span>Name</span>
        <input v-model="newName" class="text-input" autocomplete="off">
      </label>
      <label class="field">
        <span>Language of the story</span>
        <select v-model="newLocale" class="text-input">
          <option v-for="(label, code) in LANGUAGES" :key="code" :value="code">{{ label }}</option>
        </select>
      </label>
      <button class="button primary" type="submit" :disabled="newName.trim() === ''">Create</button>
    </form>

    <h2 class="section-title">Backups</h2>
    <label class="button file-button">
      Restore a backup…
      <input type="file" accept=".zip,application/zip" @change="restore(($event.target as HTMLInputElement).files)">
    </label>
    <p class="muted">A backup replaces the project of the same identifier, if this browser has it.</p>

    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
  </main>
</template>

<style scoped>
.projects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.project {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
}

.open-project {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
}

.open-project:hover .project-name,
.open-project:focus-visible .project-name {
  color: #9eeaff;
}

.confirmation p {
  margin: 0;
}

.folder {
  margin: 0 0 12px;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.new-project {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}

.new-project .name {
  flex: 1 1 260px;
}
</style>
