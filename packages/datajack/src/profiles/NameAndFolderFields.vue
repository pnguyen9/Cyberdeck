<script setup lang="ts">
import { useLocale, useMessages } from '@cyberdeck/stage'
import { useTemplateRef } from 'vue'
import { MAXIMUM_PROFILE_NAME_LENGTH } from '../../electron/profileNames'
import { profileMessages } from '../i18n/profileMessages'
import type { ProfileStore } from './profileStore'

/** The name of a profile and, on the desktop, the folder its saves go to: styled by the profiles screen. */
const props = defineProps<{ store: ProfileStore; defaultFolder: string | null }>()
const name = defineModel<string>('name', { required: true })
/** Null while the default folder is used. */
const folder = defineModel<string | null>('folder', { required: true })
const locale = useLocale()
const text = useMessages(profileMessages)
const nameInput = useTemplateRef('nameInput')
defineExpose({ focus: () => nameInput.value?.focus() })

async function pickFolder() {
  const picked = await props.store.chooseFolder(locale.value)
  if (picked !== null) {
    folder.value = picked
  }
}
</script>

<template>
  <label class="field">
    <span>{{ text.name }}</span>
    <input ref="nameInput" v-model="name" class="text-input" :maxlength="MAXIMUM_PROFILE_NAME_LENGTH" autocomplete="off">
  </label>
  <div v-if="store.choosesSaveFolder" class="field">
    <span>{{ text.savesGoTo }}</span>
    <div class="folder-choice">
      <code class="folder-path">{{ folder ?? defaultFolder }}</code>
      <button class="button" type="button" @click="pickFolder">{{ text.change }}</button>
      <button v-if="folder !== null" class="link-button" type="button" @click="folder = null">{{ text.useDefault }}</button>
    </div>
  </div>
</template>
