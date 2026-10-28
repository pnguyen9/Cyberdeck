<script setup lang="ts">
import { docxToText, flattenNodes, normalizeName, previewImport, type ImportTarget } from '@cyberdeck/core'
import { createTextboxLayout, useLocale, useMessages } from '@cyberdeck/stage'
import { computed, onUnmounted, ref, watch } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { importMessages } from '../i18n/importMessages'
import { storyWords } from '../i18n/storyWords'
import { problemMessage } from '../importing/problemMessages'
import { SAMPLE_STORY } from '../importing/sampleStory'
import { useEditor } from './editorContext'

const emit = defineEmits<{ imported: [] }>()
const { open, project, chapters, scenes, act, importDraft, startEmptyDocument } = useEditor()
const locale = useLocale()
const text = useMessages(importMessages)
const common = useMessages(commonMessages)
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
/** Against every document, so that definitions are declared once; a chapter replaced may declare its own again. */
const previewOf = (text: string) => text.trim() === '' ? null : previewImport(text, project.value, layout, {
  scenes: scenes.value,
  documents: [...chapters.value, ...scenes.value],
  words: storyWords[locale.value],
  ...(target.value?.type === 'replaceChapter' ? { replacing: { documentId: target.value.chapterId } } : {}),
})
const preview = computed(() => previewOf(previewedText.value))
const summary = computed(() => {
  const result = preview.value?.result
  if (result === undefined) {
    return null
  }
  return {
    pageCount: [...result.chapters, ...result.scenes].flatMap(chapter => flattenNodes(chapter.nodes)).filter(node => node.type === 'page').length,
    titles: result.chapters.map(chapter => chapter.title ?? common.value.untitledChapter),
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
  }, isDocx ? text.value.shownAsText(file.name) : undefined)
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
    : chapters.value.find(chapter => chapter.id === currentTarget.chapterId)?.title ?? null
  const sceneNames = summary.value?.sceneNames ?? []
  const scenesPart = sceneNames.length === 0 ? '' : text.value.scenesPart(sceneNames.join(', '))
  const pageCount = summary.value?.pageCount ?? 0
  const messages: Record<Destination, string> = {
    newChapters: titles.length === 0
      ? text.value.importedScenes(sceneNames)
      : `${text.value.importedChapters(titles)}${scenesPart}`,
    endOfChapter: `${text.value.importedPages(pageCount, chapterTitle)}${scenesPart}`,
    replaceChapter: `${text.value.replacedChapter(chapterTitle, pageCount)}${scenesPart}`,
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
        {{ text.openDocument }}
        <input type="file" :accept="`.txt,.docx,text/plain,${DOCX_TYPE}`" @change="openFile(($event.target as HTMLInputElement).files)">
      </label>
      <button v-if="importDraft.text === ''" class="link-button" @click="importDraft = { text: SAMPLE_STORY, fileName: null }">{{ text.useSample }}</button>
      <button v-if="importDraft.text === ''" class="link-button" :title="text.startWithoutTextTitle" @click="startEmptyDocument('chapter')">{{ text.startWithoutText }}</button>
      <span v-if="importDraft.fileName !== null" class="muted">{{ importDraft.fileName }}</span>
    </div>
    <textarea
      v-model="importDraft.text"
      class="text-input source"
      spellcheck="false"
      :aria-label="text.textToImport"
      :placeholder="text.placeholder"
    />

    <div v-if="preview !== null" class="destination">
      <label class="field">
        <span>{{ text.importAs }}</span>
        <select class="text-input" :value="destination" @change="chosenDestination = ($event.target as HTMLSelectElement).value as Destination">
          <option value="newChapters">{{ text.newChapters }}</option>
          <option value="endOfChapter" :disabled="chapters.length === 0">{{ text.endOfChapter }}</option>
          <option value="replaceChapter" :disabled="chapters.length === 0">{{ text.replaceChapter }}</option>
        </select>
      </label>
      <label v-if="destination !== 'newChapters'" class="field">
        <span>{{ text.chapter }}</span>
        <select class="text-input" :value="targetChapterId ?? ''" @change="chosenChapterId = ($event.target as HTMLSelectElement).value">
          <option v-for="chapter in chapters" :key="chapter.id" :value="chapter.id">{{ chapter.title ?? common.untitledChapter }}</option>
        </select>
      </label>
    </div>

    <p v-if="summary !== null && destination === 'newChapters'" class="muted">
      {{ text.newChaptersSummary(summary.titles, summary.pageCount) }}
    </p>
    <p v-else-if="summary !== null && destination === 'replaceChapter'" class="muted">
      {{ text.replaceSummary(summary.pageCount) }}
    </p>
    <p v-else-if="summary !== null" class="muted">
      {{ text.endOfChapterSummary(summary.pageCount, summary.titles.length > 1) }}
    </p>

    <p v-if="summary !== null && summary.sceneNames.length > 0" class="muted">
      {{ text.scenesSummary(summary.sceneNames) }}
    </p>

    <ul v-if="preview !== null && preview.problems.length > 0" class="problems">
      <li v-for="(problem, index) in preview.problems" :key="index" :class="problem.severity">
        <strong>{{ text.line(problem.line) }}</strong> — {{ problemMessage(problem, locale) }}
      </li>
    </ul>

    <div class="import-actions">
      <button class="button primary" :disabled="!canImport" @click="runImport">{{ text.import }}</button>
      <span v-if="errorCount > 0" class="error">{{ text.errorsToFix(errorCount) }}</span>
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


p {
  margin: 0;
}
</style>
