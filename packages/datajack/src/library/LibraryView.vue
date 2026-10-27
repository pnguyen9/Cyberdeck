<script setup lang="ts">
import { parseSave, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { AUTOSAVE_SLOT, type SaveStore } from '@cyberdeck/stage'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import type { GameLibrary, InstallOutcome, LibraryEntry } from './gameLibrary'

const props = defineProps<{ library: GameLibrary; saveStore: SaveStore; profileName: string }>()
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

const cards = computed(() => entries.value.map(entry => {
  const installed = entry.chapters.filter(chapter => chapter.included)
  const missing = entry.chapters.filter(chapter => !chapter.included).map(chapter => chapter.title ?? 'Untitled chapter')
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
    errorMessage.value = error instanceof Error ? error.message : String(error)
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
      reports.push(describe(await props.library.install(new Uint8Array(await file.arrayBuffer()))))
    } catch (error) {
      errorMessage.value = `${file.name}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  message.value = reports.length === 0 ? null : reports.join(' ')
  isInstalling.value = false
  await refresh()
}

function describe(outcome: InstallOutcome): string {
  const name = `${outcome.gameName} ${outcome.release}`
  const list = (titles: string[]) => titles.join(', ')
  if (outcome.isNewGame) {
    return `${name} installed.`
  }
  const changes = [
    outcome.addedChapters.length === 0 ? '' : `added ${list(outcome.addedChapters)}`,
    outcome.updatedChapters.length === 0 ? '' : `updated ${list(outcome.updatedChapters)}`,
  ].filter(change => change !== '').join('; ')
  if (outcome.wasOlder) {
    return changes === ''
      ? `This archive of ${outcome.gameName} is older than ${outcome.release}, installed already: nothing to add.`
      : `This archive of ${outcome.gameName} is older than ${outcome.release}, installed already: ${changes}.`
  }
  return changes === '' ? `${name}: nothing new.` : `${name}: ${changes}.`
}

async function play(entry: LibraryEntry, resumeFrom: SaveData | null) {
  confirming.value = null
  try {
    emit('play', await props.library.open(entry.id), resumeFrom)
  } catch (error) {
    errorMessage.value = `${entry.name} cannot be opened: ${error instanceof Error ? error.message : String(error)}`
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
    errorMessage.value = `${entry.name} cannot be opened: ${error instanceof Error ? error.message : String(error)}`
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
  message.value = `${entry.name} was removed.`
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
    errorMessage.value = `${file.name} is not a save.`
    return
  }
  const entry = entries.value.find(candidate => candidate.id === save.game.id)
  if (entry === undefined) {
    errorMessage.value = `${file.name} is a save of ${save.game.name}, which is not installed: add the game first.`
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
      <button class="profile-button" @click="emit('switchProfile')">{{ profileName }} <span class="switch">· Switch profile</span></button>
    </header>

    <div class="toolbar">
      <label class="add-button" :class="{ busy: isInstalling }">
        <input class="file-input" type="file" accept=".zip,application/zip" multiple :disabled="isInstalling" @change="install(($event.target as HTMLInputElement).files)">
        {{ isInstalling ? 'Installing…' : 'Add a game…' }}
      </label>
      <label class="load-button">
        <input class="file-input" type="file" accept=".json,application/json" @change="onSaveChosen($event.target as HTMLInputElement)">
        Load a save…
      </label>
      <span class="hint">or drop a game's <code>.zip</code> or a save's <code>.json</code> anywhere on this page</span>
    </div>
    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>

    <p v-if="isLoaded && cards.length === 0" class="empty">
      No games yet. Add a game you downloaded: its <code>.zip</code> file.
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
            <template v-if="card.missing.length === 0">{{ card.installedCount }} {{ card.installedCount === 1 ? 'chapter' : 'chapters' }}</template>
            <template v-else>{{ card.installedCount }} of {{ card.entry.chapters.length }} chapters · not installed: {{ card.missing.join(', ') }}</template>
            <template v-if="card.entry.endingCount > 0"> · endings reached: {{ card.endingsReached }} of {{ card.entry.endingCount }}</template>
            <template v-if="card.entry.illustrationCount > 0"> · illustrations seen: {{ card.illustrationsSeen }} of {{ card.entry.illustrationCount }}</template>
          </p>

          <div v-if="confirming?.gameId === card.entry.id" class="confirmation">
            <template v-if="confirming.action === 'remove'">
              <p>Remove {{ card.entry.name }}? Your saves are kept, for when you install it again.</p>
              <div class="actions">
                <button class="button danger" @click="remove(card.entry)">Remove</button>
                <button class="button" @click="confirming = null">Cancel</button>
              </div>
            </template>
            <template v-else>
              <p>Start over? Your autosave will be replaced; your saved slots are kept.</p>
              <div class="actions">
                <button class="button primary" @click="play(card.entry, null)">Start over</button>
                <button class="button" @click="confirming = null">Cancel</button>
              </div>
            </template>
          </div>
          <div v-else class="actions">
            <button v-if="card.autosave !== null" class="button primary" @click="play(card.entry, card.autosave)">Continue</button>
            <button class="button" :class="{ primary: card.autosave === null }" @click="startOver(card.entry, card.autosave !== null)">
              {{ card.autosave === null ? 'Play' : 'New game' }}
            </button>
            <button v-if="card.hasMap" class="button" @click="openMap(card.entry)">Map</button>
            <button v-if="card.entry.illustrationCount > 0" class="button" @click="openMap(card.entry, 'gallery')">Gallery</button>
            <button v-if="card.entry.credits !== ''" class="link-button" @click="shownCredits = shownCredits === card.entry.id ? null : card.entry.id">Credits</button>
            <button class="link-button" @click="confirming = { gameId: card.entry.id, action: 'remove' }">Remove</button>
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
