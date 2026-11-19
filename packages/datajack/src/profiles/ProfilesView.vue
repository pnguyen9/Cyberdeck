<script setup lang="ts">
import { AboutApp, NewVersionBar, LanguageSelect, useLocale, useMessages, type LanguageChoice } from '@cyberdeck/stage'
import { nextTick, onMounted, onUnmounted, ref, shallowRef, useTemplateRef } from 'vue'
import { freeProfileName, MAXIMUM_PROFILE_NAME_LENGTH, profileNameProblem } from '../../electron/profileNames'
import { describeError } from '../i18n/errorMessages'
import { pinMessages } from '../i18n/pinMessages'
import { profileMessages } from '../i18n/profileMessages'
import LockIcon from './LockIcon.vue'
import NameAndFolderFields from './NameAndFolderFields.vue'
import { useNameAndFolder } from './nameAndFolder'
import { usePinAsk } from './pinAsk'
import PinDialog from './PinDialog.vue'
import { profileFileName, readProfileFile, type ProfileContents, type ProfileTransfer } from './profileFile'
import type { ProfileLocks } from './profileLocks'
import type { Profile, ProfileList, ProfileStore } from './profileStore'

/** `entering`: the profile Datajack opened last, which asks for its PIN before opening again. */
const props = defineProps<{ store: ProfileStore; locks: ProfileLocks; transfer: ProfileTransfer; entering?: string | null }>()
const emit = defineEmits<{ chosen: [profile: Profile] }>()
const languageChoice = defineModel<LanguageChoice>('languageChoice', { required: true })
const locale = useLocale()
const text = useMessages(profileMessages)
const pinText = useMessages(pinMessages)
/** A profile with a PIN asks for it before opening, and before being renamed, moved, exported or removed. */
const { asked: pinAsked, withPin, pinDone, pinClosed } = usePinAsk(props.locks)

const list = ref<ProfileList>({ profiles: [], lastUsedId: null })
const isLoaded = ref(false)
const { name: newName, folder: newFolder, defaultFolder: newDefaultFolder } = useNameAndFolder(props.store)
const renaming = ref<{ id: string; name: string } | null>(null)
const removingId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const message = ref<string | null>(null)
const newFields = useTemplateRef('newFields')

onMounted(async () => {
  await refresh()
  isLoaded.value = true
  if (list.value.profiles.length === 0) {
    requestAnimationFrame(() => newFields.value?.focus())
  }
  const entering = list.value.profiles.find(profile => profile.id === props.entering)
  if (entering !== undefined) {
    choose(entering)
  }
})

async function refresh() {
  list.value = await props.store.list()
}

/** Runs a change, showing its error to the player instead of failing silently. */
async function attempt(change: () => Promise<void>) {
  errorMessage.value = null
  message.value = null
  try {
    await change()
  } catch (error) {
    errorMessage.value = describeError(error, locale.value)
  }
}

/**
 * Refuses, in the player's language, what the store would refuse in English: a name blank, too
 * long or taken, a folder another profile saves in.
 */
function checkNameAndFolder(name: string, folder: string | null, otherProfiles: readonly Profile[]) {
  switch (profileNameProblem(name, otherProfiles.map(other => other.name))) {
    case 'length':
      throw new Error(text.value.nameLength(MAXIMUM_PROFILE_NAME_LENGTH))
    case 'taken':
      throw new Error(text.value.nameTaken(name.trim()))
  }
  if (folder !== null && otherProfiles.some(other => other.saveFolder === folder)) {
    throw new Error(text.value.folderTaken)
  }
}

function choose(profile: Profile) {
  withPin(profile, 'enter', () => attempt(async () => {
    await props.store.use(profile.id)
    emit('chosen', profile)
  }))
}

function create() {
  return attempt(async () => {
    checkNameAndFolder(newName.value, newFolder.value, list.value.profiles)
    const profile = await props.store.create(newName.value, newFolder.value)
    emit('chosen', profile)
  })
}

