import { describe, expect, it } from 'vitest'
import {
  actionForKey,
  actionForMouseButton,
  actionForWheel,
  DEFAULT_BINDINGS,
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

  it('does not add an input twice to the same action', () => {
    const rebound = rebind(DEFAULT_BINDINGS, 'back', { type: 'key', code: 'ArrowLeft' })
    expect(rebound.back.filter(binding => binding.type === 'key' && binding.code === 'ArrowLeft')).toHaveLength(1)
  })
})
