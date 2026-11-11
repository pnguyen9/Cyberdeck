import { describe, expect, it } from 'vitest'
import {
  actionForKey,
  actionForMouseButton,
  actionForWheel,
  actionOf,
  DEFAULT_BINDINGS,
  describeInput,
  marksTile,
  MOUSE_BUTTON,
  rebind,
} from '../src/input/bindings'

describe('bindings', () => {
  it('maps the default keys, by physical position', () => {
    expect(actionForKey(DEFAULT_BINDINGS, 'Space')).toBe('advance')
    expect(actionForKey(DEFAULT_BINDINGS, 'ArrowLeft')).toBe('back')
    expect(actionForKey(DEFAULT_BINDINGS, 'Escape')).toBe('leave')
    expect(actionForKey(DEFAULT_BINDINGS, 'KeyQ')).toBeNull()
  })

  it('maps the mouse buttons and the wheel', () => {
    expect(actionForMouseButton(DEFAULT_BINDINGS, MOUSE_BUTTON.main)).toBe('advance')
    expect(actionForMouseButton(DEFAULT_BINDINGS, MOUSE_BUTTON.back)).toBe('back')
    expect(actionForMouseButton(DEFAULT_BINDINGS, MOUSE_BUTTON.forward)).toBe('advance')
    expect(actionForWheel(DEFAULT_BINDINGS, -120)).toBe('back')
    expect(actionForWheel(DEFAULT_BINDINGS, 120)).toBe('advance')
    expect(actionForWheel(DEFAULT_BINDINGS, 0)).toBeNull()
  })

  it('moves an input to another action, so that one input never triggers two actions', () => {
    const rebound = rebind(DEFAULT_BINDINGS, 'back', { type: 'key', code: 'Space' })

    expect(actionForKey(rebound, 'Space')).toBe('back')
    expect(rebound.advance).not.toContainEqual({ type: 'key', code: 'Space' })
    expect(actionForKey(DEFAULT_BINDINGS, 'Space')).toBe('advance')
  })

  it('shares inputs between marking a tile and the everyday actions, which keep them everywhere else', () => {
    const f = { type: 'key', code: 'KeyF' } as const
    const rightClick = { type: 'mouseButton', button: MOUSE_BUTTON.secondary } as const
    expect([actionForKey(DEFAULT_BINDINGS, 'KeyF'), actionForMouseButton(DEFAULT_BINDINGS, MOUSE_BUTTON.secondary)]).toEqual(['fullscreen', 'hideText'])
    expect([marksTile(DEFAULT_BINDINGS, f), marksTile(DEFAULT_BINDINGS, rightClick)]).toEqual([true, true])

    // Given to marking, an input stays with its everyday action; given to an everyday action, it stays with marking.
    const markingWithG = rebind(DEFAULT_BINDINGS, 'markTile', { type: 'key', code: 'KeyG' })
    expect(actionForKey(markingWithG, 'KeyG')).toBeNull()
    const logWithF = rebind(DEFAULT_BINDINGS, 'log', f)
    expect([actionForKey(logWithF, 'KeyF'), marksTile(logWithF, f)]).toEqual(['log', true])
    expect(actionOf(DEFAULT_BINDINGS, f, 'log')).toBe('fullscreen')
    expect(actionOf(DEFAULT_BINDINGS, f, 'markTile')).toBe('markTile')
  })

  it('does not add an input twice to the same action', () => {
    const rebound = rebind(DEFAULT_BINDINGS, 'back', { type: 'key', code: 'ArrowLeft' })
    expect(rebound.back.filter(binding => binding.type === 'key' && binding.code === 'ArrowLeft')).toHaveLength(1)
  })

  it('names inputs as players of each language call them, English by default', () => {
    const inputs = [
      { type: 'key', code: 'Enter' },
      { type: 'key', code: 'Escape' },
      { type: 'key', code: 'Space' },
      { type: 'key', code: 'Backspace' },
      { type: 'key', code: 'PageUp' },
      { type: 'key', code: 'NumpadEnter' },
      { type: 'key', code: 'Numpad5' },
      { type: 'key', code: 'NumpadAdd' },
      { type: 'key', code: 'KeyL' },
      { type: 'key', code: 'Digit3' },
      { type: 'mouseButton', button: MOUSE_BUTTON.secondary },
      { type: 'mouseButton', button: MOUSE_BUTTON.back },
      { type: 'mouseButton', button: 7 },
      { type: 'wheel', direction: 'up' },
    ] as const

    expect(inputs.map(input => describeInput(input))).toEqual([
      'Enter', 'Esc', 'Space', 'Backspace', 'Page Up', 'Keypad Enter', 'Keypad 5', 'Keypad Add', 'L', '3',
      'Right click', 'Mouse back button', 'Mouse button 8', 'Wheel up',
    ])
    expect(inputs.map(input => describeInput(input, 'fr'))).toEqual([
      'Entrée', 'Échap', 'Espace', 'Retour arrière', 'Page préc.', 'Entrée (pavé numérique)', '5 (pavé numérique)', '+ (pavé numérique)', 'L', '3',
      'Clic droit', 'Bouton Précédent de la souris', 'Bouton 8 de la souris', 'Molette vers le haut',
    ])
  })
})
