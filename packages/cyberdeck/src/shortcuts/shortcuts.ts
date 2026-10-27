/**
 * The editor's keyboard shortcuts: what each action is, where it applies, and its keys. Authors
 * may change the keys; their choices are kept in the browser, over the defaults.
 */

/** A key and the modifiers held with it. `key` is `KeyboardEvent.key`, letters in lower case; Ctrl stands for ⌘ on a Mac. */
export interface KeyChord {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
}

export type ShortcutScreen = 'Storyboard' | 'Editing a page' | 'Everywhere'

export type ShortcutId =
  | 'focusPrevious'
  | 'focusNext'
  | 'focusAbove'
  | 'focusBelow'
  | 'focusFirst'
  | 'focusLast'
  | 'moveSelectionBack'
  | 'moveSelectionForward'
  | 'moveSelectionUp'
  | 'moveSelectionDown'
  | 'cut'
  | 'paste'
  | 'leave'
  | 'toggleSelected'
  | 'selectAll'
  | 'edit'
  | 'addPage'
  | 'previewFromHere'
  | 'remove'
  | 'undo'
  | 'save'
  | 'cancel'
  | 'showShortcuts'

export interface ShortcutAction {
  id: ShortcutId
  label: string
  screen: ShortcutScreen
  defaults: readonly KeyChord[]
  /** Moving the focus: Shift extends the selection, whatever the key. */
  isFocusMove?: boolean
}

export type ShortcutMap = Readonly<Record<ShortcutId, readonly KeyChord[]>>

const chord = (key: string, modifiers: Partial<Omit<KeyChord, 'key'>> = {}): KeyChord => ({ key, ctrl: false, alt: false, shift: false, ...modifiers })

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [
  { id: 'focusPrevious', label: 'Previous card', screen: 'Storyboard', defaults: [chord('ArrowLeft')], isFocusMove: true },
  { id: 'focusNext', label: 'Next card', screen: 'Storyboard', defaults: [chord('ArrowRight')], isFocusMove: true },
  { id: 'focusAbove', label: 'Card above', screen: 'Storyboard', defaults: [chord('ArrowUp')], isFocusMove: true },
  { id: 'focusBelow', label: 'Card below', screen: 'Storyboard', defaults: [chord('ArrowDown')], isFocusMove: true },
  { id: 'focusFirst', label: 'First card', screen: 'Storyboard', defaults: [chord('Home')], isFocusMove: true },
  { id: 'focusLast', label: 'Last card', screen: 'Storyboard', defaults: [chord('End')], isFocusMove: true },
  { id: 'toggleSelected', label: 'Select the card, or let it go', screen: 'Storyboard', defaults: [chord(' ')] },
  { id: 'selectAll', label: 'Select its whole list', screen: 'Storyboard', defaults: [chord('a', { ctrl: true })] },
  { id: 'moveSelectionBack', label: 'Move the selection back', screen: 'Storyboard', defaults: [chord('ArrowLeft', { ctrl: true, shift: true })] },
  { id: 'moveSelectionForward', label: 'Move the selection forward', screen: 'Storyboard', defaults: [chord('ArrowRight', { ctrl: true, shift: true })] },
  { id: 'moveSelectionUp', label: 'Move the selection up a row', screen: 'Storyboard', defaults: [chord('ArrowUp', { ctrl: true, shift: true })] },
  { id: 'moveSelectionDown', label: 'Move the selection down a row', screen: 'Storyboard', defaults: [chord('ArrowDown', { ctrl: true, shift: true })] },
  { id: 'cut', label: 'Cut the selection, to move it elsewhere', screen: 'Storyboard', defaults: [chord('x', { ctrl: true })] },
  { id: 'paste', label: 'Put what was cut after the card', screen: 'Storyboard', defaults: [chord('v', { ctrl: true })] },
  { id: 'edit', label: 'Edit the card, or open the block', screen: 'Storyboard', defaults: [chord('Enter')] },
  { id: 'leave', label: 'Let go of the selection, or leave the block', screen: 'Storyboard', defaults: [chord('Escape')] },
  { id: 'addPage', label: 'Add a page after', screen: 'Storyboard', defaults: [chord('n')] },
  { id: 'previewFromHere', label: 'Preview from the card', screen: 'Storyboard', defaults: [chord('p')] },
  { id: 'remove', label: 'Remove the selection', screen: 'Storyboard', defaults: [chord('Delete'), chord('Backspace')] },
  { id: 'undo', label: 'Undo', screen: 'Storyboard', defaults: [chord('z', { ctrl: true })] },
  { id: 'save', label: 'Save the page', screen: 'Editing a page', defaults: [chord('Enter', { ctrl: true })] },
  { id: 'cancel', label: 'Cancel the edit', screen: 'Editing a page', defaults: [chord('Escape')] },
  { id: 'showShortcuts', label: 'Show the shortcuts', screen: 'Everywhere', defaults: [chord('?')] },
]