function confirmRename() {
  const target = renaming.value
  if (target === null) {
    return
  }
  return attempt(async () => {
    checkNameAndFolder(target.name, null, list.value.profiles.filter(other => other.id !== target.id))
    await props.store.rename(target.id, target.name)
    renaming.value = null
    await refresh()
  })
}

function changeFolder(profile: Profile) {
  return attempt(async () => {
    const folder = await props.store.chooseFolder(locale.value)
    if (folder === null) {
      return
    }
    checkNameAndFolder(profile.name, folder, list.value.profiles.filter(other => other.id !== profile.id))
    const change = await props.store.changeSaveFolder(profile.id, folder)
    await refresh()
    message.value = [
      text.value.nowSavesIn(profile.name, folder),
      change.moved === 0 ? '' : text.value.savesMoved(change.moved),
      change.keptInNewFolder === 0 ? '' : text.value.savesKept(change.keptInNewFolder),
    ].filter(sentence => sentence !== '').join(' ')
  })
}

/** The profile file being made, then offered to save, by the profile it is of; its address once made. */
const exported = shallowRef<{ profileId: string; fileName: string; url: string | null } | null>(null)
/** The link saving the file, for the keyboard to land on once the file is made. */
const saveLinks = useTemplateRef<HTMLElement[]>('saveLink')

function closeExport() {
  if (exported.value?.url != null) {
    URL.revokeObjectURL(exported.value.url)
  }
  exported.value = null
}
onUnmounted(closeExport)

/** A profile with a PIN asks for it before its file is made: the file holds its saves, readable by anyone. */
function exportProfile(profile: Profile) {
  withPin(profile, 'confirm', async () => {
    closeExport()
    errorMessage.value = null
    message.value = null
    const shown = { profileId: profile.id, fileName: profileFileName(profile.name, locale.value), url: null }
    exported.value = shown
    try {
      const url = URL.createObjectURL(new Blob([await props.transfer.exportFile(profile)], { type: 'application/zip' }))
      if (exported.value === shown) {
        exported.value = { ...shown, url }
        await nextTick()
        saveLinks.value?.[0]?.focus()
      } else {
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      exported.value = null
      errorMessage.value = text.value.exportFailed(profile.name, describeError(error, locale.value))
    }
  })
}

/**
 * A profile file read, checked whole before anything changes, then imported as a new profile under
 * the name the player confirms: the file's, or a free one when another profile has it.
 */
type Importing =
  | { step: 'reading' }
  | { step: 'name'; contents: ProfileContents; fileName: string; taken: { name: string; freeName: string } | null }
const importing = shallowRef<Importing | null>(null)
const isImporting = ref(false)
const { name: importName, folder: importFolder, defaultFolder: importDefaultFolder } = useNameAndFolder(props.store)

/** The file picked; the field emptied, so that the same file picked again is read again. */
async function importChosen(input: HTMLInputElement) {
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) {
    return
  }
  closeExport()
  errorMessage.value = null
  message.value = null
  importing.value = { step: 'reading' }
  try {
    const contents = await readProfileFile(new Uint8Array(await file.arrayBuffer()))
    await refresh()
    const fileName = contents.profile.name.trim()
    const otherNames = list.value.profiles.map(profile => profile.name)
    const freeName = freeProfileName(fileName, otherNames)
    importName.value = freeName
    importFolder.value = null
    importing.value = { step: 'name', contents, fileName, taken: freeName === fileName ? null : { name: fileName, freeName } }
  } catch (error) {
    importing.value = null
    errorMessage.value = text.value.fileError(file.name, describeError(error, locale.value))
  }
}

function confirmImport() {
  const shown = importing.value
  if (shown?.step !== 'name') {
    return
  }
  return attempt(async () => {
    isImporting.value = true
    try {
      checkNameAndFolder(importName.value, importFolder.value, list.value.profiles)
      const outcome = await props.transfer.importFile(shown.contents, importName.value, importFolder.value)
      importing.value = null
      await refresh()
      message.value = text.value.imported(outcome.profile.name, outcome.games, outcome.saves)
    } finally {
      isImporting.value = false
    }
  })
}

