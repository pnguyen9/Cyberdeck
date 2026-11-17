import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { mergeConfig, type Plugin, type UserConfig } from 'vite'
import { fileBuild } from './fileBuild'
import { builtInSamples } from './sampleBuild'
import { SERVICE_WORKER, TAKE_OVER } from './packages/stage/src/app/offline'

/** What a web build says of its application: in the manifest, and to the page. */
export interface WebApp {
  /** `Cyberdeck` or `Datajack`. */
  name: string
  description: string
  /** The application's package folder, whose `package.json` gives the version. */
  folder: string
}

/** The colour of the applications' background, given to the system for the window and the splash screen. */
export const THEME_COLOUR = '#0b0d12'

/** The version of the application, as its `package.json` says. */
export function versionOf(folder: string): string {
  const { version } = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) as { version: string }
  return version
}

/**
 * What every build of an application's page shares: relative paths, so that the page works from any
 * folder (GitHub Pages serves it under `/Cyberdeck/cyberdeck/`), and the version, as `__APP_VERSION__`.
 * The web build (`vite build`) is also a progressive web app: a manifest, and a service worker
 * keeping the page's files for offline use. The double-click build (`--mode file`) is not: it is
 * `fileBuild`'s.
 */
export function webApp(app: WebApp, mode: string): UserConfig {
  const version = versionOf(app.folder)
  const shared: UserConfig = { base: './', define: { __APP_VERSION__: JSON.stringify(version) }, plugins: [builtInSamples()] }
  return mode === 'file' ? mergeConfig(shared, fileBuild()) : mergeConfig(shared, { plugins: [installableApp(app, version)] })
}

/** The manifest browsers read to install the application; its paths are relative to it. */
export function manifestOf(app: Pick<WebApp, 'name' | 'description'>) {
  return {
    name: app.name,
    short_name: app.name,
    description: app.description,
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: THEME_COLOUR,
    theme_color: THEME_COLOUR,
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

/** The folder of the built-in samples. */
export const SAMPLES_FOLDER = 'samples/'

/** The script of a sample: big, and wanted by few, so the service worker keeps one only once it is picked. The covers are small, and the shelves show them: they are kept. */
const isSampleScript = (path: string) => path.startsWith(SAMPLES_FOLDER) && path.endsWith('.js')

/** The files the service worker keeps, as paths relative to the page, with `/`; the worker itself and the samples' scripts left out. */
export function filesToKeep(paths: readonly string[]): string[] {
  return [...new Set(paths.map(path => path.split(sep).join('/')))]
    .filter(path => path !== SERVICE_WORKER && !path.endsWith('.map') && !isSampleScript(path))
    .sort()
}

/**
 * The name of the cache a release keeps its files in: the application's, its version, and a digest of
 * the files, so that any change makes a new service worker, which the page offers to reload for.
 */
export function cacheNameOf(appName: string, version: string, files: ReadonlyMap<string, Uint8Array | string>): string {
  const digest = createHash('sha256')
  for (const path of [...files.keys()].sort()) {
    digest.update(path).update('\0').update(files.get(path) ?? '').update('\0')
  }
  return `${appName.toLowerCase()}-${version}-${digest.digest('hex').slice(0, 12)}`
}

/** The service worker of a release: its cache name and files, the message it takes over on, then the worker's code. */
export function serviceWorkerOf(cacheName: string, appName: string, files: readonly string[], code: string): string {
  return [
    `const CACHE_PREFIX = ${JSON.stringify(`${appName.toLowerCase()}-`)}`,
    `const CACHE_NAME = ${JSON.stringify(cacheName)}`,
    `const FILES = ${JSON.stringify(files)}`,
    `const TAKE_OVER = ${JSON.stringify(TAKE_OVER)}`,
    `const SAMPLES_FOLDER = ${JSON.stringify(SAMPLES_FOLDER)}`,
    code,
  ].join('\n')
}

export const MANIFEST = 'manifest.webmanifest'

/** Every file under a folder, by its path relative to it. */
function filesUnder(folder: string, root = folder): string[] {
  return readdirSync(folder).flatMap(name => {
    const path = join(folder, name)
    return statSync(path).isDirectory() ? filesUnder(path, root) : [relative(root, path)]
  })
}

/** Adds the manifest and the service worker to the web build, once every other file is written. */
function installableApp(app: WebApp, version: string): Plugin {
  let outDir = ''
  return {
    name: 'installable-app',
    apply: 'build',
    configResolved: config => {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: html => html.replace('</title>', `</title>\n    <link rel="manifest" href="${MANIFEST}" />`),
    writeBundle: () => {
      writeFileSync(join(outDir, MANIFEST), `${JSON.stringify(manifestOf(app), null, 2)}\n`)
      const files = filesToKeep(filesUnder(outDir))
      const contents = new Map(files.map(path => [path, readFileSync(join(outDir, path))]))
      const cacheName = cacheNameOf(app.name, version, contents)
      const code = readFileSync(join(import.meta.dirname, 'serviceWorker.js'), 'utf8')
      writeFileSync(join(outDir, SERVICE_WORKER), serviceWorkerOf(cacheName, app.name, ['./', ...files], code))
    },
  }
}
