<script setup lang="ts">
import { definitionsOf, describeCondition, flattenStoredNodes, normalizeName, playsOf, type ChapterDocument } from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, ref } from 'vue'
import { chaptersMessages } from '../i18n/chaptersMessages'
import { commonMessages } from '../i18n/commonMessages'
import { useEditor } from './editorContext'
import { safeFileName, usePreparedDownload } from './preparedDownload'

const emit = defineEmits<{ import: [] }>()
const { open, project, chapters, scenes, act, preview, openStoryboard, startEmptyDocument } = useEditor()
const locale = useLocale()
const text = useMessages(chaptersMessages)
const common = useMessages(commonMessages)

const renaming = ref<{ id: string; title: string } | null>(null)
const removingId = ref<string | null>(null)
const textDownload = usePreparedDownload()
const textChapterId = ref<string | null>(null)

function exportChapterText(chapter: ChapterDocument) {
  textChapterId.value = chapter.id
  textDownload.offer(`${safeFileName(titleOf(chapter), locale.value)}.txt`, open.exportText([chapter.id]))
}

const rows = computed(() => chapters.value.map((chapter, index) => ({
  chapter,
  index,
  pageCount: flattenStoredNodes(chapter.nodes).filter(node => node.type === 'page').length,
  onlyIf: chapter.condition === undefined ? null : describeCondition(chapter.condition, project.value),
  origin: chapter.importedFrom === undefined
    ? text.value.writtenHere
    : text.value.importedFrom(chapter.importedFrom.fileName, formatDate(chapter.importedFrom.importedAt)),
})))

/** Scenes, with the chapters and scenes that play each: removing one leaves those plays with nothing to play. */
const sceneRows = computed(() => scenes.value.map(scene => ({
  scene,
  pageCount: flattenStoredNodes(scene.nodes).filter(node => node.type === 'page').length,
  playedBy: playsOf([...chapters.value, ...scenes.value], scene.id).map(titleOf),
})))
/** Scenes are played by name in texts: two of the same name could not be told apart. */
const renameProblem = computed(() => {
  const target = renaming.value
  if (target === null || !scenes.value.some(scene => scene.id === target.id)) {
    return null
  }
  if (target.title.trim() === '') {
    return text.value.sceneNeedsName
  }
  return scenes.value.some(scene => scene.id !== target.id && normalizeName(scene.title ?? '') === normalizeName(target.title))
    ? text.value.sceneNameTaken
    : null
})

const titleOf = (chapter: ChapterDocument) => chapter.title ?? common.value.untitledChapter
const formatDate = (date: string) => new Date(date).toLocaleDateString(locale.value, { dateStyle: 'medium' })

async function confirmRename() {
  const target = renaming.value
  if (target !== null && renameProblem.value === null && await act(() => open.renameChapter(target.id, target.title))) {
    renaming.value = null
  }
}

/** What a chapter declares stays declared, in the project's definitions. */
const movedDefinitions = (chapter: ChapterDocument) => definitionsOf(chapter, project.value)

async function confirmRemove(chapter: ChapterDocument) {
  const removedMessage = text.value.removed(titleOf(chapter), movedDefinitions(chapter))
  if (await act(() => open.removeChapter(chapter.id), removedMessage)) {
    removingId.value = null
  }
}
</script>