function confirmRemove(profile: Profile) {
  return attempt(async () => {
    await props.transfer.remove(profile)
    removingId.value = null
    await refresh()
    message.value = text.value.removed(profile.name)
  })
}
</script>

<template>
  <main v-if="isLoaded" class="app-screen profiles">
    <NewVersionBar />
    <header class="profiles-header">
      <h1>Datajack</h1>
      <div class="header-tools">
        <label class="language-field">
          <span>{{ text.language }}</span>
          <LanguageSelect v-model="languageChoice" />
        </label>
      </div>
    </header>

    <template v-if="list.profiles.length > 0">
      <h2>{{ text.whoIsPlaying }}</h2>
      <ul class="profile-list">
        <li v-for="profile in list.profiles" :key="profile.id" class="profile" :class="{ 'last-used': profile.id === list.lastUsedId }">
          <form v-if="renaming?.id === profile.id" class="inline-form" @submit.prevent="confirmRename">
            <input v-model="renaming.name" class="text-input" :maxlength="MAXIMUM_PROFILE_NAME_LENGTH" :aria-label="text.newName" autocomplete="off">
            <button class="button primary" type="submit">{{ text.rename }}</button>
            <button class="button" type="button" @click="renaming = null">{{ text.cancel }}</button>
          </form>

          <div v-else-if="removingId === profile.id" class="confirmation">
            <p>
              {{ text.confirmRemove(profile.name) }}
              <template v-if="profile.saveFolder !== null">{{ text.savesStayIn(profile.saveFolder) }}</template>
              <template v-else>{{ text.savesDeleted }}</template>
              {{ text.exportFirst }}
            </p>
            <div class="actions">
              <button class="button danger" @click="confirmRemove(profile)">{{ text.remove }}</button>
              <button class="button" @click="removingId = null">{{ text.cancel }}</button>
            </div>
          </div>

          <template v-else>
            <button class="play-profile" @click="choose(profile)">
              <span class="profile-name">{{ profile.name }}</span>
              <span v-if="profile.saveFolder !== null" class="folder">{{ profile.saveFolder }}</span>
              <span v-if="locks.isLocked(profile.id)" class="locked"><LockIcon /> {{ pinText.lockedBadge }}</span>
            </button>
            <div class="actions">
              <button class="link-button" @click="withPin(profile, 'confirm', () => renaming = { id: profile.id, name: profile.name })">{{ text.rename }}</button>
              <button v-if="store.choosesSaveFolder" class="link-button" @click="withPin(profile, 'confirm', () => changeFolder(profile))">{{ text.changeSaveFolder }}</button>
              <button class="link-button" @click="exportProfile(profile)">{{ text.export }}</button>
              <button class="link-button" @click="withPin(profile, 'confirm', () => removingId = profile.id)">{{ text.remove }}</button>
            </div>
            <div v-if="exported?.profileId === profile.id" class="export-panel">
              <p v-if="exported.url === null" role="status">{{ text.exporting }}</p>
              <template v-else>
                <p role="status">{{ text.exportReady(profile.name, locks.isLocked(profile.id)) }}</p>
                <p class="hint">{{ text.notEncrypted }}</p>
                <div class="export-actions">
                  <a ref="saveLink" class="button primary download" :href="exported.url" :download="exported.fileName">{{ text.saveProfileFile }}</a>
                  <button class="button" @click="closeExport">{{ text.close }}</button>
                </div>
              </template>
            </div>
          </template>
        </li>
      </ul>
    </template>

    <form class="new-profile" @submit.prevent="create">
      <h2>{{ list.profiles.length === 0 ? text.createYourProfile : text.newProfile }}</h2>
      <p v-if="list.profiles.length === 0" class="hint">
        {{ text.profileKeepsSaves }}<template v-if="store.choosesSaveFolder">{{ text.inFolderOfYourChoice }}</template>.
        {{ text.opensDirectly }}
      </p>
      <NameAndFolderFields ref="newFields" v-model:name="newName" v-model:folder="newFolder" :store="store" :default-folder="newDefaultFolder" />
      <button class="button primary" type="submit" :disabled="newName.trim() === ''">{{ text.createAndPlay }}</button>
    </form>

    <section class="import-profile">
      <h2>{{ text.importProfile }}</h2>
      <template v-if="importing === null">
        <p class="hint">{{ text.importHint }}</p>
        <label class="button import-button">
          <input class="file-input" type="file" accept=".zip,application/zip" @change="importChosen($event.target as HTMLInputElement)">
          {{ text.chooseProfileFile }}
        </label>
      </template>
      <p v-else-if="importing.step === 'reading'" role="status">{{ text.reading }}</p>
      <form v-else class="import-form" @submit.prevent="confirmImport">
        <p>{{ text.fileHolds(importing.fileName, importing.contents.exportedAt) }}</p>
        <p v-if="importing.taken !== null" class="hint">{{ text.nameTakenUse(importing.taken.name, importing.taken.freeName) }}</p>
        <NameAndFolderFields v-model:name="importName" v-model:folder="importFolder" :store="store" :default-folder="importDefaultFolder" />
        <div class="import-actions">
          <button class="button primary" type="submit" :disabled="importName.trim() === '' || isImporting">{{ text.importNamed(importName.trim() || importing.fileName) }}</button>
          <button class="button" type="button" :disabled="isImporting" @click="importing = null">{{ text.cancel }}</button>
        </div>
      </form>
    </section>

    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
    <PinDialog v-if="pinAsked !== null" :locks="locks" :profile="pinAsked.profile" :purpose="pinAsked.purpose" @done="pinDone" @close="pinClosed" />
    <AboutApp />
  </main>
