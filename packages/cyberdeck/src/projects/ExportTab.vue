<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditor } from './editorContext'
import { formatSize, safeFileName, usePreparedDownload } from './preparedDownload'

const { open, project, chapters, scenes, act } = useEditor()
const release = ref('1.0')
const excludedChapterIds = ref<string[]>([])
const download = usePreparedDownload()
const textDownload = usePreparedDownload()

const included = computed(() => chapters.value.filter(chapter => !excludedChapterIds.value.includes(chapter.id)))
const canExport = computed(() => included.value.length > 0 && release.value.trim() !== '')

function setIncluded(chapterId: string, isIncluded: boolean) {
  const others = excludedChapterIds.value.filter(excluded => excluded !== chapterId)
  excludedChapterIds.value = isIncluded ? others : [...others, chapterId]
  download.forget()
}

function exportStoryText() {
  textDownload.offer(`${safeFileName(project.value.name)}.txt`, open.exportText(null))
}

function exportGame() {
  const releaseLabel = release.value.trim()
  const wholeGame = included.value.length === chapters.value.length
  const suffix = wholeGame ? '' : ` - ${included.value.map(chapter => chapter.title ?? 'Untitled').join(', ')}`
  return act(async () => {
    const bytes = await open.exportGame(releaseLabel, included.value.map(chapter => chapter.id), new Date())
    download.offer(`${safeFileName(`${project.value.name} ${releaseLabel}${suffix}`)}.zip`, bytes)
  })
}
</script>

<template>
  <section class="export">
    <p class="muted">
      The archive players add to Datajack. Export the whole game, or only some chapters for an update:
      each archive carries the files its chapters use, the cover and the details.
    </p>
    <label class="field release">
      <span>Release, as players will see it</span>
      <input v-model="release" class="text-input" maxlength="40" @input="download.forget()">
    </label>
    <fieldset class="chapters">
      <legend>Chapters</legend>
      <p v-if="chapters.length === 0" class="muted">No chapters yet.</p>
      <label v-for="chapter in chapters" :key="chapter.id" class="chapter">
        <input type="checkbox" :checked="!excludedChapterIds.includes(chapter.id)" @change="setIncluded(chapter.id, ($event.target as HTMLInputElement).checked)">
        {{ chapter.title ?? 'Untitled chapter' }}
      </label>
      <p v-if="scenes.length > 0" class="muted">
        Every archive carries the {{ scenes.length === 1 ? 'scene' : `${scenes.length} scenes` }} too ({{ scenes.map(scene => scene.title).join(', ') }}): any chapter may play them.
      </p>
    </fieldset>
    <div class="actions">
      <button class="button primary" :disabled="!canExport" @click="exportGame">Export</button>
      <a v-if="download.prepared.value !== null" class="download" :href="download.prepared.value.url" :download="download.prepared.value.fileName">
        Download {{ download.prepared.value.fileName }} <span class="muted">({{ formatSize(download.prepared.value.byteSize) }})</span>
      </a>
    </div>

    <h2 class="section-title">As text</h2>
    <p class="muted">
      The story in the syntax it was written in, with every change made here: to edit it in Word or
      any text editor, then import it again, as a new project or chapter by chapter.
    </p>
    <div class="actions">
      <button class="button" :disabled="chapters.length === 0" @click="exportStoryText">Export the story as text</button>
      <a v-if="textDownload.prepared.value !== null" class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">
        Download {{ textDownload.prepared.value.fileName }}
      </a>
    </div>
  </section>
</template>

<style scoped>
.export {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}

.release {
  max-width: 240px;
}

.chapters {
  margin: 0;
  padding: 8px 16px 12px;
  border: 1px solid #2c3442;
  border-radius: 8px;
}

legend {
  padding: 0 4px;
  font-size: 14px;
  color: #a3acbb;
}

.chapter {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 2px 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

p {
  margin: 0;
}
</style>
