<script setup lang="ts">
import { useMessages } from '@cyberdeck/stage'
import { onMounted, ref } from 'vue'
import { editorMessages } from '../i18n/editorMessages'

/** Asks what to do with changes not saved, before what would lose them: the first button takes the focus. */
defineProps<{ question: string; canSave: boolean; cannotSaveReason?: string }>()
const emit = defineEmits<{ save: []; discard: []; keep: [] }>()
const saveButton = ref<HTMLButtonElement | null>(null)
onMounted(() => saveButton.value?.focus())
const text = useMessages(editorMessages)
</script>

<template>
  <div class="pending" role="alertdialog" :aria-label="text.unsavedChanges">
    <p>{{ question }}</p>
    <p v-if="!canSave && cannotSaveReason !== undefined" class="muted">{{ cannotSaveReason }}</p>
    <div class="pending-actions">
      <button ref="saveButton" class="button primary small" :disabled="!canSave" @click="emit('save')">{{ text.save }}</button>
      <button class="button small danger" @click="emit('discard')">{{ text.discard }}</button>
      <button class="button small" @click="emit('keep')">{{ text.keepEditing }}</button>
    </div>
  </div>
</template>

<style scoped>
.pending {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #f5c451;
  border-radius: 8px;
  background: rgb(245 196 81 / 0.08);
}

.pending p {
  margin: 0 0 8px;
}

.pending-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
