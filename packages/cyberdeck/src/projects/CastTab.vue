<script setup lang="ts">
import type { Facing } from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, ref, shallowRef, watch } from 'vue'
import { castMessages } from '../i18n/castMessages'
import { readGivenFiles, useEditor } from './editorContext'
import { measureFontWidth } from './fontWidth'

const { open, project, act } = useEditor()
const locale = useLocale()
const text = useMessages(castMessages)
const isDraggingOver = ref(false)
/** Addresses of the image files, for thumbnails. */
const imageUrls = shallowRef<ReadonlyMap<string, string>>(new Map())

watch(project, async current => {
  const urls = new Map<string, string>()
  for (const asset of current.assets.filter(candidate => candidate.mediaType.startsWith('image/'))) {
    urls.set(asset.id, await open.assetUrl(asset.id))
  }
  imageUrls.value = urls
}, { immediate: true })

const fileOf = (assetId: string | null) => project.value.assets.find(asset => asset.id === assetId) ?? null
const entry = (id: string, name: string, assetId: string | null) => ({ id, name, file: fileOf(assetId), imageUrl: assetId === null ? null : imageUrls.value.get(assetId) ?? null })

const characters = computed(() => project.value.characters.map(character => ({
  id: character.id,
  name: character.name,
  drawnFacing: character.drawnFacing ?? 'viewer',
  expressions: character.expressions.map(expression => entry(expression.id, expression.name, expression.assetId)),
})))
const backgrounds = computed(() => project.value.backgrounds.map(background => entry(background.id, background.name, background.assetId)))
const music = computed(() => project.value.music.map(track => entry(track.id, track.name, track.assetId)))
const sounds = computed(() => project.value.sounds.map(sound => entry(sound.id, sound.name, sound.assetId)))
const illustrations = computed(() => project.value.illustrations.map(illustration => entry(illustration.id, illustration.name, illustration.assetId)))
const videos = computed(() => project.value.videos.map(video => ({ ...entry(video.id, video.name, video.assetId), captions: fileOf(video.captionsAssetId ?? null) })))
const fonts = computed(() => project.value.fonts.map(font => ({ ...entry(font.id, font.name, font.assetId), widthScale: font.widthScale })))
const missingCount = computed(() => [...characters.value.flatMap(character => character.expressions), ...backgrounds.value, ...illustrations.value, ...music.value, ...sounds.value, ...videos.value]
  .filter(candidate => candidate.file === null).length)

async function addFiles(fileList: FileList | null | undefined) {
  const files = await readGivenFiles(fileList)
  if (files.length === 0) {
    return
  }
  let report = ''
  await act(async () => {
    const matches = await open.addFiles(files, measureFontWidth, locale.value)
    const used = matches.filter(match => match.entry !== null)
    const unused = matches.filter(match => match.entry === null).map(match => match.fileName)
    report = [
      used.length === 0 ? '' : text.value.filesAdded(used.length, used.map(match => `${match.fileName} → ${match.entry}`).join(', ')),
      unused.length === 0 ? '' : text.value.filesUnused(unused.join(', ')),
    ].filter(sentence => sentence !== '').join(' ')
  }, () => report)
}

function onDrop(event: DragEvent) {
  isDraggingOver.value = false
  void addFiles(event.dataTransfer?.files)
}

function setDrawnFacing(characterId: string, value: string) {
  const facing: Facing | null = value === 'left' || value === 'right' ? value : null
  void act(() => open.setDrawnFacing(characterId, facing))
}
</script>

