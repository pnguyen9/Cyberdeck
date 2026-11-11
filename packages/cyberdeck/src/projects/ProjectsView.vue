<script setup lang="ts">
import { languageName, languagesOf, type ProjectDocument } from '@cyberdeck/core'
import { useLocale, useMessages, type ErasedData, type SaveStore } from '@cyberdeck/stage'
import { onMounted, ref, shallowRef } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { errorText } from '../i18n/errorMessages'
import { projectsMessages } from '../i18n/projectsMessages'
import LanguageSelect from '../settings/LanguageSelect.vue'
import { createNewProject, listProjects, restoreBackup } from './openProject'
import type { ProjectStore } from './projectStore'

const props = defineProps<{ store: ProjectStore; previewSaves: SaveStore }>()
const emit = defineEmits<{ open: [projectId: string] }>()

const projects = shallowRef<ProjectDocument[]>([])
const isLoaded = ref(false)
const newName = ref('')
const deletingId = ref<string | null>(null)
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
    // The language of the first text imported becomes the story's; until then, the editor's.
    const project = await createNewProject(props.store, newName.value, locale.value)
    emit('open', project.id)
  })
}

function restore(fileList: FileList | null) {
  const file = fileList?.[0]
  if (file === undefined) {
    return
  }
  return attempt(async () => {
    const restored = await restoreBackup(props.store, new Uint8Array(await file.arrayBuffer()))
    await refresh()
    message.value = restored.fromGame ? text.value.openedFromGame(restored.project.name, restored.chaptersLeftOut) : text.value.restored(restored.project.name)
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

/** The project whose previews' data the author is erasing, waiting to be told what. */
const erasingId = ref<string | null>(null)

function erasePreviewData(project: ProjectDocument, erased: ErasedData) {
  erasingId.value = null
  return attempt(async () => {
    await props.previewSaves.eraseGame(project.id, erased)
    message.value = text.value.previewDataErased(project.name, erased)
  })
}

/** Erasing what Cyberdeck keeps waits for the author to say what. */
const isConfirmingErase = ref(false)

function eraseAll(withProjects: boolean) {
  isConfirmingErase.value = false
  return attempt(async () => {
    await props.previewSaves.eraseAll()
    if (withProjects) {
      for (const project of projects.value) {
        await props.store.deleteProject(project.id)
      }
      await refresh()
    }
    message.value = withProjects ? text.value.everythingErased : text.value.previewsErased
  })
}

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
        <div v-else-if="erasingId === project.id" class="confirmation">
          <p>{{ text.confirmErasePreview(project.name) }}</p>
          <div class="actions">
            <button class="button danger" @click="erasePreviewData(project, { saves: false, progress: true })">{{ text.erasePreviewProgress }}</button>
            <button class="button danger" @click="erasePreviewData(project, { saves: true, progress: false })">{{ text.erasePreviewSaves }}</button>
            <button class="button danger" @click="erasePreviewData(project, { saves: true, progress: true })">{{ text.erasePreviewBoth }}</button>
            <button class="button" @click="erasingId = null">{{ common.cancel }}</button>
          </div>
        </div>
        <template v-else>
          <button class="open-project" @click="emit('open', project.id)">
            <span class="project-name">{{ project.name }}</span>
            <span class="muted">
              {{ common.chapterCount(project.chapterOrder.length) }}
              · {{ languagesOf(project).map(code => languageName(code, locale) ?? code).join(', ') }} · {{ text.changedOn(formatDate(project.updatedAt)) }}
            </span>
          </button>
          <button class="link-button" @click="erasingId = project.id; deletingId = null">{{ text.erasePreviewData }}</button>
          <button class="link-button" @click="deletingId = project.id; erasingId = null">{{ text.delete }}</button>
        </template>
      </li>
    </ul>

    <h2 class="section-title">{{ text.newProject }}</h2>
    <form class="new-project" @submit.prevent="create">
      <label class="field name">
        <span>{{ text.name }}</span>
        <input v-model="newName" class="text-input" autocomplete="off">
      </label>
      <button class="button primary" type="submit" :disabled="newName.trim() === ''">{{ text.create }}</button>
    </form>
    <p class="muted">{{ text.languageComesWithText }}</p>

    <h2 class="section-title">{{ text.backups }}</h2>
    <label class="button file-button">
      {{ text.restoreBackup }}
      <input type="file" accept=".zip,application/zip" @change="restore(($event.target as HTMLInputElement).files)">
    </label>
    <p class="muted">{{ text.backupReplaces }}</p>

    <section class="erase">
      <button v-if="!isConfirmingErase" class="link-button" @click="isConfirmingErase = true">{{ text.eraseAll }}</button>
      <div v-else class="confirmation">
        <p>{{ text.confirmErase }} {{ projectsFolder !== null ? text.confirmEraseFolders : text.confirmEraseBrowser }}</p>
        <div class="actions">
          <button class="button" @click="eraseAll(false)">{{ text.erasePreviews }}</button>
          <button class="button danger" :disabled="projects.length === 0" @click="eraseAll(true)">{{ text.eraseEverything }}</button>
          <button class="button" @click="isConfirmingErase = false">{{ common.cancel }}</button>
        </div>
      </div>
    </section>

    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
  </main>
</template>

<style scoped>
.confirmation p {
  margin: 0;
}

.erase {
  margin-top: 40px;
}

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
