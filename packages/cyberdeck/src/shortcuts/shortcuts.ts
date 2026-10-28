import type { Locale } from '@cyberdeck/stage'
import { shortcutMessages } from '../i18n/shortcutMessages'

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

/** Where shortcuts apply, named in English: `shortcutMessages` says them in each language. */
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
  | 'goToBoard'
  | 'togglePanel'
  | 'previousTab'
  | 'nextTab'
  | 'tabChapters'
  | 'tabStoryboard'
  | 'tabImport'
  | 'tabCast'
  | 'tabDetails'
  | 'tabDefinitions'
  | 'tabIndex'
  | 'tabExport'

export interface ShortcutAction {
  id: ShortcutId
  screen: ShortcutScreen
  defaults: readonly KeyChord[]
  /** Moving the focus: Shift extends the selection, whatever the key. */
  isFocusMove?: boolean
}

export type ShortcutMap = Readonly<Record<ShortcutId, readonly KeyChord[]>>

const chord = (key: string, modifiers: Partial<Omit<KeyChord, 'key'>> = {}): KeyChord => ({ key, ctrl: false, alt: false, shift: false, ...modifiers })

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [
  { id: 'focusPrevious', screen: 'Storyboard', defaults: [chord('ArrowLeft')], isFocusMove: true },
  { id: 'focusNext', screen: 'Storyboard', defaults: [chord('ArrowRight')], isFocusMove: true },
  { id: 'focusAbove', screen: 'Storyboard', defaults: [chord('ArrowUp')], isFocusMove: true },
  { id: 'focusBelow', screen: 'Storyboard', defaults: [chord('ArrowDown')], isFocusMove: true },
  { id: 'focusFirst', screen: 'Storyboard', defaults: [chord('Home')], isFocusMove: true },
  { id: 'focusLast', screen: 'Storyboard', defaults: [chord('End')], isFocusMove: true },
  { id: 'toggleSelected', screen: 'Storyboard', defaults: [chord(' ')] },
  { id: 'selectAll', screen: 'Storyboard', defaults: [chord('a', { ctrl: true })] },
  { id: 'moveSelectionBack', screen: 'Storyboard', defaults: [chord('ArrowLeft', { ctrl: true, shift: true })] },
  { id: 'moveSelectionForward', screen: 'Storyboard', defaults: [chord('ArrowRight', { ctrl: true, shift: true })] },
  { id: 'moveSelectionUp', screen: 'Storyboard', defaults: [chord('ArrowUp', { ctrl: true, shift: true })] },
  { id: 'moveSelectionDown', screen: 'Storyboard', defaults: [chord('ArrowDown', { ctrl: true, shift: true })] },
  { id: 'cut', screen: 'Storyboard', defaults: [chord('x', { ctrl: true })] },
  { id: 'paste', screen: 'Storyboard', defaults: [chord('v', { ctrl: true })] },
  { id: 'edit', screen: 'Storyboard', defaults: [chord('Enter')] },
  { id: 'leave', screen: 'Storyboard', defaults: [chord('Escape')] },
  { id: 'addPage', screen: 'Storyboard', defaults: [chord('n')] },
  { id: 'previewFromHere', screen: 'Storyboard', defaults: [chord('p')] },
  { id: 'remove', screen: 'Storyboard', defaults: [chord('Delete'), chord('Backspace')] },
  { id: 'undo', screen: 'Storyboard', defaults: [chord('z', { ctrl: true })] },
  { id: 'save', screen: 'Editing a page', defaults: [chord('Enter', { ctrl: true })] },
  { id: 'cancel', screen: 'Editing a page', defaults: [chord('Escape')] },
  { id: 'showShortcuts', screen: 'Everywhere', defaults: [chord('?')] },
  // With Alt, so that they work while typing a page too; Alt+digits are the browsers' own.
  { id: 'goToBoard', screen: 'Everywhere', defaults: [chord('g', { alt: true })] },
  { id: 'togglePanel', screen: 'Everywhere', defaults: [chord('p', { alt: true })] },
  { id: 'previousTab', screen: 'Everywhere', defaults: [chord('PageUp', { alt: true })] },
  { id: 'nextTab', screen: 'Everywhere', defaults: [chord('PageDown', { alt: true })] },
  { id: 'tabChapters', screen: 'Everywhere', defaults: [] },
  { id: 'tabStoryboard', screen: 'Everywhere', defaults: [] },
  { id: 'tabImport', screen: 'Everywhere', defaults: [] },
  { id: 'tabCast', screen: 'Everywhere', defaults: [] },
  { id: 'tabDetails', screen: 'Everywhere', defaults: [] },
  { id: 'tabDefinitions', screen: 'Everywhere', defaults: [] },
  { id: 'tabIndex', screen: 'Everywhere', defaults: [] },
  { id: 'tabExport', screen: 'Everywhere', defaults: [] },
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

/** Keys described as the keyboards of `locale` name them: `Ctrl+Maj+←` in French. */
export function chordDescriber(locale: Locale): (chord: KeyChord) => string {
  const text = shortcutMessages[locale]
  return chord => {
    const key = text.keyNames[chord.key] ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key)
    return [chord.ctrl ? text.ctrl : '', chord.alt ? text.alt : '', chord.shift ? text.shift : '', key].filter(part => part !== '').join('+')
  }
}

export const describeChord = chordDescriber('en')

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