<template>
  <section>
    <p v-if="rows.length === 0" class="muted">
      {{ text.noChaptersBefore }} <button class="link-button" @click="emit('import')">{{ text.importText }}</button> {{ text.noChaptersAfter }}
      {{ text.orStartWithout }} <button class="link-button" @click="startEmptyDocument('chapter')">{{ text.newChapter }}</button>.
    </p>
    <ol class="chapters">
      <li v-for="row in rows" :key="row.chapter.id" class="chapter">
        <span class="number">{{ row.index + 1 }}</span>
        <div class="body">
          <form v-if="renaming?.id === row.chapter.id" class="rename" @submit.prevent="confirmRename">
            <input v-model="renaming.title" class="text-input" :aria-label="text.chapterTitle" autocomplete="off">
            <button class="button primary small" type="submit">{{ common.rename }}</button>
            <button class="button small" type="button" @click="renaming = null">{{ common.cancel }}</button>
          </form>
          <template v-else>
            <span class="title">{{ titleOf(row.chapter) }}</span>
            <span class="muted details">{{ common.pageCount(row.pageCount) }} · {{ row.origin }}</span>
            <span v-if="row.onlyIf !== null" class="only-if">{{ text.playedOnlyIf(row.onlyIf) }}</span>
          </template>

          <div v-if="removingId === row.chapter.id" class="confirmation">
            <p>{{ text.confirmRemoveChapter(titleOf(row.chapter)) }}</p>
            <p v-if="movedDefinitions(row.chapter).length > 0" class="muted">{{ text.declarationsMove(movedDefinitions(row.chapter).join(', ')) }}</p>
            <div class="actions">
              <button class="button danger small" @click="confirmRemove(row.chapter)">{{ common.remove }}</button>
              <button class="button small" @click="removingId = null">{{ common.cancel }}</button>
            </div>
          </div>
          <p v-if="textChapterId === row.chapter.id && textDownload.prepared.value !== null" class="text-download">
            <a class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">{{ common.download(textDownload.prepared.value.fileName) }}</a>
            <span class="muted"> {{ text.chapterTextHelp }}</span>
          </p>
          <div v-if="removingId !== row.chapter.id && renaming?.id !== row.chapter.id" class="actions">
            <button class="link-button" @click="openStoryboard(row.chapter.id)">{{ text.storyboard }}</button>
            <button class="link-button" @click="preview(row.chapter.id)">{{ text.previewFromHere }}</button>
            <button class="link-button" :disabled="row.index === 0" @click="act(() => open.moveChapter(row.chapter.id, row.index - 1))">{{ text.moveUp }}</button>
            <button class="link-button" :disabled="row.index === rows.length - 1" @click="act(() => open.moveChapter(row.chapter.id, row.index + 1))">{{ text.moveDown }}</button>
            <button class="link-button" @click="exportChapterText(row.chapter)">{{ text.exportAsText }}</button>
            <button class="link-button" @click="renaming = { id: row.chapter.id, title: row.chapter.title ?? '' }">{{ common.rename }}</button>
            <button class="link-button" @click="removingId = row.chapter.id">{{ common.remove }}</button>
          </div>
        </div>
      </li>
    </ol>
    <div v-if="rows.length > 0" class="add-actions">
      <button class="button small" @click="startEmptyDocument('chapter')">{{ text.newChapter }}</button>
      <button class="button small" @click="startEmptyDocument('scene')">{{ text.newScene }}</button>
    </div>

    <template v-if="sceneRows.length > 0">
      <h3 class="scenes-heading">{{ text.scenes }}</h3>
      <p class="muted">{{ text.scenesIntroBefore }} <code>[play: …]</code> {{ text.scenesIntroAfter }}</p>
      <ul class="chapters">
        <li v-for="row in sceneRows" :key="row.scene.id" class="chapter scene">
          <span class="number">▷</span>
          <div class="body">
            <form v-if="renaming?.id === row.scene.id" class="rename" @submit.prevent="confirmRename">
              <input v-model="renaming.title" class="text-input" :aria-label="text.sceneName" autocomplete="off">
              <button class="button primary small" type="submit" :disabled="renameProblem !== null">{{ common.rename }}</button>
              <button class="button small" type="button" @click="renaming = null">{{ common.cancel }}</button>
              <span v-if="renameProblem !== null" class="error">{{ renameProblem }}</span>
            </form>
            <template v-else>
              <span class="title">{{ row.scene.title }}</span>
              <span class="muted details">
                {{ common.pageCount(row.pageCount) }} ·
                {{ row.playedBy.length === 0 ? text.playedNowhere : text.playedBy(row.playedBy.join(', ')) }}
              </span>
            </template>

            <div v-if="removingId === row.scene.id" class="confirmation">
              <p>{{ text.confirmRemoveScene(row.scene.title ?? '') }}</p>
              <p v-if="movedDefinitions(row.scene).length > 0" class="muted">{{ text.declarationsMove(movedDefinitions(row.scene).join(', ')) }}</p>
              <p v-if="row.playedBy.length > 0" class="error">{{ text.scenePlayedBy(row.playedBy.join(', '), row.playedBy.length) }}</p>
              <div class="actions">
                <button class="button danger small" @click="confirmRemove(row.scene)">{{ common.remove }}</button>
                <button class="button small" @click="removingId = null">{{ common.cancel }}</button>
              </div>
            </div>
            <p v-if="textChapterId === row.scene.id && textDownload.prepared.value !== null" class="text-download">
              <a class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">{{ common.download(textDownload.prepared.value.fileName) }}</a>
              <span class="muted"> {{ text.sceneTextHelp }}</span>
            </p>
            <div v-if="removingId !== row.scene.id && renaming?.id !== row.scene.id" class="actions">
              <button class="link-button" @click="openStoryboard(row.scene.id)">{{ text.storyboard }}</button>
              <button class="link-button" @click="exportChapterText(row.scene)">{{ text.exportAsText }}</button>
              <button class="link-button" @click="renaming = { id: row.scene.id, title: row.scene.title ?? '' }">{{ common.rename }}</button>
              <button class="link-button" @click="removingId = row.scene.id">{{ common.remove }}</button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.only-if {
  font-size: 13px;
  color: #fbbf24;
}

.scenes-heading {
  margin: 24px 0 4px;
  font-size: 16px;
}

.add-actions {
  display: flex;
  gap: 8px;
  margin: 12px 0 0;
}

.chapters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chapter {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
}

.number {
  min-width: 1.5em;
  font-size: 20px;
  font-weight: 600;
  color: #7b8597;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.details {
  font-size: 14px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
}

.rename {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rename .text-input {
  width: auto;
  flex: 1 1 240px;
}

.confirmation p,
.text-download {
  margin: 8px 0 0;
}
</style>