</template>

<style scoped>
.profiles {
  max-width: 640px;
  padding: 48px 16px;
}

.profiles-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px 16px;
  margin: 0 0 32px;
}

h1 {
  margin: 0;
  font-size: 28px;
  color: var(--look-accent);
}

h2 {
  margin: 0 0 12px;
  font-size: 20px;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 0 40px;
  padding: 0;
  list-style: none;
}

.profile {
  padding: 12px 16px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 8px;
  background: var(--look-surface);
}

.profile.last-used {
  border-color: var(--look-accent);
}

.play-profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
}

.play-profile:hover .profile-name,
.play-profile:focus-visible .profile-name {
  color: var(--look-accent);
}

.locked {
  font-size: 13px;
  color: var(--look-muted);
}

.folder,
.profiles :deep(.folder-path) {
  font: 13px/1.4 ui-monospace, monospace;
  color: var(--look-muted);
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
}

.confirmation p {
  margin: 0;
}

.export-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
}

.export-panel p {
  margin: 0 0 8px;
}

.export-actions,
.import-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.download {
  text-decoration: none;
}

.import-profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 40px;
}

.import-profile h2 {
  margin: 0;
}

.import-profile .hint {
  margin: 0;
}

.import-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}

.import-button {
  position: relative;
}

.import-button:focus-within {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.new-profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.hint {
  margin: -4px 0 0;
  color: var(--look-soft);
}

.profiles :deep(.field) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.profiles :deep(.field > span) {
  font-size: 14px;
  color: var(--look-soft);
}

.profiles :deep(.folder-choice) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profiles :deep(.text-input) {
  box-sizing: border-box;
  width: 100%;
  max-width: 360px;
  padding: 8px 10px;
  border: var(--look-control-border);
  border-radius: 6px;
  background: var(--look-ground);
  font: inherit;
  color: inherit;
}

.inline-form .text-input {
  flex: 1 1 200px;
}

.error {
  color: var(--look-error);
}

.message {
  color: var(--look-success);
}
</style>
