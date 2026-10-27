<script setup lang="ts">
import { describeCondition, flattenStoredNodes, normalizeName, playsOf, type ChapterDocument } from '@cyberdeck/core'
import { computed, ref } from 'vue'
import { useEditor } from './editorContext'
import { safeFileName, usePreparedDownload } from './preparedDownload'

const emit = defineEmits<{ import: [] }>()
const { open, project, chapters, scenes, act, preview, openStoryboard } = useEditor()

const renaming = ref<{ id: string; title: string } | null>(null)
const removingId = ref<string | null>(null)
const textDownload = usePreparedDownload()
const textChapterId = ref<string | null>(null)

function exportChapterText(chapter: ChapterDocument) {
  textChapterId.value = chapter.id
  textDownload.offer(`${safeFileName(titleOf(chapter))}.txt`, open.exportText([chapter.id]))
}

const rows = computed(() => chapters.value.map((chapter, index) => ({
  chapter,
  index,
  pageCount: flattenStoredNodes(chapter.nodes).filter(node => node.type === 'page').length,
  onlyIf: chapter.condition === undefined ? null : describeCondition(chapter.condition, project.value),
  origin: chapter.importedFrom === undefined
    ? 'Written in Cyberdeck'
    : `Imported${chapter.importedFrom.fileName === null ? '' : ` from ${chapter.importedFrom.fileName}`} on ${formatDate(chapter.importedFrom.importedAt)}`,
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
    return 'A scene needs a name.'
  }
  return scenes.value.some(scene => scene.id !== target.id && normalizeName(scene.title ?? '') === normalizeName(target.title))
    ? 'Another scene already has this name.'
    : null
})

const titleOf = (chapter: ChapterDocument) => chapter.title ?? 'Untitled chapter'
const formatDate = (date: string) => new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' })

async function confirmRename() {
  const target = renaming.value
  if (target !== null && renameProblem.value === null && await act(() => open.renameChapter(target.id, target.title))) {
    renaming.value = null
  }
}

async function confirmRemove(chapter: ChapterDocument) {
  if (await act(() => open.removeChapter(chapter.id), `${titleOf(chapter)} was removed.`)) {
    removingId.value = null
  }
}
</script>

<template>
  <section>
    <p v-if="rows.length === 0" class="muted">
      No chapters yet. <button class="link-button" @click="emit('import')">Import a text</button> to create them.
    </p>
    <ol class="chapters">
      <li v-for="row in rows" :key="row.chapter.id" class="chapter">
        <span class="number">{{ row.index + 1 }}</span>
        <div class="body">
          <form v-if="renaming?.id === row.chapter.id" class="rename" @submit.prevent="confirmRename">
            <input v-model="renaming.title" class="text-input" aria-label="Chapter title" autocomplete="off">
            <button class="button primary small" type="submit">Rename</button>
            <button class="button small" type="button" @click="renaming = null">Cancel</button>
          </form>
          <template v-else>
            <span class="title">{{ titleOf(row.chapter) }}</span>
            <span class="muted details">{{ row.pageCount }} {{ row.pageCount === 1 ? 'page' : 'pages' }} · {{ row.origin }}</span>
            <span v-if="row.onlyIf !== null" class="only-if">Played only if {{ row.onlyIf }}</span>
          </template>

          <div v-if="removingId === row.chapter.id" class="confirmation">
            <p>Remove {{ titleOf(row.chapter) }}? The text you imported it from is not touched.</p>
            <div class="actions">
              <button class="button danger small" @click="confirmRemove(row.chapter)">Remove</button>
              <button class="button small" @click="removingId = null">Cancel</button>
            </div>
          </div>
          <p v-if="textChapterId === row.chapter.id && textDownload.prepared.value !== null" class="text-download">
            <a class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">Download {{ textDownload.prepared.value.fileName }}</a>
            <span class="muted"> · edit it, then import it with “Replace a chapter”.</span>
          </p>
          <div v-if="removingId !== row.chapter.id && renaming?.id !== row.chapter.id" class="actions">
            <button class="link-button" @click="openStoryboard(row.chapter.id)">Storyboard</button>
            <button class="link-button" @click="preview(row.chapter.id)">Preview from here ▶</button>
            <button class="link-button" :disabled="row.index === 0" @click="act(() => open.moveChapter(row.chapter.id, row.index - 1))">Move up</button>
            <button class="link-button" :disabled="row.index === rows.length - 1" @click="act(() => open.moveChapter(row.chapter.id, row.index + 1))">Move down</button>
            <button class="link-button" @click="exportChapterText(row.chapter)">Export as text</button>
            <button class="link-button" @click="renaming = { id: row.chapter.id, title: row.chapter.title ?? '' }">Rename</button>
            <button class="link-button" @click="removingId = row.chapter.id">Remove</button>
          </div>
        </div>
      </li>
    </ol>

    <template v-if="sceneRows.length > 0">
      <h3 class="scenes-heading">Scenes</h3>
      <p class="muted">Pages of no chapter, played wherever a <code>[play: …]</code> names them.</p>
      <ul class="chapters">
        <li v-for="row in sceneRows" :key="row.scene.id" class="chapter scene">
          <span class="number">▷</span>
          <div class="body">
            <form v-if="renaming?.id === row.scene.id" class="rename" @submit.prevent="confirmRename">
              <input v-model="renaming.title" class="text-input" aria-label="Scene name" autocomplete="off">
              <button class="button primary small" type="submit" :disabled="renameProblem !== null">Rename</button>
              <button class="button small" type="button" @click="renaming = null">Cancel</button>
              <span v-if="renameProblem !== null" class="error">{{ renameProblem }}</span>
            </form>
            <template v-else>
              <span class="title">{{ row.scene.title }}</span>
              <span class="muted details">
                {{ row.pageCount }} {{ row.pageCount === 1 ? 'page' : 'pages' }} ·
                {{ row.playedBy.length === 0 ? 'played nowhere yet' : `played by ${row.playedBy.join(', ')}` }}
              </span>
            </template>

            <div v-if="removingId === row.scene.id" class="confirmation">
              <p>Remove the scene {{ row.scene.title }}? The text you imported it from is not touched.</p>
              <p v-if="row.playedBy.length > 0" class="error">{{ row.playedBy.join(', ') }} {{ row.playedBy.length === 1 ? 'plays' : 'play' }} it: those plays would play nothing.</p>
              <div class="actions">
                <button class="button danger small" @click="confirmRemove(row.scene)">Remove</button>
                <button class="button small" @click="removingId = null">Cancel</button>
              </div>
            </div>
            <p v-if="textChapterId === row.scene.id && textDownload.prepared.value !== null" class="text-download">
              <a class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">Download {{ textDownload.prepared.value.fileName }}</a>
              <span class="muted"> · edit it, then import it: it replaces the scene of the same name.</span>
            </p>
            <div v-if="removingId !== row.scene.id && renaming?.id !== row.scene.id" class="actions">
              <button class="link-button" @click="openStoryboard(row.scene.id)">Storyboard</button>
              <button class="link-button" @click="exportChapterText(row.scene)">Export as text</button>
              <button class="link-button" @click="renaming = { id: row.scene.id, title: row.scene.title ?? '' }">Rename</button>
              <button class="link-button" @click="removingId = row.scene.id">Remove</button>
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
