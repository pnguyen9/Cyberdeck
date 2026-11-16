import { describe, expect, it } from 'vitest'
import { isProjectLink } from '../../../desktop/src/projectLinks.js'

describe('the links the desktop page may open', () => {
  it('are the repository and the published site, and what is under them', () => {
    expect(isProjectLink('https://github.com/pnguyen9/Cyberdeck')).toBe(true)
    expect(isProjectLink('https://github.com/pnguyen9/Cyberdeck/blob/main/LICENSE')).toBe(true)
    expect(isProjectLink('https://pnguyen9.github.io/Cyberdeck/guide/')).toBe(true)
  })

  it('are nothing else', () => {
    expect(isProjectLink('https://github.com/pnguyen9/CyberdeckEvil')).toBe(false)
    expect(isProjectLink('https://github.com/someone/Cyberdeck')).toBe(false)
    expect(isProjectLink('http://github.com/pnguyen9/Cyberdeck')).toBe(false)
    expect(isProjectLink('https://pnguyen9.github.io/Other/')).toBe(false)
    expect(isProjectLink('https://user@github.com/pnguyen9/Cyberdeck')).toBe(false)
    expect(isProjectLink('file:///etc/passwd')).toBe(false)
    expect(isProjectLink('not an address')).toBe(false)
  })
})
