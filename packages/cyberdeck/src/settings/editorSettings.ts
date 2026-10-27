import { ref, watch } from 'vue'

/** Choices of the author about the editor itself, kept in the browser. */
interface EditorSettings {
  /** Blocks holding more pages than this show as one card in the storyboard. */
  blockPageLimit: number
}

const STORAGE_KEY = 'cyberdeck:settings'
const DEFAULT_SETTINGS: EditorSettings = { blockPageLimit: 5 }

function load(): EditorSettings {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    const limit = typeof saved === 'object' && saved !== null ? (saved as { blockPageLimit?: unknown }).blockPageLimit : undefined
    return { blockPageLimit: typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? limit : DEFAULT_SETTINGS.blockPageLimit }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const settings = ref<EditorSettings>(load())
watch(settings, value => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Unsaved, the setting lasts until the page is closed.
  }
}, { deep: true })

export function useEditorSettings() {
  return settings
}
