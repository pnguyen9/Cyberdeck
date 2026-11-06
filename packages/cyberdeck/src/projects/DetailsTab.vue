<script setup lang="ts">
import { useMessages } from '@cyberdeck/stage'
import { ref, shallowRef, watch } from 'vue'
import { detailsMessages } from '../i18n/detailsMessages'
import { readGivenFiles, useEditor } from './editorContext'

const { open, project, act } = useEditor()
const text = useMessages(detailsMessages)
const description = ref(project.value.details.description)
const credits = ref(project.value.details.credits)
const coverUrl = shallowRef<string | null>(null)

watch(() => project.value.details.coverAssetId, async coverAssetId => {
  coverUrl.value = coverAssetId === null ? null : await open.assetUrl(coverAssetId)
}, { immediate: true })

/** Saved when the field is left, so that typing is not interrupted. */
function save(field: 'description' | 'credits', value: string) {
  if (value !== project.value.details[field]) {
    void act(() => open.updateDetails({ [field]: value }), text.value.saved)
  }
}

async function chooseCover(fileList: FileList | null) {
  const [file] = await readGivenFiles(fileList)
  if (file !== undefined) {
    await act(() => open.setCover(file), text.value.coverChanged)
  }
}

/**
 * The cover's size when it is far from 16:9, the shape the library shows it in, cutting what overflows:
 * the author is told so before players see only part of it. Null for a cover close enough, or none.
 */
const coverShape = ref<{ width: number; height: number } | null>(null)
watch(coverUrl, () => {
  coverShape.value = null
})
function measureCover(event: Event) {
  const { naturalWidth: width, naturalHeight: height } = event.target as HTMLImageElement
  const isCut = width > 0 && height > 0 && Math.abs(width / height - 16 / 9) / (16 / 9) > 0.05
  coverShape.value = isCut ? { width, height } : null
}
</script>

<template>
  <section class="details">
    <p class="muted">{{ text.intro }}</p>
    <label class="field">
      <span>{{ text.description }}</span>
      <textarea v-model="description" class="text-input" rows="4" @change="save('description', description)" />
    </label>
    <label class="field">
      <span>{{ text.credits }}</span>
      <textarea v-model="credits" class="text-input" rows="6" @change="save('credits', credits)" />
    </label>

    <div class="field">
      <span>{{ text.cover }}</span>
      <div class="cover-row">
        <div class="cover" :class="{ empty: coverUrl === null }">
          <img v-if="coverUrl !== null" :src="coverUrl" :alt="text.coverAlt" @load="measureCover">
          <span v-else class="muted">{{ text.noCover }}</span>
        </div>
        <div class="cover-actions">
          <label class="button file-button">
            {{ text.chooseCover }}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.avif,.gif,.svg" @change="chooseCover(($event.target as HTMLInputElement).files)">
          </label>
          <button v-if="coverUrl !== null" class="link-button" @click="act(() => open.setCover(null), text.coverRemoved)">{{ text.removeCover }}</button>
          <span class="muted">{{ text.coverRatio }}</span>
          <span v-if="coverShape !== null" class="warning" role="note">{{ text.coverCut(coverShape.width, coverShape.height) }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}

.cover-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.cover {
  display: grid;
  place-items: center;
  width: 240px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 6px;
  background: #11151d;
}

.cover.empty {
  border: 1px dashed #2c3442;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

p {
  margin: 0;
}
</style>
