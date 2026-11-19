import { describe, expect, it } from 'vitest'
import { checkedProfileName, freeProfileName, profileNameProblem } from '../../electron/profileNames'

describe('profile names', () => {
  it('tells the page what is wrong, for it to say so in the player\'s language', () => {
    expect(profileNameProblem('  ', [])).toBe('length')
    expect(profileNameProblem('x'.repeat(41), [])).toBe('length')
    expect(profileNameProblem(' marie ', ['Marie'])).toBe('taken')
    expect(profileNameProblem('Marie', ['Paul'])).toBeNull()
  })

  it('throws the same refusals in English where the names are kept', () => {
    expect(() => checkedProfileName('', [])).toThrow('A profile name needs 1 to 40 characters.')
    expect(() => checkedProfileName('marie', ['Marie'])).toThrow('Another profile is already named marie.')
    expect(checkedProfileName(' Marie ', [])).toBe('Marie')
  })

  it('finds a free name for a profile imported under a name taken: the next number, shortened to fit', () => {
    expect(freeProfileName(' Marie ', ['Paul'])).toBe('Marie')
    expect(freeProfileName('Marie', ['marie', 'Marie 2'])).toBe('Marie 3')
    expect(freeProfileName('x'.repeat(40), ['x'.repeat(40)])).toBe(`${'x'.repeat(38)} 2`)
  })
})
