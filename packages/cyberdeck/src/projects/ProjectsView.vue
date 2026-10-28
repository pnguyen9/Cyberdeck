<script setup lang="ts">
import type { ProjectDocument } from '@cyberdeck/core'
import { LOCALE_NAMES, useLocale, useMessages } from '@cyberdeck/stage'
import { onMounted, ref, shallowRef } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { errorText } from '../i18n/errorMessages'
import { projectsMessages } from '../i18n/projectsMessages'
import LanguageSelect from '../settings/LanguageSelect.vue'
import { createNewProject, createProjectWithoutStory, listProjects, restoreBackup } from './openProject'
import type { ProjectStore } from './projectStore'

const props = defineProps<{ store: ProjectStore }>()
const emit = defineEmits<{ open: [projectId: string] }>()

const projects = shallowRef<ProjectDocument[]>([])
const isLoaded = ref(false)
const newName = ref('')
const newLocale = ref('en')
const deletingId = ref<string | null>(null)
/** The project being copied without its story, for a translation, with the name and language of the copy. */
const copying = ref<{ projectId: string; name: string; locale: string } | null>(null)
/** Where the projects are, on the desktop; null in the browser, which keeps them itself. */
const projectsFolder = ref<string | null>(null)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const locale = useLocale()
const text = useMessages(projectsMessages)
const common = useMessages(commonMessages)

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
      message.value = text.value.folderChanged(folder)
    }
  })
}

async function attempt(change: () => Promise<void>) {
  message.value = null
  errorMessage.value = null
  try {
    await change()
  } catch (error) {
    errorMessage.value = errorText(error, locale.value)
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
    message.value = text.value.restored(project.name)
  })
}

function startCopy(project: ProjectDocument) {
  deletingId.value = null
  copying.value = { projectId: project.id, name: project.name, locale: project.locale }
}

function copyWithoutStory(project: ProjectDocument) {
  const copy = copying.value
  if (copy === null) {
    return
  }
  return attempt(async () => {
    const created = await createProjectWithoutStory(props.store, project, copy.name, copy.locale)
    copying.value = null
    emit('open', created.id)
  })
}

function remove(project: ProjectDocument) {
  return attempt(async () => {
    await props.store.deleteProject(project.id)
    deletingId.value = null
    await refresh()
    message.value = text.value.deleted(project.name)
  })
}

/** The languages a story may be written in, each in its own words. */
const LANGUAGES: Record<string, string> = LOCALE_NAMES
const formatDate = (date: string) => new Date(date).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <main class="editor-page">
    <header class="page-header">
      <h1>Cyberdeck</h1>
      <LanguageSelect />
    </header>

    <h2 class="section-title">{{ text.projects }}</h2>
    <p v-if="projectsFolder !== null" class="muted folder">
      {{ text.folderBefore }} <code>{{ projectsFolder }}</code>{{ text.folderAfter }}
      <button class="link-button" @click="chooseFolder">{{ text.changeFolder }}</button>
    </p>
    <p v-if="isLoaded && projects.length === 0" class="muted">{{ text.noProject }}</p>
    <ul class="projects">
      <li v-for="project in projects" :key="project.id" class="project">
        <div v-if="deletingId === project.id" class="confirmation">
          <p v-if="projectsFolder !== null">{{ text.confirmDeleteFolder(project.name) }}</p>
          <p v-else>{{ text.confirmDelete(project.name) }}</p>
          <div class="actions">
            <button class="button danger" @click="remove(project)">{{ text.delete }}</button>
            <button class="button" @click="deletingId = null">{{ common.cancel }}</button>
          </div>
        </div>
        <form v-else-if="copying?.projectId === project.id" class="copy" @submit.prevent="copyWithoutStory(project)">
          <p class="muted">{{ text.copyHelp(project.name) }}</p>
          <div class="new-project">
            <label class="field name">
              <span>{{ text.name }}</span>
              <input v-model="copying.name" class="text-input" autocomplete="off">
            </label>
            <label class="field">
              <span>{{ text.storyLanguage }}</span>
              <select v-model="copying.locale" class="text-input">
                <option v-for="(label, code) in LANGUAGES" :key="code" :value="code">{{ label }}</option>
              </select>
            </label>
            <button class="button primary" type="submit" :disabled="copying.name.trim() === ''">{{ text.create }}</button>
            <button class="button" type="button" @click="copying = null">{{ common.cancel }}</button>
          </div>
        </form>
        <template v-else>
          <button class="open-project" @click="emit('open', project.id)">
            <span class="project-name">{{ project.name }}</span>
            <span class="muted">
              {{ common.chapterCount(project.chapterOrder.length) }}
              · {{ LANGUAGES[project.locale] ?? project.locale }} · {{ text.changedOn(formatDate(project.updatedAt)) }}
            </span>
          </button>
          <button class="link-button" @click="startCopy(project)">{{ text.copyWithoutStory }}</button>
          <button class="link-button" @click="deletingId = project.id; copying = null">{{ text.delete }}</button>
        </template>
      </li>
    </ul>

    <h2 class="section-title">{{ text.newProject }}</h2>
    <form class="new-project" @submit.prevent="create">
      <label class="field name">
        <span>{{ text.name }}</span>
        <input v-model="newName" class="text-input" autocomplete="off">
      </label>
      <label class="field">
        <span>{{ text.storyLanguage }}</span>
        <select v-model="newLocale" class="text-input">
          <option v-for="(label, code) in LANGUAGES" :key="code" :value="code">{{ label }}</option>
        </select>
      </label>
      <button class="button primary" type="submit" :disabled="newName.trim() === ''">{{ text.create }}</button>
    </form>

    <h2 class="section-title">{{ text.backups }}</h2>
    <label class="button file-button">
      {{ text.restoreBackup }}
      <input type="file" accept=".zip,application/zip" @change="restore(($event.target as HTMLInputElement).files)">
    </label>
    <p class="muted">{{ text.backupReplaces }}</p>

    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
  </main>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 12px 24px;
}

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

.copy {
  flex: 1;
  display: grid;
  gap: 10px;
}

.copy p,
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
