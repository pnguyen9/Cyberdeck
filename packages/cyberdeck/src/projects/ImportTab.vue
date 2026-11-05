<script setup lang="ts">
import { docxToText, flattenNodes, languageCode, languageName as languageName_, languagesOf, normalizeName, previewImport, type ImportTarget } from '@cyberdeck/core'
import { createTextboxLayout, useLocale, useMessages } from '@cyberdeck/stage'
import { computed, onUnmounted, ref, watch } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { importMessages } from '../i18n/importMessages'
import { languageLabel } from '../i18n/languageNames'
import { storyWords } from '../i18n/storyWords'
import { problemMessage } from '../importing/problemMessages'
import { SAMPLE_STORY } from '../importing/sampleStory'
import { useEditor } from './editorContext'
import LanguagePicker from './LanguagePicker.vue'

const emit = defineEmits<{ imported: [] }>()
const { open, project, chapters, documents, language, act, importDraft, startEmptyDocument } = useEditor()
const locale = useLocale()
const text = useMessages(importMessages)
const common = useMessages(commonMessages)
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const layout = createTextboxLayout()
type Destination = ImportTarget['type']

/** Null follows what the text declares: `[import: pages]` goes at the end of a chapter, `[import: chapter]` titled like one replaces it. */
const chosenDestination = ref<Destination | null>(null)
const chosenChapterId = ref<string | null>(null)

/** Read from the text's first lines, before the import proper: its kind, its language, its first title. */
const declared = computed(() => {
  const text = importDraft.value.text
  const importLine = /^\s*\[import:\s*(\w+)(?:\s+([A-Za-z0-9-]+))?\s*\]/i.exec(text)
  return {
    kind: importLine?.[1]?.toLowerCase() ?? null,
    language: importLine?.[2] === undefined ? null : languageCode(importLine[2]),
    title: /^#+[ \t]*(.*)$/m.exec(text)?.[1]?.trim() ?? null,
  }
})

/** The language of the text: the one it says, else the one picked, else the one shown. */
const textLanguage = ref(language.value)
watch(language, shown => {
  textLanguage.value = shown
})
const importLanguage = computed(() => declared.value.language ?? textLanguage.value)
/** The story's chapters and scenes in that language, which the text is laid over, hollow where it has none yet. */
const inLanguage = computed(() => {
  void documents.value
  return open.documentsIn(importLanguage.value)
})
const chaptersInLanguage = computed(() => inLanguage.value.filter(document => project.value.chapterOrder.includes(document.id)))
const scenesInLanguage = computed(() => inLanguage.value.filter(document => project.value.sceneOrder.includes(document.id)))
const languageName = (code: string) => languageName_(code, locale.value) ?? code

const chapterOfSameTitle = computed(() => declared.value.title === null
  ? undefined
  : chaptersInLanguage.value.find(chapter => chapter.hollow !== true && chapter.title !== null && normalizeName(chapter.title) === normalizeName(declared.value.title!)))
const destination = computed((): Destination => {
  if (chosenDestination.value !== null) {
    return chosenDestination.value
  }
  if (declared.value.kind === 'pages' && chaptersInLanguage.value.length > 0) {
    return 'endOfChapter'
  }
  return declared.value.kind === 'chapter' && chapterOfSameTitle.value !== undefined ? 'replaceChapter' : 'newChapters'
})
const targetChapterId = computed(() => chosenChapterId.value
  ?? (destination.value === 'replaceChapter' ? chapterOfSameTitle.value?.id : undefined)
  ?? chaptersInLanguage.value.at(-1)?.id
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
  language: importLanguage.value,
  scenes: scenesInLanguage.value,
  documents: inLanguage.value,
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
/**
 * Where new chapters go in the language of the text, said before importing: over the story's chapters
 * by place for a whole translation, in the places it has no text for yet, or after the chapters it has.
 */
const placesTaken = computed(() => {
  const titles = summary.value?.titles ?? []
  if (destination.value !== 'newChapters' || titles.length === 0) {
    return null
  }
  const name = languageName(importLanguage.value)
  const isFirst = importLanguage.value === languagesOf(project.value)[0]
  if (declared.value.kind === 'story' && !isFirst && chaptersInLanguage.value.length > 0) {
    return text.value.laidOverByPlace(name)
  }
  const hollow = chaptersInLanguage.value.filter(chapter => chapter.hollow === true).slice(0, titles.length)
  if (hollow.length > 0) {
    return text.value.takesPlacesOf(hollow.map(chapter => chapter.title ?? common.value.untitledChapter), name)
  }
  const written = chaptersInLanguage.value.length
  return written > 0 ? text.value.comesAfter(written, name) : null
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
    : chaptersInLanguage.value.find(chapter => chapter.id === currentTarget.chapterId)?.title ?? null
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
  // Imported in another language than the one shown, the story is shown in it: the message says so.
  const shownNow = currentPreview.language === language.value ? '' : text.value.nowShownIn(languageName(currentPreview.language))
  const succeeded = await act(() => open.importText(currentPreview, currentTarget, importDraft.value.fileName), `${messages[currentTarget.type]}${shownNow}`)
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
      <LanguagePicker v-if="preview.result.language === null" v-model="textLanguage" :label="text.textLanguage" />
      <p v-else class="field said-language">
        <span>{{ text.textLanguage }}</span>
        <span>{{ languageLabel(preview.language, locale) }} <span class="muted">· {{ text.languageSaid }}</span></span>
      </p>
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
          <option v-for="chapter in chaptersInLanguage" :key="chapter.id" :value="chapter.id">{{ chapter.title ?? common.untitledChapter }}</option>
        </select>
      </label>
    </div>

    <p v-if="summary !== null && destination === 'newChapters'" class="muted">
      {{ text.newChaptersSummary(summary.titles, summary.pageCount) }}
      <template v-if="placesTaken !== null"> {{ placesTaken }}</template>
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
