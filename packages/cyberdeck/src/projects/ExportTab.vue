<script setup lang="ts">
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, ref } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { detailsMessages } from '../i18n/detailsMessages'
import { useEditor } from './editorContext'
import { formatSize, safeFileName, usePreparedDownload } from './preparedDownload'

const { open, project, chapters, scenes, act } = useEditor()
const release = ref('1.0')
const excludedChapterIds = ref<string[]>([])
const download = usePreparedDownload()
const textDownload = usePreparedDownload()
const locale = useLocale()
const text = useMessages(detailsMessages)
const common = useMessages(commonMessages)

const included = computed(() => chapters.value.filter(chapter => !excludedChapterIds.value.includes(chapter.id)))
const canExport = computed(() => included.value.length > 0 && release.value.trim() !== '')

function setIncluded(chapterId: string, isIncluded: boolean) {
  const others = excludedChapterIds.value.filter(excluded => excluded !== chapterId)
  excludedChapterIds.value = isIncluded ? others : [...others, chapterId]
  download.forget()
}

function exportStoryText() {
  textDownload.offer(`${safeFileName(project.value.name, locale.value)}.txt`, open.exportText(null))
}

function exportGame() {
  const releaseLabel = release.value.trim()
  const wholeGame = included.value.length === chapters.value.length
  const suffix = wholeGame ? '' : ` - ${included.value.map(chapter => chapter.title ?? common.value.untitled).join(', ')}`
  return act(async () => {
    const bytes = await open.exportGame(releaseLabel, included.value.map(chapter => chapter.id), new Date())
    download.offer(`${safeFileName(`${project.value.name} ${releaseLabel}${suffix}`, locale.value)}.zip`, bytes)
  })
}
</script>

<template>
  <section class="export">
    <p class="muted">
      {{ text.exportIntro }}
    </p>
    <label class="field release">
      <span>{{ text.release }}</span>
      <input v-model="release" class="text-input" maxlength="40" @input="download.forget()">
    </label>
    <fieldset class="chapters">
      <legend>{{ text.chapters }}</legend>
      <p v-if="chapters.length === 0" class="muted">{{ text.noChapters }}</p>
      <label v-for="chapter in chapters" :key="chapter.id" class="chapter">
        <input type="checkbox" :checked="!excludedChapterIds.includes(chapter.id)" @change="setIncluded(chapter.id, ($event.target as HTMLInputElement).checked)">
        {{ chapter.title ?? common.untitledChapter }}
      </label>
      <p v-if="scenes.length > 0" class="muted">
        {{ text.scenesToo(scenes.length, scenes.map(scene => scene.title).join(', ')) }}
      </p>
    </fieldset>
    <div class="actions">
      <button class="button primary" :disabled="!canExport" @click="exportGame">{{ text.export }}</button>
      <a v-if="download.prepared.value !== null" class="download" :href="download.prepared.value.url" :download="download.prepared.value.fileName">
        {{ common.download(download.prepared.value.fileName) }} <span class="muted">({{ formatSize(download.prepared.value.byteSize, locale) }})</span>
      </a>
    </div>

    <h2 class="section-title">{{ text.asText }}</h2>
    <p class="muted">
      {{ text.asTextIntro }}
    </p>
    <div class="actions">
      <button class="button" :disabled="chapters.length === 0" @click="exportStoryText">{{ text.exportStoryText }}</button>
      <a v-if="textDownload.prepared.value !== null" class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">
        {{ common.download(textDownload.prepared.value.fileName) }}
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
