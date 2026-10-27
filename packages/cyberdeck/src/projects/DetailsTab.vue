<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { readGivenFiles, useEditor } from './editorContext'

const { open, project, act } = useEditor()
const description = ref(project.value.details.description)
const credits = ref(project.value.details.credits)
const coverUrl = shallowRef<string | null>(null)

watch(() => project.value.details.coverAssetId, async coverAssetId => {
  coverUrl.value = coverAssetId === null ? null : await open.assetUrl(coverAssetId)
}, { immediate: true })

/** Saved when the field is left, so that typing is not interrupted. */
function save(field: 'description' | 'credits', value: string) {
  if (value !== project.value.details[field]) {
    void act(() => open.updateDetails({ [field]: value }), 'Saved.')
  }
}

async function chooseCover(fileList: FileList | null) {
  const [file] = await readGivenFiles(fileList)
  if (file !== undefined) {
    await act(() => open.setCover(file), 'The cover was changed.')
  }
}
</script>

<template>
  <section class="details">
    <p class="muted">What players see of the game in their library, before playing it.</p>
    <label class="field">
      <span>Description</span>
      <textarea v-model="description" class="text-input" rows="4" @change="save('description', description)" />
    </label>
    <label class="field">
      <span>Credits: who wrote, drew and composed, and the licences of borrowed music or art</span>
      <textarea v-model="credits" class="text-input" rows="6" @change="save('credits', credits)" />
    </label>

    <div class="field">
      <span>Cover</span>
      <div class="cover-row">
        <div class="cover" :class="{ empty: coverUrl === null }">
          <img v-if="coverUrl !== null" :src="coverUrl" alt="The cover">
          <span v-else class="muted">No cover</span>
        </div>
        <div class="cover-actions">
          <label class="button file-button">
            Choose a cover…
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml" @change="chooseCover(($event.target as HTMLInputElement).files)">
          </label>
          <button v-if="coverUrl !== null" class="link-button" @click="act(() => open.setCover(null), 'The cover was removed.')">Remove the cover</button>
          <span class="muted">Shown at 16:9 in the library.</span>
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
