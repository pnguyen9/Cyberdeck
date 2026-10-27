<script setup lang="ts">
import { docxToText, flattenNodes, normalizeName, previewImport, type ImportTarget } from '@cyberdeck/core'
import { createTextboxLayout } from '@cyberdeck/stage'
import { computed, onUnmounted, ref, watch } from 'vue'
import { problemMessage } from '../importing/problemMessages'
import { SAMPLE_STORY } from '../importing/sampleStory'
import { useEditor } from './editorContext'

const emit = defineEmits<{ imported: [] }>()
const { open, project, chapters, scenes, act, importDraft } = useEditor()
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const layout = createTextboxLayout()
type Destination = ImportTarget['type']

/** Null follows what the text declares: `[import: pages]` goes at the end of a chapter, `[import: chapter]` titled like one replaces it. */
const chosenDestination = ref<Destination | null>(null)
const chosenChapterId = ref<string | null>(null)

/** Read from the text's first lines, before the import proper. */
const declared = computed(() => {
  const text = importDraft.value.text
  return {
    kind: /^\s*\[import:\s*(\w+)\s*\]/i.exec(text)?.[1]?.toLowerCase() ?? null,
    title: /^#+[ \t]*(.*)$/m.exec(text)?.[1]?.trim() ?? null,
  }
})
const chapterOfSameTitle = computed(() => declared.value.title === null
  ? undefined
  : chapters.value.find(chapter => chapter.title !== null && normalizeName(chapter.title) === normalizeName(declared.value.title!)))
const destination = computed((): Destination => {
  if (chosenDestination.value !== null) {
    return chosenDestination.value
  }
  if (declared.value.kind === 'pages' && chapters.value.length > 0) {
    return 'endOfChapter'
  }
  return declared.value.kind === 'chapter' && chapterOfSameTitle.value !== undefined ? 'replaceChapter' : 'newChapters'
})
const targetChapterId = computed(() => chosenChapterId.value
  ?? (destination.value === 'replaceChapter' ? chapterOfSameTitle.value?.id : undefined)
  ?? chapters.value.at(-1)?.id
  ?? null)
const target = computed((): ImportTarget | null => {
  if (destination.value === 'newChapters') {
    return { type: 'newChapters' }
  }
  return targetChapterId.value === null ? null : { type: destination.value, chapterId: targetChapterId.value }
})
/**
 * The text previewed: it follows the draft once typing pauses, a whole novel taking a moment to
 * read again. Importing always reads the draft as it is.
 */
const PREVIEW_DELAY_MILLISECONDS = 250
const previewedText = ref(importDraft.value.text)
let previewTimer: ReturnType<typeof setTimeout> | undefined
watch(() => importDraft.value.text, text => {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewedText.value = text
  }, PREVIEW_DELAY_MILLISECONDS)
})
onUnmounted(() => clearTimeout(previewTimer))
const previewOf = (text: string) => text.trim() === '' ? null : previewImport(text, project.value, layout, { scenes: scenes.value })
const preview = computed(() => previewOf(previewedText.value))
const summary = computed(() => {
  const result = preview.value?.result
  if (result === undefined) {
    return null
  }
  return {
    pageCount: [...result.chapters, ...result.scenes].flatMap(chapter => flattenNodes(chapter.nodes)).filter(node => node.type === 'page').length,
    titles: result.chapters.map(chapter => chapter.title ?? 'Untitled chapter'),
    /** Scenes go in whatever the destination; one named like a scene of the project replaces it. */
    sceneNames: result.scenes.map(scene => scene.title ?? ''),
  }
})
const errorCount = computed(() => preview.value?.problems.filter(problem => problem.severity === 'error').length ?? 0)
const canImport = computed(() => preview.value !== null && !preview.value.hasErrors && target.value !== null && (summary.value?.pageCount ?? 0) > 0)

/** A Word document is shown as the text it gives, to be checked before importing. */
async function openFile(fileList: FileList | null) {
  const file = fileList?.[0]
  if (file === undefined) {
    return
  }
  const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type === DOCX_TYPE
  await act(async () => {
    const text = isDocx ? await docxToText(new Uint8Array(await file.arrayBuffer())) : await file.text()
    importDraft.value = { text, fileName: file.name }
  }, isDocx ? `${file.name} is shown as text: check it, then import it.` : undefined)
}

