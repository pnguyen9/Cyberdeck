import { describe, expect, it } from 'vitest'
import { closestStageKeyword, DEFAULT_POSITION_PRESETS, interpretStageDirective } from '../src/index'

const DEFAULT_POSITION_NAMES = DEFAULT_POSITION_PRESETS.map(preset => preset.name)

const interpret = (name: string, directiveArguments: string[], characterNames: string[] = [], positionNames: string[] = DEFAULT_POSITION_NAMES) =>
  interpretStageDirective({ name, arguments: directiveArguments }, { characterNames, positionNames })

describe('interpretStageDirective', () => {
  it('reads backgrounds, transitions and music', () => {
    expect(interpret('bg', ['rooftop'])).toEqual({ type: 'background', background: 'rooftop' })
    expect(interpret('background', ['old', 'school'])).toEqual({ type: 'background', background: 'old school' })
    expect(interpret('transition', ['fade'])).toEqual({ type: 'transition', name: 'fade', durationMs: null })
    expect(interpret('transition', ['Black', '1.5s'])).toEqual({ type: 'transition', name: 'black', durationMs: 1500 })
    expect(interpret('music', ['calm'])).toEqual({ type: 'music', track: 'calm' })
    expect(interpret('music', ['Stop'])).toEqual({ type: 'music', track: null })
  })

  const noAnimation = { kind: null, durationMs: null, wait: false }

  it('reads entrances in any order after the name, leaving position, facing and animation to defaults', () => {
    expect(interpret('enter', ['marie'])).toEqual({
      type: 'enter', character: 'marie', position: null, facing: null, depth: null, expression: null, animation: noAnimation,
    })
    expect(interpret('enter', ['marie', 'smile', 'left'])).toMatchObject({ position: { type: 'preset', name: 'left' }, expression: 'smile' })
    expect(interpret('enter', ['marie', 'centre'])).toMatchObject({ position: { type: 'preset', name: 'center' }, expression: null })
  })

  it('reads depth in entrances and moves, and moves to a depth alone', () => {
    expect(interpret('enter', ['marie', 'near', 'left'])).toMatchObject({ depth: 'near', position: { type: 'preset', name: 'left' } })
    expect(interpret('move', ['marie', 'far'])).toEqual({ type: 'move', character: 'marie', position: null, depth: 'far', animation: noAnimation })
    expect(interpret('move', ['marie'])).toBeNull()
    expect(interpret('exit', ['marie', 'far'])).toBeNull()
    expect(interpret('enter', ['marie', 'near', 'far'])).toBeNull()
  })

  it('reads exact positions as percentages of the stage width', () => {
    expect(interpret('enter', ['marie', '35%'])).toMatchObject({ position: { type: 'exact', x: 35 } })
    expect(interpret('enter', ['marie', '12.5%'])).toMatchObject({ position: { type: 'exact', x: 12.5 } })
    expect(interpret('enter', ['marie', '150%'])).toBeNull()
  })

  it('reads facing, animation, duration and waiting', () => {
    expect(interpret('enter', ['marie', 'slide-from-right', '1.2s', 'wait', 'facing-left'])).toMatchObject({
      facing: 'left',
      animation: { kind: 'slide-from-right', durationMs: 1200, wait: true },
    })
    expect(interpret('enter', ['marie', 'fade', '500ms'])).toMatchObject({ animation: { kind: 'fade', durationMs: 500, wait: false } })
  })

  it('reads the project\'s own positions, and takes unknown ones for expressions', () => {
    expect(interpret('enter', ['marie', 'doorway'], [], [...DEFAULT_POSITION_NAMES, 'doorway']))
      .toMatchObject({ position: { type: 'preset', name: 'doorway' }, expression: null })
    expect(interpret('enter', ['marie', 'doorway'])).toMatchObject({ position: null, expression: 'doorway' })
  })

  it('reads a character name of several words when the character is known', () => {
    expect(interpret('enter', ['Old', 'Marie', 'right', 'sad'], ['Old Marie']))
      .toMatchObject({ character: 'Old Marie', position: { type: 'preset', name: 'right' }, expression: 'sad' })
  })

  it('reads exits and moves, the name being every word before the first keyword', () => {
    expect(interpret('exit', ['old', 'marie'])).toEqual({ type: 'exit', character: 'old marie', animation: noAnimation })
    expect(interpret('exit', ['marie', 'slide-to-left', '2s'])).toEqual({
      type: 'exit', character: 'marie', animation: { kind: 'slide-to-left', durationMs: 2000, wait: false },
    })
    expect(interpret('move', ['old', 'marie', 'left'])).toEqual({
      type: 'move', character: 'old marie', position: { type: 'preset', name: 'left' }, depth: null, animation: noAnimation,
    })
    expect(interpret('move', ['marie', '35%', 'instant'])).toMatchObject({ position: { type: 'exact', x: 35 }, animation: { kind: 'instant' } })
  })

  it('refuses words that do not fit the directive, rather than guess', () => {
    expect(interpret('enter', ['marie', 'slide-to-left'])).toBeNull()
    expect(interpret('enter', ['marie', 'left', 'right'])).toBeNull()
    expect(interpret('enter', ['marie', 'smile', 'fdae'])).toBeNull()
    expect(interpret('exit', ['marie', 'slide-from-left'])).toBeNull()
    expect(interpret('exit', ['marie', 'fade', 'smile'])).toBeNull()
    expect(interpret('move', ['marie', 'left', 'fade'])).toBeNull()
  })

  it('reads any other name as a character changing expression', () => {
    expect(interpret('marie', ['surprised'])).toEqual({ type: 'expression', character: 'marie', expression: 'surprised' })
    expect(interpret('old marie', ['sad'])).toEqual({ type: 'expression', character: 'old marie', expression: 'sad' })
  })

  it('reads screen effects: shakes, flashes, fades and tints, leaving durations to defaults', () => {
    expect(interpret('shake', [])).toEqual({ type: 'shake', strength: 'light', durationMs: null })
    expect(interpret('shake', ['0.4s', 'strong'])).toEqual({ type: 'shake', strength: 'strong', durationMs: 400 })
    expect(interpret('flash', [])).toEqual({ type: 'flash', color: 'white', durationMs: null })
    expect(interpret('flash', ['red', '200ms'])).toEqual({ type: 'flash', color: 'red', durationMs: 200 })
    expect(interpret('fade out', [])).toEqual({ type: 'fade', direction: 'out', color: 'black', durationMs: null })
    expect(interpret('fade out', ['white', '2'])).toEqual({ type: 'fade', direction: 'out', color: 'white', durationMs: 2000 })
    expect(interpret('fade in', ['1.5s'])).toEqual({ type: 'fade', direction: 'in', color: 'black', durationMs: 1500 })
    expect(interpret('tint', ['Sepia'])).toEqual({ type: 'tint', tint: 'sepia' })
    expect(interpret('tint', ['none'])).toEqual({ type: 'tint', tint: null })
  })

  it('refuses effects it cannot play, rather than guess', () => {
    expect(interpret('shake', ['hard'])).toBeNull()
    expect(interpret('flash', ['purple'])).toBeNull()
    expect(interpret('fade in', ['white'])).toBeNull()
    expect(interpret('fade out', ['1s', '2s'])).toBeNull()
    expect(interpret('tint', [])).toBeNull()
    expect(interpret('tint', ['purple'])).toBeNull()
  })

  it('reads pauses, half a second by default', () => {
    expect(interpret('wait', ['1.5'])).toEqual({ type: 'wait', seconds: 1.5 })
    expect(interpret('wait', [])).toEqual({ type: 'wait', seconds: 0.5 })
  })

  it('refuses directives missing what they need', () => {
    expect(interpret('bg', [])).toBeNull()
    expect(interpret('music', [])).toBeNull()
    expect(interpret('transition', [])).toBeNull()
    expect(interpret('enter', [])).toBeNull()
    expect(interpret('enter', ['left'])).toBeNull()
    expect(interpret('exit', [])).toBeNull()
    expect(interpret('move', ['marie'])).toBeNull()
    expect(interpret('move', ['marie', 'upstairs'])).toBeNull()
    expect(interpret('wait', ['soon'])).toBeNull()
    expect(interpret('marie', [])).toBeNull()
  })
})

describe('closestStageKeyword', () => {
  it('suggests the keyword a misspelled directive was meant to be', () => {
    expect(closestStageKeyword('backgound')).toBe('background')
    expect(closestStageKeyword('entre')).toBe('enter')
    expect(closestStageKeyword('musik')).toBe('music')
    expect(closestStageKeyword('lopp')).toBe('loop')
  })

  it('suggests nothing for keywords themselves and for names far from any keyword', () => {
    expect(closestStageKeyword('enter')).toBeNull()
    expect(closestStageKeyword('marie')).toBeNull()
    expect(closestStageKeyword('jules')).toBeNull()
    expect(closestStageKeyword('seth')).toBeNull()
  })
})
