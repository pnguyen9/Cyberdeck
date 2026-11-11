import { describe, expect, it } from 'vitest'
import { wantsLessMotion } from '../src/settings/lessMotion'

describe('less motion', () => {
  it('follows the system unless the player chose', () => {
    expect([wantsLessMotion('system', true), wantsLessMotion('system', false)]).toEqual([true, false])
    expect([wantsLessMotion('less', false), wantsLessMotion('full', true)]).toEqual([true, false])
  })
})
