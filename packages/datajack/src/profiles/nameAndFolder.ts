import { ref, watch } from 'vue'
import type { ProfileStore } from './profileStore'

/**
 * A profile's name and save folder, as the player types and picks them: a new profile's, or an
 * imported one's. `folder` is null while the default folder for the name is used.
 */
export function useNameAndFolder(store: ProfileStore) {
  const name = ref('')
  const folder = ref<string | null>(null)
  const defaultFolder = ref<string | null>(null)
  watch(name, async typed => {
    const found = await store.defaultSaveFolder(typed)
    if (typed === name.value) {
      defaultFolder.value = found
    }
  }, { immediate: true })
  return { name, folder, defaultFolder }
}
