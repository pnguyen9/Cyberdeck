<script setup lang="ts">
import { emptyProgressOf, languageName, mergeProgress, parseProgress, parseSave, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { AboutApp, AppLookButton, NewVersionBar, SampleNotLoadedNote, AUTOSAVE_SLOT, LanguageSelect, SampleCard, isHosted, useAboutApp, useLocale, useMessages, type ErasedData, type LanguageChoice, type SampleIndexEntry, type SaveStore } from '@cyberdeck/stage'
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { describeError } from '../i18n/errorMessages'
import { describeInstall, describeSampleInstall, libraryMessages } from '../i18n/libraryMessages'
import { pinMessages } from '../i18n/pinMessages'
import { usePinAsk } from '../profiles/pinAsk'
import LockIcon from '../profiles/LockIcon.vue'
import PinDialog from '../profiles/PinDialog.vue'
import type { ProfileLocks } from '../profiles/profileLocks'
import type { Profile } from '../profiles/profileStore'
import { builtInSamples, installedSamples, installSample, SampleNotLoaded } from './builtInSamples'
import type { GameLibrary, LibraryEntry } from './gameLibrary'
import { sampleState } from './sampleShelf'

const props = defineProps<{ library: GameLibrary; saveStore: SaveStore; profile: Pick<Profile, 'id' | 'name'>; locks: ProfileLocks }>()
const languageChoice = defineModel<LanguageChoice>('languageChoice', { required: true })
const emit = defineEmits<{ play: [story: PlayableStory, resumeFrom: SaveData | null]; map: [story: PlayableStory]; gallery: [story: PlayableStory]; settings: []; gameSettings: [gameId: string, gameName: string]; switchProfile: [] }>()

const entries = shallowRef<LibraryEntry[]>([])
const autosaves = shallowRef<ReadonlyMap<string, SaveData>>(new Map())
const progressByGame = shallowRef<ReadonlyMap<string, ProgressData>>(new Map())
const isLoaded = ref(false)
const isInstalling = ref(false)
const isDraggingOver = ref(false)
const message = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
/** The game whose removal, or whose restart over an autosave, waits for confirmation. */
const confirming = ref<{ gameId: string; action: 'remove' | 'restart' | 'erase' } | null>(null)
const shownCredits = ref<string | null>(null)
const locale = useLocale()
const text = useMessages(libraryMessages)
const pinText = useMessages(pinMessages)
/** A profile with a PIN asks for it again before its saves or progress are erased, and before its PIN is changed. */
const { asked: pinAsked, withPin, managePin, pinDone, pinClosed } = usePinAsk(props.locks)
/** Whether this profile has a PIN, for the header's button: read again whenever the dialog sets, changes or removes it. */
const hasPin = ref(props.locks.isLocked(props.profile.id))
function choosePin() {
  managePin(props.profile, said => {
    hasPin.value = props.locks.isLocked(props.profile.id)
    message.value = said
    errorMessage.value = null
  })
}
const errorText = (error: unknown) => describeError(error, locale.value)

/**
 * The language each game is played in: the one the profile picked for it, kept in its progress; else
 * Datajack's own, when the game has it; else the story's first.
 */
function languageOf(entry: LibraryEntry): string {
  const kept = progressByGame.value.get(entry.id)?.language
  if (kept !== undefined && entry.languages.includes(kept)) {
    return kept
  }
  return entry.languages.find(language => language.split('-')[0] === locale.value) ?? entry.languages[0] ?? locale.value
}
async function pickLanguage(entry: LibraryEntry, language: string) {
  const progress = { ...progressByGame.value.get(entry.id) ?? emptyProgressOf({ id: entry.id, name: entry.name }), language }
  progressByGame.value = new Map([...progressByGame.value, [entry.id, progress]])
  await props.saveStore.writeProgress(entry.id, progress)
}

const cards = computed(() => entries.value.map(entry => {
  const installed = entry.chapters.filter(chapter => chapter.included)
  // Chapters left out that their author keeps quiet about are not counted either.
  const listedCount = entry.chapters.filter(chapter => chapter.included || chapter.listed !== false).length
  // Chapters left out without their titles, as their author may choose, are only counted.
  const missing = entry.chapters.flatMap(chapter => chapter.included || chapter.title === null ? [] : [chapter.title])
  const progress = progressByGame.value.get(entry.id) ?? null
  return {
    entry,
    installedCount: installed.length,
    listedCount,
    missing,
    autosave: autosaves.value.get(entry.id) ?? null,
    hasMap: (progress?.points.length ?? 0) > 0,
    endingsReached: progress?.endingIds.length ?? 0,
    language: languageOf(entry),
    /** Each language by its own name, as players look for theirs. */
    languageNames: entry.languages.map(language => ({ code: language, name: languageName(language, language) ?? language })),
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

/** The games picked; the field emptied, so that the same file picked again, a game removed then installed anew, is read again. */
function installChosen(input: HTMLInputElement) {
  const files = [...(input.files ?? [])]
  input.value = ''
  void install(files)
}

async function install(files: readonly File[]) {
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

/** What the shelf installed, read again after each installation. */
const shelfRecord = ref(installedSamples())
/** The sample being loaded, whose button waits. */
const loadingSampleId = ref<string | null>(null)
const shelf = computed(() => {
  const libraryIds = new Set(entries.value.map(entry => entry.id))
  return builtInSamples.map(sample => ({ sample, state: sampleState(sample, libraryIds, shelfRecord.value) }))
})

/** What the shelf says of the last installation, by the sample's card, where the player is looking. */
/** `notLoaded`: the sample's files could not be had, which a new version of Datajack may explain. */
const sampleReport = ref<{ sampleId: string; text: string; isError: boolean; notLoaded?: boolean } | null>(null)
const reportElements = new Map<string, HTMLElement>()
const setReportElement = (sampleId: string, element: unknown) => {
  if (element instanceof HTMLElement) {
    reportElements.set(sampleId, element)
  } else {
    reportElements.delete(sampleId)
  }
}
const about = useAboutApp()

async function addSample(sample: SampleIndexEntry) {
  loadingSampleId.value = sample.id
  sampleReport.value = null
  try {
    sampleReport.value = { sampleId: sample.id, text: describeSampleInstall(await installSample(props.library, sample), text.value), isError: false }
  } catch (error) {
    const notLoaded = error instanceof SampleNotLoaded
    const isOnHost = about !== null && isHosted(about.howItRuns)
    sampleReport.value = { sampleId: sample.id, text: notLoaded ? text.value.sampleNotLoaded(sample.name, isOnHost) : errorText(error), isError: true, notLoaded }
    if (notLoaded && isOnHost) {
      // This page may be an older release, kept on the device, whose sample the host no longer has.
      about.isNewVersionPutOff.value = false
      about.checkNewVersion()
    }
  }
  shelfRecord.value = installedSamples()
  loadingSampleId.value = null
  await refresh()
  // The button may be gone, a label in its place: the report takes the focus.
  await nextTick()
  reportElements.get(sample.id)?.focus()
}

async function play(entry: LibraryEntry, resumeFrom: SaveData | null) {
  confirming.value = null
  try {
    // A save is resumed in the language it was played in, when the game still has it.
    const language = resumeFrom?.language !== undefined && entry.languages.includes(resumeFrom.language) ? resumeFrom.language : languageOf(entry)
    emit('play', await props.library.open(entry.id, language), resumeFrom)
  } catch (error) {
    errorMessage.value = text.value.cannotOpen(entry.name, errorText(error))
  }
}

async function openMap(entry: LibraryEntry, view: 'map' | 'gallery' = 'map') {
  try {
    const story = await props.library.open(entry.id, languageOf(entry))
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

/** Erases one game's saves, or its progress, or both; the game stays installed. */
function eraseGameData(entry: LibraryEntry, erased: ErasedData) {
  withPin(props.profile, 'confirm', () => eraseGameDataNow(entry, erased))
}

async function eraseGameDataNow(entry: LibraryEntry, erased: ErasedData) {
  confirming.value = null
  await props.saveStore.eraseGame(entry.id, erased)
  message.value = text.value.erasedGameData(entry.name, erased)
  await refresh()
}

async function remove(entry: LibraryEntry) {
  confirming.value = null
  await props.library.remove(entry.id)
  message.value = text.value.removed(entry.name)
  await refresh()
}

/** Erasing what Datajack keeps waits for the player to say what. */
const isConfirmingErase = ref(false)

/** The games are everyone's, the saves and progress only this profile's: those ask for its PIN. */
function eraseAll(withSaves: boolean) {
  if (withSaves) {
    withPin(props.profile, 'confirm', () => eraseAllNow(true))
  } else {
    void eraseAllNow(false)
  }
}

async function eraseAllNow(withSaves: boolean) {
  isConfirmingErase.value = false
  confirming.value = null
  try {
    await props.library.removeAll()
    if (withSaves) {
      await props.saveStore.eraseAll()
    }
    message.value = withSaves ? text.value.erasedWithSaves : text.value.erased
  } catch (error) {
    errorMessage.value = errorText(error)
  }
  await refresh()
}

/** Opens a save from a file, from this computer or another: its game must be installed. */
async function loadSave(file: File | undefined) {
  if (file === undefined) {
    return
  }
  message.value = null
  errorMessage.value = null
  const read = await readSaveOrProgress(file)
  if (read === null) {
    errorMessage.value = text.value.notASave(file.name)
    return
  }
  if ('progress' in read) {
    await loadProgress(file.name, read.progress)
    return
  }
  const save = read.save
  const entry = entries.value.find(candidate => candidate.id === save.game.id)
  if (entry === undefined) {
    errorMessage.value = text.value.gameNotInstalled(file.name, save.game.name)
    return
  }
  await play(entry, save)
}

/** A save, or a game's progress, read from a file; null for anything else. */
async function readSaveOrProgress(file: File): Promise<{ save: SaveData } | { progress: ProgressData } | null> {
  try {
    const value: unknown = JSON.parse(await file.text())
    const save = parseSave(value)
    if (save !== null) {
      return { save }
    }
    const progress = parseProgress(value)
    return progress === null ? null : { progress }
  } catch {
    return null
  }
}

/** A game's progress joined to the profile's: carried from another computer or another build. */
async function loadProgress(fileName: string, progress: ProgressData) {
  const entry = entries.value.find(candidate => candidate.id === progress.game.id)
  if (entry === undefined) {
    errorMessage.value = text.value.progressOfGameNotInstalled(fileName, progress.game.name)
    return
  }
  const own = await props.saveStore.readProgress(entry.id) ?? emptyProgressOf({ id: entry.id, name: entry.name })
  if (!await props.saveStore.writeProgress(entry.id, mergeProgress(own, progress))) {
    errorMessage.value = text.value.progressNotWritten(entry.name)
    return
  }
  message.value = text.value.progressLoaded(entry.name)
  await refresh()
}

const PROGRESS_FILE_KEPT_MILLISECONDS = 60_000

/** The progress of a game as a file, made as the link is followed: the link then downloads it. */
function prepareProgressFile(event: MouseEvent, entry: LibraryEntry) {
  const progress = progressByGame.value.get(entry.id)
  const link = event.currentTarget as HTMLAnchorElement
  if (progress === undefined) {
    event.preventDefault()
    return
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }))
  link.href = url
  setTimeout(() => URL.revokeObjectURL(url), PROGRESS_FILE_KEPT_MILLISECONDS)
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
  void install([...(event.dataTransfer?.files ?? [])])
}
</script>

<template>
  <main
    class="app-screen library"
    :class="{ dragging: isDraggingOver }"
    @dragover.prevent="isDraggingOver = true"
    @dragleave.self="isDraggingOver = false"
    @drop.prevent="onDrop"
  >
    <NewVersionBar />
    <header class="header">
      <h1>Datajack</h1>
      <div class="header-tools">
        <label class="language-field">
          <span>{{ text.language }}</span>
          <LanguageSelect v-model="languageChoice" />
        </label>
        <button class="button" @click="emit('settings')">{{ text.settings }}</button>
        <AppLookButton class="button" />
        <button class="button pin-button" aria-haspopup="dialog" @click="choosePin">
          <template v-if="hasPin"><LockIcon /> {{ pinText.pin }}</template>
          <template v-else>{{ pinText.addPin }}</template>
        </button>
        <button class="profile-button" @click="emit('switchProfile')">{{ profile.name }} <span class="switch">· {{ text.switchProfile }}</span></button>
      </div>
    </header>

    <div class="toolbar">
      <label class="add-button" :class="{ busy: isInstalling }">
        <input class="file-input" type="file" accept=".zip,application/zip" multiple :disabled="isInstalling" @change="installChosen($event.target as HTMLInputElement)">
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
          <label v-if="card.languageNames.length > 1" class="story-language">
            <span>{{ text.storyLanguage }}</span>
            <select :value="card.language" @change="pickLanguage(card.entry, ($event.target as HTMLSelectElement).value)">
              <option v-for="language in card.languageNames" :key="language.code" :value="language.code">{{ language.name }}</option>
            </select>
          </label>
          <p class="chapters">
            <template v-if="card.installedCount === card.listedCount">{{ text.chapterCount(card.installedCount) }}</template>
            <template v-else>{{ text.someChapters(card.installedCount, card.listedCount, card.missing) }}</template>
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
            <template v-else-if="confirming.action === 'erase'">
              <p>{{ text.confirmEraseGame(card.entry.name) }}</p>
              <div class="actions">
                <button class="button danger" @click="eraseGameData(card.entry, { saves: false, progress: true })">{{ text.eraseProgress }}</button>
                <button class="button danger" @click="eraseGameData(card.entry, { saves: true, progress: false })">{{ text.eraseSaves }}</button>
                <button class="button danger" @click="eraseGameData(card.entry, { saves: true, progress: true })">{{ text.eraseBoth }}</button>
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
            <a v-if="progressByGame.has(card.entry.id)" class="link-button" href="#" :download="text.progressFileName(card.entry.name)" @click="prepareProgressFile($event, card.entry)">{{ text.progressToFile }}</a>
            <button class="link-button" @click="emit('gameSettings', card.entry.id, card.entry.name)">{{ text.settings }}</button>
            <button class="link-button" @click="confirming = { gameId: card.entry.id, action: 'erase' }">{{ text.eraseGameData }}</button>
            <button class="link-button" @click="confirming = { gameId: card.entry.id, action: 'remove' }">{{ text.remove }}</button>
          </div>
          <p v-if="shownCredits === card.entry.id" class="credits">{{ card.entry.credits }}</p>
        </div>
      </li>
    </ul>

    <section class="shelf" aria-labelledby="samples-title">
      <h2 id="samples-title" class="shelf-title">{{ text.samples }}</h2>
      <p class="hint">{{ text.samplesIntro }}</p>
      <ul class="samples">
        <SampleCard v-for="{ sample, state } in shelf" :key="sample.id" :sample="sample">
          <p v-if="state === 'update'" class="hint">{{ text.sampleChanged }}</p>
          <button v-if="state !== 'inLibrary'" class="button" :class="{ primary: state === 'add' }" :disabled="loadingSampleId !== null" @click="addSample(sample)">
            {{ loadingSampleId === sample.id ? text.installing : state === 'add' ? text.addToLibrary : text.updateSample }}
          </button>
          <span v-else class="in-library">{{ text.inYourLibrary }}</span>
          <p
            v-if="sampleReport?.sampleId === sample.id"
            :ref="element => setReportElement(sample.id, element)"
            tabindex="-1"
            :class="sampleReport?.isError ? 'error' : 'message'"
            :role="sampleReport?.isError ? 'alert' : 'status'"
          >
            <SampleNotLoadedNote v-if="sampleReport?.notLoaded" :sample="sample.name" :otherwise="sampleReport.text" />
            <template v-else>{{ sampleReport?.text }}</template>
          </p>
        </SampleCard>
      </ul>
    </section>

    <section class="erase">
      <button v-if="!isConfirmingErase" class="link-button" @click="isConfirmingErase = true">{{ text.eraseAll }}</button>
      <div v-else class="confirmation">
        <p>{{ text.confirmErase(profile.name) }}</p>
        <div class="actions">
          <button class="button danger" @click="eraseAll(false)">{{ text.eraseGames }}</button>
          <button class="button danger" @click="eraseAll(true)">{{ text.eraseGamesAndSaves }}</button>
          <button class="button" @click="isConfirmingErase = false">{{ text.cancel }}</button>
        </div>
      </div>
    </section>
    <PinDialog v-if="pinAsked !== null" :locks="locks" :profile="pinAsked.profile" :purpose="pinAsked.purpose" @done="pinDone" @close="pinClosed" />
    <AboutApp />
  </main>
</template>

<style scoped>
.library {
  max-width: 880px;
  padding: 32px 16px;
}

.library.dragging {
  outline: 2px dashed var(--look-accent);
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
  color: var(--look-accent);
}

.profile-button {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  color: var(--look-text);
  cursor: pointer;
}

.profile-button .switch {
  font-weight: 400;
  color: var(--look-muted);
}

.profile-button:hover .switch,
.profile-button:focus-visible .switch {
  color: var(--look-accent);
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
  border: var(--look-control-border);
  border-radius: 6px;
  background: var(--look-surface);
  color: var(--look-text);
  cursor: pointer;
}

.load-button:focus-within {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}

.add-button {
  position: relative;
  padding: 8px 20px;
  border: 1px solid var(--look-accent);
  border-radius: 6px;
  background: var(--look-accent-fill);
  font-weight: 600;
  color: var(--look-accent);
  cursor: pointer;
}

.add-button.busy {
  opacity: 0.6;
  cursor: default;
}

.add-button:focus-within {
  outline: 2px solid var(--look-focus);
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
  color: var(--look-muted);
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
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 8px;
  background: var(--look-surface);
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
  background: var(--look-ground);
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
  color: var(--look-muted);
}

.description {
  margin: 4px 0 0;
  white-space: pre-line;
  color: var(--look-text-soft);
}

.chapters {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--look-muted);
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

.erase {
  margin-top: 40px;
}

.shelf-title {
  margin: 32px 0 0;
  font-size: 22px;
}

.shelf .hint {
  margin: 4px 0 0;
}

.samples {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 16px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.in-library {
  font-weight: 600;
  color: var(--look-success);
}

.credits {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 6px;
  background: var(--look-ground);
  font-size: 14px;
  white-space: pre-line;
  color: var(--look-text-soft);
}

.message {
  color: var(--look-success);
}

.error {
  color: var(--look-error);
}
</style>
