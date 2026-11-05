import { ref, watch } from 'vue'

/** Choices of the author about the editor itself, kept in the browser. */
interface EditorSettings {
  /** Blocks holding more pages than this show as one card in the storyboard. */
  blockPageLimit: number
  /** Text exports join the pages cut from one paragraph, to read as written; otherwise each page is a paragraph. */
  paragraphsAsWritten: boolean
}

const STORAGE_KEY = 'cyberdeck:settings'
const DEFAULT_SETTINGS: EditorSettings = { blockPageLimit: 5, paragraphsAsWritten: false }

function load(): EditorSettings {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    const fields = typeof saved === 'object' && saved !== null ? saved as Partial<Record<keyof EditorSettings, unknown>> : {}
    const limit = fields.blockPageLimit
    return {
      blockPageLimit: typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 ? limit : DEFAULT_SETTINGS.blockPageLimit,
      paragraphsAsWritten: fields.paragraphsAsWritten === true,
    }
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
