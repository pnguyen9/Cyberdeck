// Runs the browser checks: `npm run checks [-- name…]`, or `npm run checks:desktop` for those of the desktop builds.
// A check runs against Cyberdeck's development server unless it exports another `app`: 'datajack', or a
// desktop build, 'cyberdeck-desktop' or 'datajack-desktop', which runs only when named or with --desktop.
// Each check gets a fresh Chrome profile, or a fresh home folder for a desktop build; screenshots and
// results land in checks/output/<check>/.
import { spawn } from 'node:child_process'
import { mkdirSync, openSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openBrowser, openElectron, pause } from './harness.mjs'

const checksFolder = dirname(fileURLToPath(import.meta.url))
const rootFolder = join(checksFolder, '..')
const outputFolder = join(checksFolder, 'output')
const CHROME_PORT = 9334
const ELECTRON_PORT = 9335
/** Development servers; ports outside the list browsers refuse to fetch from. */
const SERVERS = {
  cyberdeck: { port: 4178, folder: join(rootFolder, 'packages/cyberdeck') },
  datajack: { port: 4177, folder: join(rootFolder, 'packages/datajack') },
}
const DESKTOP_APPS = {
  'cyberdeck-desktop': join(rootFolder, 'packages/cyberdeck'),
  'datajack-desktop': join(rootFolder, 'packages/datajack'),
}

const isDesktopRun = process.argv.includes('--desktop')
const asked = process.argv.slice(2).filter(argument => argument !== '--desktop')
const checks = []
for (const fileName of readdirSync(checksFolder).filter(candidate => candidate.endsWith('.check.mjs')).sort()) {
  const name = fileName.slice(0, -'.check.mjs'.length)
  const module = await import(pathToFileURL(join(checksFolder, fileName)).href)
  const app = module.app ?? 'cyberdeck'
  const isDesktop = app in DESKTOP_APPS
  if (asked.length > 0 ? asked.includes(name) : isDesktop === isDesktopRun) {
    checks.push({ name, app, check: module.default })
  }
}
if (checks.length === 0) {
  console.error(`No check named ${asked.join(', ')}`)
  process.exit(1)
}

// Inherited from VS Code's terminal, this setting would make Vite's and Electron's child processes plain Node.
const { ELECTRON_RUN_AS_NODE: _ignored, ...environment } = process.env
mkdirSync(outputFolder, { recursive: true })
const vite = join(rootFolder, 'node_modules/vite/bin/vite.js')

/** Runs a command with this Node (the one first on the PATH may be another version), its output in a log. */
function runNode(argumentsList, folder, logName) {
  const log = openSync(join(outputFolder, logName), 'w')
  return spawn(process.execPath, argumentsList, { cwd: folder, env: environment, stdio: ['ignore', log, log] })
}

const servers = new Map()

/** The address of an application's development server, started on first use. */
async function serve(app) {
  if (!servers.has(app)) {
    const { port, folder } = SERVERS[app]
    const url = `http://127.0.0.1:${port}/`
    const server = runNode([vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], folder, `server-${app}.log`)
    servers.set(app, { server, url })
    for (let attempt = 0; ; attempt++) {
      try {
        await fetch(url)
        break
      } catch (error) {
        if (attempt === 100) {
          throw new Error(`The development server of ${app} did not start on port ${port} (${error.cause?.message ?? error.message}): see checks/output/server-${app}.log`)
        }
        await pause(200)
      }
    }
  }
  return servers.get(app).url
}

/** Builds a desktop application as `npm run build:desktop` does: the page, then each Electron process. */
async function buildDesktop(app) {
  const folder = DESKTOP_APPS[app]
  for (const [step, argumentsList] of [
    ['page', [vite, 'build']],
    ['main', [vite, 'build', '--config', 'vite.electron.config.ts', '--mode', 'main']],
    ['preload', [vite, 'build', '--config', 'vite.electron.config.ts', '--mode', 'preload']],
  ]) {
    const exitCode = await new Promise(resolve => runNode(argumentsList, folder, `build-${app}.log`).on('exit', resolve))
    if (exitCode !== 0) {
      throw new Error(`Building ${app} failed at its ${step}: see checks/output/build-${app}.log`)
    }
  }
}

/** The test assets of make-test-assets.mjs, written once per run. */
async function writeAssets() {
  const assets = join(outputFolder, 'assets')
  rmSync(assets, { recursive: true, force: true })
  const exitCode = await new Promise(resolve => runNode([join(checksFolder, 'make-test-assets.mjs'), assets], checksFolder, 'assets.log').on('exit', resolve))
  if (exitCode !== 0) {
    throw new Error('Writing the test assets failed: see checks/output/assets.log')
  }
  return assets
}

let failures = 0
try {
  const assets = await writeAssets()
  const built = new Set()
  for (const { name, app, check } of checks) {
    const output = join(outputFolder, name)
    const context = { fixtures: join(checksFolder, 'fixtures'), assets, output, serve }
    let page
    if (app in DESKTOP_APPS) {
      if (!built.has(app)) {
        await buildDesktop(app)
        built.add(app)
      }
      const home = join(output, 'home')
      rmSync(home, { recursive: true, force: true })
      page = await openElectron(output, ELECTRON_PORT, { electron: join(rootFolder, 'node_modules/electron/dist/electron'), appFolder: DESKTOP_APPS[app], home })
      context.home = home
    } else {
      context.url = await serve(app)
      page = await openBrowser(output, CHROME_PORT)
    }
    try {
      await check(page, context)
    } catch (error) {
      page.results.push(`FAIL ${name} stopped: ${error instanceof Error ? error.message : error}`)
    } finally {
      await page.close()
    }
    failures += page.results.filter(result => result.startsWith('FAIL')).length
    console.log(`\n${name}\n${page.results.map(result => `  ${result}`).join('\n')}`)
    await pause(300)
  }
} finally {
  for (const { server } of servers.values()) {
    server.kill()
  }
}
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failed.`)
process.exit(failures === 0 ? 0 : 1)
