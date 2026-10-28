<script setup lang="ts">
import { LanguageSelect, useLocale, useMessages, type LanguageChoice } from '@cyberdeck/stage'
import { onMounted, ref, useTemplateRef, watch } from 'vue'
import { MAXIMUM_PROFILE_NAME_LENGTH, profileNameProblem } from '../../electron/profileNames'
import { profileMessages } from '../i18n/profileMessages'
import type { Profile, ProfileList, ProfileStore } from './profileStore'

const props = defineProps<{ store: ProfileStore }>()
const emit = defineEmits<{ chosen: [profile: Profile] }>()
const languageChoice = defineModel<LanguageChoice>('languageChoice', { required: true })
const locale = useLocale()
const text = useMessages(profileMessages)

const list = ref<ProfileList>({ profiles: [], lastUsedId: null })
const isLoaded = ref(false)
const newName = ref('')
/** Null while the default folder for the name is used. */
const chosenFolder = ref<string | null>(null)
const defaultFolder = ref<string | null>(null)
const renaming = ref<{ id: string; name: string } | null>(null)
const removingId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const message = ref<string | null>(null)
const nameInput = useTemplateRef('nameInput')

onMounted(async () => {
  await refresh()
  isLoaded.value = true
  if (list.value.profiles.length === 0) {
    requestAnimationFrame(() => nameInput.value?.focus())
  }
})

watch(newName, async name => {
  const folder = await props.store.defaultSaveFolder(name)
  if (name === newName.value) {
    defaultFolder.value = folder
  }
}, { immediate: true })

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
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

/**
 * Refuses, in the player's language, what the store would refuse in English: a name blank, too
 * long or taken, a folder another profile saves in.
 */
function checkName(name: string, otherProfiles: readonly Profile[]) {
  switch (profileNameProblem(name, otherProfiles.map(other => other.name))) {
    case 'length':
      throw new Error(text.value.nameLength(MAXIMUM_PROFILE_NAME_LENGTH))
    case 'taken':
      throw new Error(text.value.nameTaken(name.trim()))
  }
}

function checkFolder(folder: string | null, otherProfiles: readonly Profile[]) {
  if (folder !== null && otherProfiles.some(other => other.saveFolder === folder)) {
    throw new Error(text.value.folderTaken)
  }
}

function choose(profile: Profile) {
  return attempt(async () => {
    await props.store.use(profile.id)
    emit('chosen', profile)
  })
}

function create() {
  return attempt(async () => {
    checkName(newName.value, list.value.profiles)
    checkFolder(chosenFolder.value, list.value.profiles)
    const profile = await props.store.create(newName.value, chosenFolder.value)
    emit('chosen', profile)
  })
}

async function pickNewProfileFolder() {
  const folder = await props.store.chooseFolder(locale.value)
  if (folder !== null) {
    chosenFolder.value = folder
  }
}

function confirmRename() {
  const target = renaming.value
  if (target === null) {
    return
  }
  return attempt(async () => {
    checkName(target.name, list.value.profiles.filter(other => other.id !== target.id))
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
    checkFolder(folder, list.value.profiles.filter(other => other.id !== profile.id))
    const change = await props.store.changeSaveFolder(profile.id, folder)
    await refresh()
    message.value = [
      text.value.nowSavesIn(profile.name, folder),
      change.moved === 0 ? '' : text.value.savesMoved(change.moved),
      change.keptInNewFolder === 0 ? '' : text.value.savesKept(change.keptInNewFolder),
    ].filter(sentence => sentence !== '').join(' ')
  })
}

function confirmRemove(profile: Profile) {
  return attempt(async () => {
    await props.store.remove(profile.id)
    removingId.value = null
    await refresh()
    message.value = text.value.removed(profile.name)
  })
}
</script>

<template>
  <main v-if="isLoaded" class="profiles">
    <header class="profiles-header">
      <h1>Datajack</h1>
      <label class="language">
        <span>{{ text.language }}</span>
        <LanguageSelect v-model="languageChoice" />
      </label>
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
            </button>
            <div class="actions">
              <button class="link-button" @click="renaming = { id: profile.id, name: profile.name }">{{ text.rename }}</button>
              <button v-if="store.choosesSaveFolder" class="link-button" @click="changeFolder(profile)">{{ text.changeSaveFolder }}</button>
              <button class="link-button" @click="removingId = profile.id">{{ text.remove }}</button>
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
      <label class="field">
        <span>{{ text.name }}</span>
        <input ref="nameInput" v-model="newName" class="text-input" :maxlength="MAXIMUM_PROFILE_NAME_LENGTH" autocomplete="off">
      </label>
      <div v-if="store.choosesSaveFolder" class="field">
        <span>{{ text.savesGoTo }}</span>
        <div class="folder-choice">
          <code class="folder-path">{{ chosenFolder ?? defaultFolder }}</code>
          <button class="button" type="button" @click="pickNewProfileFolder">{{ text.change }}</button>
          <button v-if="chosenFolder !== null" class="link-button" type="button" @click="chosenFolder = null">{{ text.useDefault }}</button>
        </div>
      </div>
      <button class="button primary" type="submit" :disabled="newName.trim() === ''">{{ text.createAndPlay }}</button>
    </form>

    <p v-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="message !== null" class="message" role="status">{{ message }}</p>
  </main>
</template>

<style scoped>
.profiles {
  box-sizing: border-box;
  max-width: 640px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 48px 16px;
  font: 16px/1.5 system-ui, sans-serif;
  color: #e6e9ef;
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
  color: #9eeaff;
}

.language {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  color: #7b8597;
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
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
}

.profile.last-used {
  border-color: #9eeaff;
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
  color: #9eeaff;
}

.folder,
.folder-path {
  font: 13px/1.4 ui-monospace, monospace;
  color: #7b8597;
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

.new-profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.hint {
  margin: -4px 0 0;
  color: #a3acbb;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.field > span {
  font-size: 14px;
  color: #a3acbb;
}

.folder-choice {
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

.text-input {
  box-sizing: border-box;
  width: 100%;
  max-width: 360px;
  padding: 8px 10px;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #0b0d12;
  font: inherit;
  color: inherit;
}

.inline-form .text-input {
  flex: 1 1 200px;
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

.button:disabled {
  opacity: 0.5;
  cursor: default;
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

.error {
  color: #f28b82;
}

.message {
  color: #a3e4b0;
}
</style>
