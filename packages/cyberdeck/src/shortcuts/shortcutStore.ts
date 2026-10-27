import { ref, shallowRef } from 'vue'
import { assignChord, DEFAULT_SHORTCUTS, loadShortcuts, saveShortcuts, SHORTCUT_ACTIONS, type KeyChord, type ShortcutId, type ShortcutMap } from './shortcuts'

/** The keys in use, shared by every screen; changes are saved in the browser at once. */
const shortcuts = shallowRef<ShortcutMap>(loadShortcuts(() => window.localStorage))
const isPanelOpen = ref(false)

function store(map: ShortcutMap) {
  shortcuts.value = map
  saveShortcuts(() => window.localStorage, map)
}

export function useShortcuts() {
  return {
    shortcuts,
    isPanelOpen,
    change: (actionId: ShortcutId, chord: KeyChord) => store(assignChord(shortcuts.value, actionId, chord)),
    reset: (actionId: ShortcutId) => store({ ...shortcuts.value, [actionId]: SHORTCUT_ACTIONS.find(action => action.id === actionId)?.defaults ?? [] }),
    resetAll: () => store(DEFAULT_SHORTCUTS),
  }
}
