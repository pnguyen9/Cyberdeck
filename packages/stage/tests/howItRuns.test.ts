import { describe, expect, it } from 'vitest'
import { howItRuns, isHosted, keepsOffline } from '../src/app/howItRuns'

describe('how an application runs', () => {
  it('is the desktop build whenever the desktop shell hands its bridge', () => {
    expect(howItRuns({ hasDesktopBridge: true, protocol: 'cyberdeck:', isStandalone: false })).toBe('desktop')
    expect(howItRuns({ hasDesktopBridge: true, protocol: 'https:', isStandalone: true })).toBe('desktop')
  })

  it('is the double-click build from files', () => {
    expect(howItRuns({ hasDesktopBridge: false, protocol: 'file:', isStandalone: false })).toBe('files')
  })

  it('is a web page, or installed when it has a window of its own', () => {
    expect(howItRuns({ hasDesktopBridge: false, protocol: 'https:', isStandalone: false })).toBe('web')
    expect(howItRuns({ hasDesktopBridge: false, protocol: 'https:', isStandalone: true })).toBe('installed')
    expect(howItRuns({ hasDesktopBridge: false, protocol: 'http:', isStandalone: false })).toBe('web')
  })

  it('is hosted, and keeps offline, as a web page or installed only', () => {
    expect((['desktop', 'files', 'web', 'installed'] as const).map(isHosted)).toEqual([false, false, true, true])
    expect((['desktop', 'files', 'web', 'installed'] as const).map(how => keepsOffline(how, true))).toEqual([false, false, true, true])
  })

  it('never keeps the development server offline', () => {
    expect(keepsOffline('web', false)).toBe(false)
    expect(keepsOffline('installed', false)).toBe(false)
  })
})