async function runImport() {
  const currentPreview = previewedText.value === importDraft.value.text ? preview.value : previewOf(importDraft.value.text)
  const currentTarget = target.value
  if (currentPreview === null || currentTarget === null) {
    return
  }
  const titles = summary.value?.titles ?? []
  const chapterTitle = currentTarget.type === 'newChapters'
    ? null
    : chapters.value.find(chapter => chapter.id === currentTarget.chapterId)?.title ?? 'the chapter'
  const sceneNames = summary.value?.sceneNames ?? []
  const scenesPart = sceneNames.length === 0 ? '' : ` Scenes: ${sceneNames.join(', ')}.`
  const messages: Record<Destination, string> = {
    newChapters: titles.length === 0
      ? `Imported ${sceneNames.length === 1 ? 'the scene' : 'the scenes'} ${sceneNames.join(', ')}.`
      : `Imported ${titles.length === 1 ? `1 chapter: ${titles[0]}` : `${titles.length} chapters: ${titles.join(', ')}`}.${scenesPart}`,
    endOfChapter: `Imported ${summary.value?.pageCount} pages at the end of ${chapterTitle}.${scenesPart}`,
    replaceChapter: `${chapterTitle} was replaced by the text imported: ${summary.value?.pageCount} pages.${scenesPart}`,
  }
  const succeeded = await act(() => open.importText(currentPreview, currentTarget, importDraft.value.fileName), messages[currentTarget.type])
  if (succeeded) {
    importDraft.value = { text: '', fileName: null }
    chosenDestination.value = null
    chosenChapterId.value = null
    emit('imported')
  }
}

</script>

<template>
  <section class="import">
    <div class="toolbar">
      <label class="button file-button">
        Open a document…
        <input type="file" :accept="`.txt,.docx,text/plain,${DOCX_TYPE}`" @change="openFile(($event.target as HTMLInputElement).files)">
      </label>
      <button v-if="importDraft.text === ''" class="link-button" @click="importDraft = { text: SAMPLE_STORY, fileName: null }">Use the sample story</button>
      <span v-if="importDraft.fileName !== null" class="muted">{{ importDraft.fileName }}</span>
    </div>
    <textarea
      v-model="importDraft.text"
      class="text-input source"
      spellcheck="false"
      aria-label="Text to import"
      placeholder="Paste the text of a chapter or of the whole story. A paragraph is narration; “Name:” or a dash starts dialogue; [directives] set the stage."
    />

    <div v-if="preview !== null" class="destination">
      <label class="field">
        <span>Import as</span>
        <select class="text-input" :value="destination" @change="chosenDestination = ($event.target as HTMLSelectElement).value as Destination">
          <option value="newChapters">New chapters</option>
          <option value="endOfChapter" :disabled="chapters.length === 0">Pages at the end of a chapter</option>
          <option value="replaceChapter" :disabled="chapters.length === 0">In place of a chapter</option>
        </select>
      </label>
      <label v-if="destination !== 'newChapters'" class="field">
        <span>Chapter</span>
        <select class="text-input" :value="targetChapterId ?? ''" @change="chosenChapterId = ($event.target as HTMLSelectElement).value">
          <option v-for="chapter in chapters" :key="chapter.id" :value="chapter.id">{{ chapter.title ?? 'Untitled chapter' }}</option>
        </select>
      </label>
    </div>

    <p v-if="summary !== null && destination === 'newChapters'" class="muted">
      <template v-if="summary.titles.length > 0">{{ summary.titles.length }} {{ summary.titles.length === 1 ? 'chapter' : 'chapters' }} ({{ summary.titles.join(', ') }}), </template>{{ summary.pageCount }} pages.
    </p>
    <p v-else-if="summary !== null && destination === 'replaceChapter'" class="muted">
      {{ summary.pageCount }} pages, in place of the chapter chosen.
    </p>
    <p v-else-if="summary !== null" class="muted">
      {{ summary.pageCount }} pages<template v-if="summary.titles.length > 1">; chapter headings are dropped</template>.
    </p>

    <p v-if="summary !== null && summary.sceneNames.length > 0" class="muted">
      {{ summary.sceneNames.length === 1 ? 'Scene' : 'Scenes' }}: {{ summary.sceneNames.join(', ') }}. A scene named like one of the project replaces it.
    </p>

    <ul v-if="preview !== null && preview.problems.length > 0" class="problems">
      <li v-for="(problem, index) in preview.problems" :key="index" :class="problem.severity">
        <strong>Line {{ problem.line }}</strong> — {{ problemMessage(problem) }}
      </li>
    </ul>

    <div class="import-actions">
      <button class="button primary" :disabled="!canImport" @click="runImport">Import</button>
      <span v-if="errorCount > 0" class="error">{{ errorCount }} {{ errorCount === 1 ? 'error' : 'errors' }} to fix first.</span>
    </div>
  </section>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar,
.destination,
.import-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.destination .field {
  min-width: 220px;
}

.source {
  min-height: 420px;
  font: 15px/1.6 ui-monospace, monospace;
}

.problems {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
  list-style: none;
}

.problems .error {
  color: #f28b82;
}

.problems .warning {
  color: #f6c177;
}

p {
  margin: 0;
}
</style>
