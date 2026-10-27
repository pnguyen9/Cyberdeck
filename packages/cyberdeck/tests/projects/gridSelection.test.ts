import { describe, expect, it } from 'vitest'
import { NO_SELECTION, only, rangeTo, toggle } from '../../src/projects/gridSelection'

const list = (containerId: string | null, ...ids: string[]) => ids.map(id => ({ id, containerId }))
const chapter = list(null, 'a', 'b', 'c', 'd', 'e')
const branch = list('branch', 'x', 'y')
const at = (id: string) => [...chapter, ...branch].find(element => element.id === id)!

describe('selecting in the grid', () => {
  it('extends to neighbours, either side', () => {
    let selection = toggle(NO_SELECTION, at('c'), chapter)
    selection = toggle(selection, at('d'), chapter)
    selection = toggle(selection, at('b'), chapter)
    expect(selection).toEqual({ containerId: null, ids: ['b', 'c', 'd'] })
  })

  it('starts again from an element further away, or in another list', () => {
    const selection = { containerId: null, ids: ['b', 'c'] }
    expect(toggle(selection, at('e'), chapter)).toEqual(only(at('e')))
    expect(toggle(selection, at('x'), branch)).toEqual(only(at('x')))
  })

  it('lets go of an end, and keeps one element when the middle is picked', () => {
    const selection = { containerId: null, ids: ['b', 'c', 'd'] }
    expect(toggle(selection, at('d'), chapter)).toEqual({ containerId: null, ids: ['b', 'c'] })
    expect(toggle(selection, at('c'), chapter)).toEqual(only(at('c')))
    expect(toggle(only(at('a')), at('a'), chapter)).toEqual(NO_SELECTION)
  })

  it('selects a range from the anchor within one list only', () => {
    expect(rangeTo(at('d'), at('b'), chapter)).toEqual({ containerId: null, ids: ['b', 'c', 'd'] })
    expect(rangeTo(at('d'), at('y'), branch)).toEqual(only(at('y')))
  })
})
