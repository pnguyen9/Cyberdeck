<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useShortcuts } from './shortcutStore'
import { chordOf, conflictsOf, describeChord, SHORTCUT_ACTIONS, type KeyChord, type ShortcutId, type ShortcutScreen } from './shortcuts'

const { shortcuts, isPanelOpen, change, reset, resetAll } = useShortcuts()

const SCREENS: ShortcutScreen[] = ['Storyboard', 'Editing a page', 'Everywhere']
/** Keys that change how others work, or belong to typing: shown, not changed. */
const FIXED: Record<ShortcutScreen, string[]> = {
  Storyboard: ['Shift with a move extends the selection', 'Ctrl with a move leaves the selection as it is', 'Click, Ctrl+click and Shift+click select'],
  'Editing a page': ['[ suggests a tag', '↑ ↓ choose a suggestion, Enter or Tab takes it', 'Backspace and Delete remove a tag whole, ← → step over it'],
  Everywhere: [],
}
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

/** The action waiting for its new keys, then, when they belong to others, waiting for confirmation. */
const capturing = ref<ShortcutId | null>(null)
const pending = ref<{ actionId: ShortcutId; chord: KeyChord; conflicts: ShortcutId[] } | null>(null)
const dialog = useTemplateRef<HTMLElement>('dialog')

const groups = computed(() => SCREENS.map(screen => ({
  screen,
  actions: SHORTCUT_ACTIONS.filter(action => action.screen === screen).map(action => ({ ...action, keys: shortcuts.value[action.id].map(describeChord) })),
  fixed: FIXED[screen],
})))
const labelOf = (actionId: ShortcutId) => SHORTCUT_ACTIONS.find(action => action.id === actionId)?.label ?? actionId

/** While capturing, the next keys pressed are the new shortcut; Escape gives up. */
function onKeydown(event: KeyboardEvent) {
  if (capturing.value === null) {
    if (event.key === 'Escape' && pending.value === null) {
      event.preventDefault()
      isPanelOpen.value = false
    }
    return
  }
  if (MODIFIER_KEYS.has(event.key)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const actionId = capturing.value
  capturing.value = null
  if (event.key === 'Escape') {
    return
  }
  const chord = chordOf(event)
  const conflicts = conflictsOf(shortcuts.value, actionId, chord)
  if (conflicts.length === 0) {
    change(actionId, chord)
  } else {
    pending.value = { actionId, chord, conflicts }
  }
}

function confirm() {
  if (pending.value !== null) {
    change(pending.value.actionId, pending.value.chord)
    pending.value = null
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  dialog.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <div class="backdrop" @click.self="isPanelOpen = false">
    <section ref="dialog" class="dialog" role="dialog" aria-label="Keyboard shortcuts" tabindex="-1">
      <header class="dialog-header">
        <h2>Keyboard shortcuts</h2>
        <button class="button small" @click="isPanelOpen = false">Close <kbd>Esc</kbd></button>
      </header>
      <p class="muted">Click keys to change them, then press the new ones.</p>

      <p v-if="pending !== null" class="pending" role="alert">
        {{ describeChord(pending.chord) }} already does “{{ pending.conflicts.map(labelOf).join('”, “') }}”.
        <button class="button small primary" @click="confirm">Use it for “{{ labelOf(pending.actionId) }}”</button>
        <button class="button small" @click="pending = null">Keep as it was</button>
      </p>

      <section v-for="group in groups" :key="group.screen" class="group">
        <h3 class="section-title">{{ group.screen }}</h3>
        <div v-for="action in group.actions" :key="action.id" class="row">
          <span>{{ action.label }}</span>
          <span class="keys">
            <button class="keys-button" :class="{ capturing: capturing === action.id }" @click="capturing = action.id">
              <template v-if="capturing === action.id">Press the new keys…</template>
              <template v-else-if="action.keys.length === 0">none</template>
              <kbd v-for="key in action.keys" v-else :key="key">{{ key }}</kbd>
            </button>
            <button class="link-button" @click="reset(action.id)">Default</button>
          </span>
        </div>
        <p v-for="fixed in group.fixed" :key="fixed" class="fixed muted">{{ fixed }}</p>
      </section>
      <button class="link-button" @click="resetAll">Reset every shortcut</button>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.6);
}

.dialog {
  box-sizing: border-box;
  width: min(640px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 20px 24px;
  border: 1px solid #2c3442;
  border-radius: 10px;
  background: #0b0d12;
  font: 15px/1.5 system-ui, sans-serif;
  color: #e6e9ef;
  outline: none;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h2 {
  margin: 0;
  font-size: 20px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 4px 0;
  border-bottom: 1px solid #161b24;
}

.keys {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.keys-button {
  display: flex;
  gap: 4px;
  min-width: 90px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  font: inherit;
  font-size: 13px;
  color: #a3acbb;
  cursor: pointer;
}

.keys-button:hover,
.keys-button:focus-visible,
.keys-button.capturing {
  border-color: #9eeaff;
  color: #9eeaff;
}

kbd {
  padding: 1px 6px;
  border: 1px solid #2c3442;
  border-radius: 4px;
  background: #11151d;
  font: 13px/1.4 ui-monospace, monospace;
  color: #e6e9ef;
}

.fixed {
  margin: 4px 0 0;
  font-size: 13px;
}

.pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #2a1d0b;
  color: #fbbf24;
}
</style>
