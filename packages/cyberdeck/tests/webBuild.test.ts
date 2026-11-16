import { describe, expect, it } from 'vitest'
import { cacheNameOf, filesToKeep, manifestOf, serviceWorkerOf, versionOf, webApp } from '../../../webBuild'

const folder = new URL('..', import.meta.url).pathname

describe('the web build', () => {
  it('uses relative paths and gives the page its version, in every build', () => {
    for (const mode of ['production', 'file']) {
      const config = webApp({ name: 'Cyberdeck', description: '', folder }, mode)
      expect(config.base).toBe('./')
      expect(config.define).toEqual({ __APP_VERSION__: JSON.stringify(versionOf(folder)) })
    }
    expect(versionOf(folder)).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('is installable, except as files to double-click', () => {
    expect(webApp({ name: 'Cyberdeck', description: '', folder }, 'production').plugins).toHaveLength(1)
    expect(webApp({ name: 'Cyberdeck', description: '', folder }, 'file').plugins).toEqual([])
  })

  it('has a manifest whose paths stay in the application’s folder', () => {
    const manifest = manifestOf({ name: 'Datajack', description: 'The player.' })
    expect(manifest).toMatchObject({ name: 'Datajack', start_url: './', scope: './', display: 'standalone' })
    expect(manifest.icons.map(icon => icon.src).every(source => !source.startsWith('/') && !source.includes(':'))).toBe(true)
    expect(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true)
  })

  it('keeps every file of the release but the worker and source maps, with forward slashes', () => {
    expect(filesToKeep(['index.html', 'sw.js', 'assets/index-1.js', 'assets/index-1.js.map', 'icon.svg', 'assets/index-1.js']))
      .toEqual(['assets/index-1.js', 'icon.svg', 'index.html'])
  })

  it('names the cache by the application, its version and its files', () => {
    const files = new Map([['index.html', '<html>'], ['assets/a.js', 'one']])
    const name = cacheNameOf('Cyberdeck', '3.3.0', files)
    expect(name).toMatch(/^cyberdeck-3\.3\.0-[0-9a-f]{12}$/)
    expect(cacheNameOf('Cyberdeck', '3.3.0', new Map([...files].reverse()))).toBe(name)
    expect(cacheNameOf('Cyberdeck', '3.3.0', new Map([...files, ['assets/a.js', 'two']]))).not.toBe(name)
    expect(cacheNameOf('Cyberdeck', '3.3.1', files)).not.toBe(name)
  })

  it('writes the worker with what it keeps, its cache apart from the other application’s', () => {
    const code = serviceWorkerOf('datajack-3.3.0-abc', 'Datajack', ['./', 'index.html'], '// the code')
    expect(code.split('\n')).toEqual([
      'const CACHE_PREFIX = "datajack-"',
      'const CACHE_NAME = "datajack-3.3.0-abc"',
      'const FILES = ["./","index.html"]',
      '// the code',
    ])
  })
})
