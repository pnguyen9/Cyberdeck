import { describe, expect, it } from 'vitest'
import {
  actionFor,
  assignChord,
  chordDescriber,
  conflictsOf,
  DEFAULT_SHORTCUTS,
  describeChord,
  loadShortcuts,
  saveShortcuts,
} from '../../src/shortcuts/shortcuts'

const keyEvent = (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean } = {}) =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers })

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values }
}

describe('shortcuts', () => {
  it('find the action of the screen pressed, Ctrl standing for ⌘ too', () => {
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('z', { ctrlKey: true }), 'Storyboard')).toBe('undo')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('Z', { metaKey: true }), 'Storyboard')).toBe('undo')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('Enter', { ctrlKey: true }), 'Editing a page')).toBe('save')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('Enter', { ctrlKey: true }), 'Storyboard')).toBeNull()
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('ArrowLeft', { ctrlKey: true, shiftKey: true }), 'Storyboard')).toBe('moveSelectionBack')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent(' '), 'Storyboard')).toBe('toggleSelected')
  })

  it('let Shift extend the selection while the focus moves, whatever its keys', () => {
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('ArrowRight', { shiftKey: true }), 'Storyboard')).toBe('focusNext')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('ArrowDown', { ctrlKey: true, shiftKey: true }), 'Storyboard')).toBe('moveSelectionDown')
  })

  it('ignore Shift on symbols, which some keyboards need it for', () => {
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('?', { shiftKey: true }), 'Storyboard')).toBe('showShortcuts')
    expect(actionFor(DEFAULT_SHORTCUTS, keyEvent('?'), 'Editing a page')).toBe('showShortcuts')
  })

  it('are described as people write them', () => {
    expect(DEFAULT_SHORTCUTS.moveSelectionBack.map(describeChord)).toEqual(['Ctrl+Shift+←'])
    expect(DEFAULT_SHORTCUTS.toggleSelected.map(describeChord)).toEqual(['Space'])
    expect(DEFAULT_SHORTCUTS.addPage.map(describeChord)).toEqual(['N'])
  })

  it('are described with the key names of French keyboards', () => {
    const describeInFrench = chordDescriber('fr')
    expect(DEFAULT_SHORTCUTS.moveSelectionBack.map(describeInFrench)).toEqual(['Ctrl+Maj+←'])
    expect(DEFAULT_SHORTCUTS.toggleSelected.map(describeInFrench)).toEqual(['Espace'])
    expect(DEFAULT_SHORTCUTS.remove.map(describeInFrench)).toEqual(['Suppr', 'Retour arrière'])
    expect(DEFAULT_SHORTCUTS.save.map(describeInFrench)).toEqual(['Ctrl+Entrée'])
  })

  it('take keys from the action that had them, and say so first', () => {
    const chord = { key: 'n', ctrl: false, alt: false, shift: false }
    expect(conflictsOf(DEFAULT_SHORTCUTS, 'edit', chord)).toEqual(['addPage'])
    const changed = assignChord(DEFAULT_SHORTCUTS, 'edit', chord)
    expect(changed.edit).toEqual([chord])
    expect(changed.addPage).toEqual([])
    expect(conflictsOf(DEFAULT_SHORTCUTS, 'save', chord)).toEqual([])
  })

  it('keep only the changes, and fall back to the defaults on unreadable storage', () => {
    const storage = memoryStorage()
    const changed = assignChord(DEFAULT_SHORTCUTS, 'addPage', { key: 'k', ctrl: false, alt: false, shift: false })
    saveShortcuts(() => storage, changed)
    expect(JSON.parse(storage.values.get('cyberdeck:shortcuts')!)).toEqual({ addPage: [{ key: 'k', ctrl: false, alt: false, shift: false }] })
    expect(loadShortcuts(() => storage)).toEqual(changed)

    storage.setItem('cyberdeck:shortcuts', '{ broken')
    expect(loadShortcuts(() => storage)).toEqual(DEFAULT_SHORTCUTS)
    expect(loadShortcuts(() => { throw new Error('storage disabled') })).toEqual(DEFAULT_SHORTCUTS)
  })
})
