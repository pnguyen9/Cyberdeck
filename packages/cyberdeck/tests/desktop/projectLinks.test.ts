import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { addressToOpen, isProjectLink } from '../../../desktop/src/projectLinks.js'
import { DOWNLOADS_ADDRESS } from '../../../stage/src/app/projectAddresses.js'

describe('the links the desktop page may open', () => {
  it('are the repository and the published site, and what is under them', () => {
    expect(isProjectLink('https://github.com/pnguyen9/Cyberdeck')).toBe(true)
    expect(isProjectLink('https://github.com/pnguyen9/Cyberdeck/blob/main/LICENSE')).toBe(true)
    expect(isProjectLink('https://pnguyen9.github.io/Cyberdeck/guide/')).toBe(true)
    expect(isProjectLink(DOWNLOADS_ADDRESS)).toBe(true)
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

describe('what a link opens on the desktop', () => {
  const guideFolder = join('/apps', 'Cyberdeck', 'guide')
  const copy = pathToFileURL(join(guideFolder, 'index.html')).href

  it('is the guide packaged with the application, for the online guide, its part kept', () => {
    expect(addressToOpen('https://pnguyen9.github.io/Cyberdeck/guide/', guideFolder)).toBe(copy)
    expect(addressToOpen('https://pnguyen9.github.io/Cyberdeck/guide/index.html#lists', guideFolder)).toBe(`${copy}#lists`)
  })

  it('is the online guide without a packaged copy, and any other project page as it is', () => {
    expect(addressToOpen('https://pnguyen9.github.io/Cyberdeck/guide/', null)).toBe('https://pnguyen9.github.io/Cyberdeck/guide/')
    expect(addressToOpen('https://pnguyen9.github.io/Cyberdeck/guide/images/editor.png', guideFolder)).toBe('https://pnguyen9.github.io/Cyberdeck/guide/images/editor.png')
    expect(addressToOpen('https://github.com/pnguyen9/Cyberdeck', guideFolder)).toBe('https://github.com/pnguyen9/Cyberdeck')
    expect(addressToOpen(DOWNLOADS_ADDRESS, guideFolder)).toBe('https://github.com/pnguyen9/Cyberdeck/releases/latest')
  })

  it('is nothing for an address outside the project', () => {
    expect(addressToOpen('file:///etc/passwd', guideFolder)).toBeNull()
    expect(addressToOpen('https://example.com/', guideFolder)).toBeNull()
  })
})