export const DEFAULT_SHORTCUTS: ShortcutMap = Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action.id, action.defaults])) as ShortcutMap

/** Keys that are a symbol need Shift on some keyboards and not others: Shift does not count for them. */
function isSymbol(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase() && key !== ' '
}

export function chordOf(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): KeyChord {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  return { key, ctrl: event.ctrlKey || event.metaKey, alt: event.altKey, shift: event.shiftKey && !isSymbol(key) }
}

/** The action of the screen (or of every screen) whose keys were pressed, or null. */
export function actionFor(map: ShortcutMap, event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, screen: ShortcutScreen): ShortcutId | null {
  const pressed = chordOf(event)
  const action = SHORTCUT_ACTIONS.find(candidate => (candidate.screen === screen || candidate.screen === 'Everywhere')
    && map[candidate.id].some(bound => bound.key === pressed.key && bound.alt === pressed.alt
      && bound.ctrl === pressed.ctrl && (candidate.isFocusMove === true || bound.shift === pressed.shift)))
  return action?.id ?? null
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Delete: 'Del',
}

export function describeChord(chord: KeyChord): string {
  const key = KEY_NAMES[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key)
  return [chord.ctrl ? 'Ctrl' : '', chord.alt ? 'Alt' : '', chord.shift ? 'Shift' : '', key].filter(part => part !== '').join('+')
}

/** Actions already using the keys where the action applies: they would both answer. */
export function conflictsOf(map: ShortcutMap, actionId: ShortcutId, chord: KeyChord): ShortcutId[] {
  const screen = SHORTCUT_ACTIONS.find(action => action.id === actionId)?.screen
  return SHORTCUT_ACTIONS
    .filter(action => action.id !== actionId && (action.screen === screen || action.screen === 'Everywhere' || screen === 'Everywhere'))
    .filter(action => map[action.id].some(bound => sameChord(bound, chord)))
    .map(action => action.id)
}

/** Gives the keys to the action, taking them from the actions that had them. */
export function assignChord(map: ShortcutMap, actionId: ShortcutId, chord: KeyChord): ShortcutMap {
  const conflicts = new Set(conflictsOf(map, actionId, chord))
  return Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action.id, action.id === actionId
    ? [chord]
    : conflicts.has(action.id) ? map[action.id].filter(bound => !sameChord(bound, chord)) : map[action.id]])) as ShortcutMap
}

const STORAGE_KEY = 'cyberdeck:shortcuts'

/** The defaults, with the keys the author changed; storage that is missing or unreadable gives the defaults. */
export function loadShortcuts(getStorage: () => Pick<Storage, 'getItem'>): ShortcutMap {
  try {
    const saved: unknown = JSON.parse(getStorage().getItem(STORAGE_KEY) ?? '{}')
    const changed = typeof saved === 'object' && saved !== null ? saved as Record<string, unknown> : {}
    return Object.fromEntries(SHORTCUT_ACTIONS.map(action => {
      const chords = changed[action.id]
      return [action.id, Array.isArray(chords) && chords.every(isChord) ? chords : action.defaults]
    })) as ShortcutMap
  } catch {
    return DEFAULT_SHORTCUTS
  }
}

/** Keeps only what differs from the defaults, so that later defaults reach authors who never changed them. */
export function saveShortcuts(getStorage: () => Pick<Storage, 'setItem'>, map: ShortcutMap) {
  const changed = Object.fromEntries(SHORTCUT_ACTIONS
    .filter(action => JSON.stringify(map[action.id]) !== JSON.stringify(action.defaults))
    .map(action => [action.id, map[action.id]]))
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(changed))
  } catch {
    // Unsaved, the change lasts until the page is closed.
  }
}

function sameChord(first: KeyChord, second: KeyChord): boolean {
  return first.key === second.key && first.ctrl === second.ctrl && first.alt === second.alt && first.shift === second.shift
}

function isChord(value: unknown): value is KeyChord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const fields = value as Record<string, unknown>
  return typeof fields.key === 'string' && typeof fields.ctrl === 'boolean' && typeof fields.alt === 'boolean' && typeof fields.shift === 'boolean'
}
