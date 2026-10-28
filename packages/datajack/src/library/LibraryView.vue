<script setup lang="ts">
import { parseSave, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { AUTOSAVE_SLOT, LanguageSelect, useLocale, useMessages, type LanguageChoice, type SaveStore } from '@cyberdeck/stage'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { describeError } from '../i18n/errorMessages'
import { describeInstall, libraryMessages } from '../i18n/libraryMessages'
import type { GameLibrary, LibraryEntry } from './gameLibrary'

const props = defineProps<{ library: GameLibrary; saveStore: SaveStore; profileName: string }>()
const languageChoice = defineModel<LanguageChoice>('languageChoice', { required: true })
const emit = defineEmits<{ play: [story: PlayableStory, resumeFrom: SaveData | null]; map: [story: PlayableStory]; gallery: [story: PlayableStory]; switchProfile: [] }>()

const entries = shallowRef<LibraryEntry[]>([])
const autosaves = shallowRef<ReadonlyMap<string, SaveData>>(new Map())
const progressByGame = shallowRef<ReadonlyMap<string, ProgressData>>(new Map())
const isLoaded = ref(false)
const isInstalling = ref(false)
const isDraggingOver = ref(false)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
/** The game whose removal, or whose restart over an autosave, waits for confirmation. */
const confirming = ref<{ gameId: string; action: 'remove' | 'restart' } | null>(null)
const shownCredits = ref<string | null>(null)
const locale = useLocale()
const text = useMessages(libraryMessages)
const errorText = (error: unknown) => describeError(error, locale.value)

const cards = computed(() => entries.value.map(entry => {
  const installed = entry.chapters.filter(chapter => chapter.included)
  const missing = entry.chapters.filter(chapter => !chapter.included).map(chapter => chapter.title ?? text.value.untitledChapter)
  const progress = progressByGame.value.get(entry.id) ?? null
  return {
    entry,
    installedCount: installed.length,
    missing,
    autosave: autosaves.value.get(entry.id) ?? null,
    hasMap: (progress?.points.length ?? 0) > 0,
    endingsReached: progress?.endingIds.length ?? 0,
    illustrationsSeen: progress?.illustrationIds.length ?? 0,
  }
}))

onMounted(refresh)
watch(() => props.saveStore, refresh)

async function refresh() {
  try {
    entries.value = await props.library.list()
    const found = await Promise.all(entries.value.map(async entry => [entry.id, await props.saveStore.read(entry.id, AUTOSAVE_SLOT)] as const))
    autosaves.value = new Map(found.filter((pair): pair is readonly [string, SaveData] => pair[1] !== null))
    const progress = await Promise.all(entries.value.map(async entry => [entry.id, await props.saveStore.readProgress(entry.id)] as const))
    progressByGame.value = new Map(progress.filter((pair): pair is readonly [string, ProgressData] => pair[1] !== null))
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    isLoaded.value = true
  }
}

async function install(fileList: FileList | null) {
  const files = [...(fileList ?? [])]
  if (files.length === 0) {
    return
  }
  isInstalling.value = true
  message.value = null
  errorMessage.value = null
  const reports: string[] = []
  for (const file of files) {
    try {
      reports.push(describeInstall(await props.library.install(new Uint8Array(await file.arrayBuffer())), text.value))
    } catch (error) {
      errorMessage.value = text.value.fileError(file.name, errorText(error))
    }
  }
  message.value = reports.length === 0 ? null : reports.join(' ')
  isInstalling.value = false
  await refresh()
}

async function play(entry: LibraryEntry, resumeFrom: SaveData | null) {
  confirming.value = null
  try {
    emit('play', await props.library.open(entry.id), resumeFrom)
  } catch (error) {
    errorMessage.value = text.value.cannotOpen(entry.name, errorText(error))
  }
}

async function openMap(entry: LibraryEntry, view: 'map' | 'gallery' = 'map') {
  try {
    const story = await props.library.open(entry.id)
    if (view === 'map') {
      emit('map', story)
    } else {
      emit('gallery', story)
    }
  } catch (error) {
    errorMessage.value = text.value.cannotOpen(entry.name, errorText(error))
  }
}

function startOver(entry: LibraryEntry, hasAutosave: boolean) {
  if (hasAutosave && confirming.value?.gameId !== entry.id) {
    confirming.value = { gameId: entry.id, action: 'restart' }
    return
  }
  void play(entry, null)
}

async function remove(entry: LibraryEntry) {
  confirming.value = null
  await props.library.remove(entry.id)
  message.value = text.value.removed(entry.name)
  await refresh()
}

/** Opens a save from a file, from this computer or another: its game must be installed. */
async function loadSave(file: File | undefined) {
  if (file === undefined) {
    return
  }
  message.value = null
  errorMessage.value = null
  const save = await readSave(file)
  if (save === null) {
    errorMessage.value = text.value.notASave(file.name)
    return
  }
  const entry = entries.value.find(candidate => candidate.id === save.game.id)
  if (entry === undefined) {
    errorMessage.value = text.value.gameNotInstalled(file.name, save.game.name)
    return
  }
  await play(entry, save)
}

async function readSave(file: File): Promise<SaveData | null> {
  try {
    return parseSave(JSON.parse(await file.text()))
  } catch {
    return null
  }
}

function onSaveChosen(input: HTMLInputElement) {
  void loadSave(input.files?.[0])
  // The same file chosen again is a new load.
  input.value = ''
}

/** Saves dropped are opened, anything else is installed as a game. */
function onDrop(event: DragEvent) {
  isDraggingOver.value = false
  const files = [...(event.dataTransfer?.files ?? [])]
  const save = files.find(file => file.name.toLowerCase().endsWith('.json'))
  if (save !== undefined) {
    void loadSave(save)
    return
  }
  void install(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <main
    class="library"
    :class="{ dragging: isDraggingOver }"
    @dragover.prevent="isDraggingOver = true"
    @dragleave.self="isDraggingOver = false"
    @drop.prevent="onDrop"
  >
    <header class="header">
      <h1>Datajack</h1>
      <div class="header-actions">
        <label class="language">
          <span>{{ text.language }}</span>
          <LanguageSelect v-model="languageChoice" />
        </label>
        <button class="profile-button" @click="emit('switchProfile')">{{ profileName }} <span class="switch">· {{ text.switchProfile }}</span></button>
      </div>
    </header>

    <div class="toolbar">
      <label class="add-button" :class="{ busy: isInstalling }">
        <input class="file-input" type="file" accept=".zip,application/zip" multiple :disabled="isInstalling" @change="install(($event.target as HTMLInputElement).files)">
        {{ isInstalling ? text.installing : text.addGame }}
      </label>
      <label class="load-button">
        <input class="file-input" type="file" accept=".json,application/json" @change="onSaveChosen($event.target as HTMLInputElement)">
        {{ text.loadSave }}
      </label>
      <span class="hint">{{ text.dropHint.beforeGame }}<code>.zip</code>{{ text.dropHint.beforeSave }}<code>.json</code>{{ text.dropHint.after }}</span>
    </div>
    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>

    <p v-if="isLoaded && cards.length === 0" class="empty">
      {{ text.noGames.before }}<code>.zip</code>{{ text.noGames.after }}
    </p>

    <ul class="games">
      <li v-for="card in cards" :key="card.entry.id" class="game">
        <div class="cover" :class="{ placeholder: card.entry.coverUrl === null }">
          <img v-if="card.entry.coverUrl !== null" :src="card.entry.coverUrl" alt="">
          <span v-else aria-hidden="true">{{ card.entry.name.charAt(0) }}</span>
        </div>
        <div class="details">
          <h2>{{ card.entry.name }} <span class="release">{{ card.entry.release }}</span></h2>
          <p v-if="card.entry.description !== ''" class="description">{{ card.entry.description }}</p>
          <p class="chapters">
            <template v-if="card.missing.length === 0">{{ text.chapterCount(card.installedCount) }}</template>
            <template v-else>{{ text.someChapters(card.installedCount, card.entry.chapters.length, card.missing) }}</template>
            <template v-if="card.entry.endingCount > 0"> · {{ text.endingsReached(card.endingsReached, card.entry.endingCount) }}</template>
            <template v-if="card.entry.illustrationCount > 0"> · {{ text.illustrationsSeen(card.illustrationsSeen, card.entry.illustrationCount) }}</template>
          </p>

          <div v-if="confirming?.gameId === card.entry.id" class="confirmation">
            <template v-if="confirming.action === 'remove'">
              <p>{{ text.confirmRemove(card.entry.name) }}</p>
              <div class="actions">
                <button class="button danger" @click="remove(card.entry)">{{ text.remove }}</button>
                <button class="button" @click="confirming = null">{{ text.cancel }}</button>
              </div>
            </template>
            <template v-else>
              <p>{{ text.confirmStartOver }}</p>
              <div class="actions">
                <button class="button primary" @click="play(card.entry, null)">{{ text.startOver }}</button>
                <button class="button" @click="confirming = null">{{ text.cancel }}</button>
              </div>
            </template>
          </div>
          <div v-else class="actions">
            <button v-if="card.autosave !== null" class="button primary" @click="play(card.entry, card.autosave)">{{ text.continue }}</button>
            <button class="button" :class="{ primary: card.autosave === null }" @click="startOver(card.entry, card.autosave !== null)">
              {{ card.autosave === null ? text.play : text.newGame }}
            </button>
            <button v-if="card.hasMap" class="button" @click="openMap(card.entry)">{{ text.map }}</button>
            <button v-if="card.entry.illustrationCount > 0" class="button" @click="openMap(card.entry, 'gallery')">{{ text.gallery }}</button>
            <button v-if="card.entry.credits !== ''" class="link-button" @click="shownCredits = shownCredits === card.entry.id ? null : card.entry.id">{{ text.credits }}</button>
            <button class="link-button" @click="confirming = { gameId: card.entry.id, action: 'remove' }">{{ text.remove }}</button>
          </div>
          <p v-if="shownCredits === card.entry.id" class="credits">{{ card.entry.credits }}</p>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.library {
  box-sizing: border-box;
  max-width: 880px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 32px 16px;
  font: 16px/1.5 system-ui, sans-serif;
  color: #e6e9ef;
}

.library.dragging {
  outline: 2px dashed #9eeaff;
  outline-offset: -8px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px 16px;
}

h1 {
  margin: 0;
  font-size: 28px;
  color: #9eeaff;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 24px;
}

.language {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  color: #7b8597;
}

.profile-button {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: #e6e9ef;
  cursor: pointer;
}

.profile-button .switch {
  font-weight: 400;
  color: #7b8597;
}

.profile-button:hover .switch,
.profile-button:focus-visible .switch {
  color: #9eeaff;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin: 24px 0 8px;
}

.load-button {
  position: relative;
  padding: 8px 20px;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  color: #e6e9ef;
  cursor: pointer;
}

.load-button:focus-within {
  outline: 2px solid #9eeaff;
  outline-offset: 2px;
}

.add-button {
  position: relative;
  padding: 8px 20px;
  border: 1px solid #9eeaff;
  border-radius: 6px;
  background: #0e2a36;
  font-weight: 600;
  color: #9eeaff;
  cursor: pointer;
}

.add-button.busy {
  opacity: 0.6;
  cursor: default;
}

.add-button:focus-within {
  outline: 2px solid #9eeaff;
  outline-offset: 2px;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: inherit;
}

.hint,
.empty {
  color: #7b8597;
}

.games {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 24px 0;
  padding: 0;
  list-style: none;
}

.game {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
}

@media (min-width: 640px) {
  .game {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}

.cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 6px;
  background: #0b0d12;
}

.cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover.placeholder {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #1d2b53, #7e2553);
  font-size: 48px;
  font-weight: 700;
  color: rgb(255 255 255 / 0.7);
}

.details h2 {
  margin: 0;
  font-size: 22px;
}

.release {
  font-size: 15px;
  font-weight: 400;
  color: #7b8597;
}

.description {
  margin: 4px 0 0;
  white-space: pre-line;
  color: #c7cdd8;
}

.chapters {
  margin: 4px 0 0;
  font-size: 14px;
  color: #7b8597;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 12px;
}

.confirmation p {
  margin: 12px 0 0;
}

.button {
  padding: 8px 16px;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
  cursor: pointer;
}

.button.primary {
  border-color: #9eeaff;
  background: #0e2a36;
  color: #9eeaff;
  font-weight: 600;
}

.button.danger {
  border-color: #f28b82;
  color: #f28b82;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 14px;
  color: #7b8597;
  cursor: pointer;
}

.link-button:hover,
.link-button:focus-visible {
  color: #9eeaff;
}

.credits {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 6px;
  background: #0b0d12;
  font-size: 14px;
  white-space: pre-line;
  color: #c7cdd8;
}

.message {
  color: #a3e4b0;
}

.error {
  color: #f28b82;
}
</style>