<template>
  <section class="cast">
    <label
      class="drop-zone"
      :class="{ dragging: isDraggingOver }"
      @dragover.prevent="isDraggingOver = true"
      @dragleave="isDraggingOver = false"
      @drop.prevent="onDrop"
    >
      <input class="file-input" type="file" multiple accept="image/*,audio/*,video/mp4,video/webm,.vtt,.woff2,.woff,.ttf,.otf" @change="addFiles(($event.target as HTMLInputElement).files)">
      <strong>{{ text.dropTitle }}</strong>
      <span class="muted">{{ text.dropHelpStart }} <code>rooftop.jpg</code>, <code>marie-smile.png</code>, <code>calm.ogg</code>, <code>door.ogg</code>, <code>opening.webm</code> {{ text.dropHelpCaptions }} <code>opening.vtt</code>{{ text.dropHelpMiddle }}<code>.woff2</code>, <code>.woff</code>, <code>.ttf</code>, <code>.otf</code>{{ text.dropHelpEnd }}</span>
    </label>

    <p v-if="characters.length + backgrounds.length + illustrations.length + music.length + sounds.length + videos.length === 0" class="muted">
      {{ text.nothingYet }}
    </p>
    <p v-else-if="missingCount > 0" class="muted">{{ text.missingFiles(missingCount) }}</p>

    <template v-if="characters.length > 0">
      <h2 class="section-title">{{ text.characters }}</h2>
      <div v-for="character in characters" :key="character.id" class="group">
        <div class="group-name">
          {{ character.name }}
          <label class="drawn-facing muted">
            {{ text.drawnFacing }}
            <select :value="character.drawnFacing" @change="setDrawnFacing(character.id, ($event.target as HTMLSelectElement).value)">
              <option value="viewer">{{ text.facingViewer }}</option>
              <option value="left">{{ text.facingLeft }}</option>
              <option value="right">{{ text.facingRight }}</option>
            </select>
          </label>
        </div>
        <p v-if="character.expressions.length === 0" class="muted entry">{{ text.speaksOnly }}</p>
        <div v-for="expression in character.expressions" :key="expression.id" class="entry">
          <img v-if="expression.imageUrl !== null" class="thumbnail" :src="expression.imageUrl" alt="">
          <span v-else class="thumbnail empty" />
          <span>{{ expression.name }}</span>
          <span :class="expression.file === null ? 'missing' : 'present'">{{ expression.file?.fileName ?? text.noFile }}</span>
        </div>
      </div>
    </template>

    <template v-if="backgrounds.length > 0">
      <h2 class="section-title">{{ text.backgrounds }}</h2>
      <div v-for="background in backgrounds" :key="background.id" class="entry">
        <img v-if="background.imageUrl !== null" class="thumbnail wide" :src="background.imageUrl" alt="">
        <span v-else class="thumbnail wide empty" />
        <span>{{ background.name }}</span>
        <span :class="background.file === null ? 'missing' : 'present'">{{ background.file?.fileName ?? text.noFile }}</span>
      </div>
    </template>

    <template v-if="illustrations.length > 0">
      <h2 class="section-title">{{ text.illustrations }}</h2>
      <div v-for="illustration in illustrations" :key="illustration.id" class="entry">
        <img v-if="illustration.imageUrl !== null" class="thumbnail wide" :src="illustration.imageUrl" alt="">
        <span v-else class="thumbnail wide empty" />
        <span>{{ illustration.name }}</span>
        <span :class="illustration.file === null ? 'missing' : 'present'">{{ illustration.file?.fileName ?? text.noFile }}</span>
      </div>
    </template>

    <template v-if="music.length > 0">
      <h2 class="section-title">{{ text.music }}</h2>
      <div v-for="track in music" :key="track.id" class="entry">
        <span>{{ track.name }}</span>
        <span :class="track.file === null ? 'missing' : 'present'">{{ track.file?.fileName ?? text.noFile }}</span>
      </div>
    </template>

    <template v-if="sounds.length > 0">
      <h2 class="section-title">{{ text.sounds }}</h2>
      <div v-for="sound in sounds" :key="sound.id" class="entry">
        <span>{{ sound.name }}</span>
        <span :class="sound.file === null ? 'missing' : 'present'">{{ sound.file?.fileName ?? text.noFile }}</span>
      </div>
    </template>

    <template v-if="videos.length > 0">
      <h2 class="section-title">{{ text.videos }}</h2>
      <div v-for="video in videos" :key="video.id" class="entry">
        <span>{{ video.name }}</span>
        <span :class="video.file === null ? 'missing' : 'present'">{{ video.file?.fileName ?? text.noFile }}</span>
        <span class="muted">{{ video.captions === null ? text.noCaptions : text.captions(video.captions.fileName) }}</span>
      </div>
    </template>

    <template v-if="fonts.length > 0">
      <h2 class="section-title">{{ text.fonts }}</h2>
      <p class="muted">{{ text.fontsHelp }}</p>
      <div v-for="font in fonts" :key="font.id" class="entry">
        <code>font-family: "{{ font.name }}"</code>
        <span :class="font.file === null ? 'missing' : 'present'">{{ font.file?.fileName ?? text.noFile }} · {{ text.fontWidth(Math.round(font.widthScale * 100)) }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border: 2px dashed #2c3442;
  border-radius: 8px;
  cursor: pointer;
}

.drop-zone.dragging,
.drop-zone:focus-within {
  border-color: #9eeaff;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.group {
  margin-bottom: 12px;
}

.group-name {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.drawn-facing {
  font-size: 14px;
  font-weight: 400;
}

.drawn-facing select {
  margin-left: 4px;
  padding: 2px 4px;
  border: 1px solid #2c3442;
  border-radius: 4px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
}

.entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 4px 0 4px 12px;
}

.entry:not(:has(.thumbnail)) {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.thumbnail {
  width: 32px;
  height: 48px;
  border-radius: 4px;
  background: #0b0d12;
  object-fit: contain;
}

.thumbnail.wide {
  width: 64px;
  height: 36px;
  object-fit: cover;
}

.thumbnail.empty {
  display: inline-block;
  border: 1px dashed #2c3442;
}

.present {
  color: #a3e4b0;
  overflow-wrap: anywhere;
}

.missing {
  color: #7b8597;
}

p {
  margin: 12px 0 0;
}
</style>
