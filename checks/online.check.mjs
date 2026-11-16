// Both applications online, as GitHub Pages serves them: the site of `npm run pages` under /Cyberdeck/,
// each application's version and About panel, the note that a browser may erase what a site keeps,
// storage names apart, the service worker keeping each application offline, a new version offered and
// taken. Also: no service worker on the development server, nor in the double-click build.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createProfile, createProject, pause } from './harness.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site = join(root, 'site')
const PORT = 4179 + Number(process.env.CHECKS_PORT_OFFSET ?? 0) * 10
const MEDIA_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.md': 'text/markdown', '.webp': 'image/webp', '.jpg': 'image/jpeg',
}

/** A static host like GitHub Pages: the site under /Cyberdeck/, folders answered by their index.html. */
function startHost() {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://host').pathname)
    if (!path.startsWith('/Cyberdeck/')) {
      response.writeHead(404).end()
      return
    }
    const relativePath = normalize(path.slice('/Cyberdeck/'.length))
    const file = join(site, relativePath.endsWith('/') || relativePath === '.' ? join(relativePath, 'index.html') : relativePath)
    if (!file.startsWith(site)) {
      response.writeHead(404).end()
      return
    }
    try {
      const body = readFileSync(file)
      response.writeHead(200, { 'Content-Type': MEDIA_TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  return new Promise(resolve => server.listen(PORT, '127.0.0.1', () => resolve(server)))
}

export default async function check(page, { url }) {
  const waitUntil = async (expression, timeoutMilliseconds = 15000) => {
    for (let waited = 0; waited < timeoutMilliseconds; waited += 200) {
      if (await page.evaluate(expression)) {
        return true
      }
      await pause(200)
    }
    return false
  }
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

  // The development server: the version and the note, but no service worker, whose files would go stale.
  await page.navigate(url)
  await page.waitFor('.about-app')
  page.check('the development server shows the version', await page.evaluate(`document.querySelector('.about-app .version')?.textContent`), `Cyberdeck ${version}`)
  page.check('and registers no service worker', await page.evaluate(`navigator.serviceWorker.getRegistrations().then(list => list.length)`), 0)

  execFileSync(process.execPath, [join(root, 'scripts', 'pagesSite.mjs')], { cwd: root, stdio: 'ignore' })
  let host = await startHost()
  const siteUrl = `http://127.0.0.1:${PORT}/Cyberdeck/`
  try {
    await page.navigate(siteUrl)
    page.check('the landing page links both applications and the guide', await page.evaluate(`[...document.querySelectorAll('a')].map(link => link.getAttribute('href')).filter(href => !href.startsWith('https:'))`), ['cyberdeck/', 'datajack/', 'guide/'])
    await page.screenshot('landing')
    await page.navigate(`${siteUrl}guide/`)
    page.check('the guide is online', await page.evaluate(`document.title`), 'Cyberdeck Guide')

    // Cyberdeck, from its folder: relative paths, its version, the note, its service worker.
    await page.navigate(`${siteUrl}cyberdeck/`)
    await page.watchViolations()
    page.check('Cyberdeck opens under a folder', await page.waitFor('.about-app'), true)
    page.check('with its version', await page.evaluate(`document.querySelector('.about-app .version')?.textContent`), `Cyberdeck ${version}`)
    page.check('saying a browser may erase what it keeps, and to back up', await page.evaluate(`document.querySelector('.may-erase')?.textContent`),
      'A browser may erase what a site keeps (Safari does after about seven days without a visit, unless the app is installed). Keep a backup of each project (Back up, at the top of the project).')
    page.check('its manifest is linked', await page.evaluate(`fetch(document.querySelector('link[rel=manifest]').href).then(response => response.json()).then(manifest => [manifest.name, manifest.start_url, manifest.icons.length])`), ['Cyberdeck', './', 4])
    page.check('its service worker takes the page’s folder', await waitUntil(`navigator.serviceWorker.ready.then(registration => registration.active !== null)`), true)
    page.check('scoped to the folder', await page.evaluate(`navigator.serviceWorker.getRegistration().then(registration => new URL(registration.scope).pathname)`), '/Cyberdeck/cyberdeck/')
    await page.screenshot('cyberdeck')

    await page.clickButton('About', '.about-button')
    await pause(300)
    page.check('the About panel gives the version and how it runs', await page.evaluate(`[...document.querySelectorAll('.about-panel p')].slice(0, 2).map(paragraph => paragraph.textContent)`),
      [`Version ${version}`, 'Runs as a web page: what it keeps stays in this browser, on this device.'])
    page.check('the license and the links', await page.evaluate(`[...document.querySelectorAll('.about-panel a')].map(link => link.textContent + ' ' + link.href)`), [
      'Unlicense https://github.com/pnguyen9/Cyberdeck/blob/main/LICENSE',
      'Guide https://pnguyen9.github.io/Cyberdeck/guide/',
      'Source code and downloads (GitHub) https://github.com/pnguyen9/Cyberdeck',
    ])
    page.check('the panel has the focus', await page.evaluate(`document.activeElement?.classList.contains('about-panel')`), true)
    await page.screenshot('about')
    await page.press('Escape')
    await pause(200)
    page.check('Escape closes it', await page.evaluate(`document.querySelector('.about-panel') === null`), true)

    page.check('Cyberdeck broke no rule of its security policy', await page.violations(), '[]')
    await createProject(page, `${siteUrl}cyberdeck/`, 'Online story')
    page.check('a project is made online', await page.evaluate(`!!document.querySelector('.import .source')`), true)
    page.check('Cyberdeck’s storage names keep its prefix', await page.evaluate(`(async () => [
      ...Object.keys(localStorage).filter(key => !key.startsWith('cyberdeck:')),
      ...(await indexedDB.databases()).map(database => database.name).filter(name => !name.startsWith('cyberdeck')),
    ])()`), [])

    // Datajack beside it on the same site.
    await createProfile(page, `${siteUrl}datajack/`, 'Pascal')
    await page.watchViolations()
    page.check('Datajack opens under its folder, its library with its version', await page.evaluate(`document.querySelector('.library .about-app .version')?.textContent`), `Datajack ${version}`)
    page.check('saying to keep games and saves as files', (await page.evaluate(`document.querySelector('.may-erase')?.textContent`))?.endsWith('Keep each game’s archive, and your progress and saves as files (Progress to a file; Save to a file, in a game’s saves).'), true)
    page.check('its service worker is its own', await waitUntil(`navigator.serviceWorker.getRegistration().then(registration => registration?.active !== null && new URL(registration.scope).pathname === '/Cyberdeck/datajack/')`), true)
    page.check('each application keeps its files in its own cache', await page.evaluate(`caches.keys().then(names => names.map(name => name.replace(/-[0-9a-f]{12}$/, '')).sort())`), [`cyberdeck-${version}`, `datajack-${version}`])
    page.check('storage names stay apart on the shared site', await page.evaluate(`(async () => {
      const keys = Object.keys(localStorage)
      const databases = (await indexedDB.databases()).map(database => database.name).sort()
      return [keys.every(key => key.startsWith('cyberdeck:') || key.startsWith('datajack:')), keys.some(key => key.startsWith('datajack:')), databases]
    })()`), [true, true, ['cyberdeck-projects', 'datajack-library']])
    page.check('nor Datajack, its service worker running', await page.violations(), '[]')
    await page.screenshot('datajack')

    // Offline: the host gone, both still open, with what they keep.
    await new Promise(resolve => host.close(resolve))
    host.closeAllConnections?.()
    await page.navigate(`${siteUrl}cyberdeck/`)
    page.check('offline, Cyberdeck opens from its service worker', await page.waitFor('.projects'), true)
    page.check('with its project', await page.evaluate(`document.querySelector('.project-name')?.textContent`), 'Online story')
    await page.navigate(`${siteUrl}datajack/`)
    page.check('offline, Datajack opens too', await page.waitFor('.library'), true)
    await page.screenshot('datajack-offline')

    // A new version online: offered, and taken on Reload.
    const workerPath = join(site, 'cyberdeck', 'sw.js')
    const worker = readFileSync(workerPath, 'utf8')
    const cacheName = /const CACHE_NAME = "([^"]+)"/.exec(worker)[1]
    writeFileSync(workerPath, worker.replace(`const CACHE_NAME = "${cacheName}"`, `const CACHE_NAME = "${cacheName}-next"`))
    host = await startHost()
    await page.navigate(`${siteUrl}cyberdeck/`)
    page.check('a new version is offered', await waitUntil(`!!document.querySelector('.new-version')`, 20000), true)
    page.check('in words', await page.evaluate(`document.querySelector('.new-version span')?.textContent`), 'A new version of Cyberdeck is online.')
    await page.screenshot('new-version')
    await page.clickButton('Reload', '.new-version button')
    await pause(2500)
    await page.waitFor('.about-app')
    page.check('Reload takes it, without offering it again', await page.evaluate(`document.querySelector('.new-version') === null`), true)
    page.check('its cache replaces the older one, Datajack’s untouched', await page.evaluate(`caches.keys().then(names => names.map(name => name.replace(/-[0-9a-f]{12}/, '')).sort())`), [`cyberdeck-${version}-next`, `datajack-${version}`])
  } finally {
    await new Promise(resolve => host.close(resolve))
    host.closeAllConnections?.()
  }

  // The double-click build: no manifest, no service worker, no note, and it says how it runs.
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'file'], { cwd: join(root, 'packages', 'cyberdeck'), stdio: 'ignore' })
  await page.navigate(pathToFileURL(join(root, 'packages', 'cyberdeck', 'dist-file', 'index.html')).href)
  page.check('the double-click build opens', await page.waitFor('.about-app'), true)
  page.check('without a manifest', await page.evaluate(`document.querySelector('link[rel=manifest]') === null`), true)
  page.check('nor the note of a web host', await page.evaluate(`document.querySelector('.may-erase') === null`), true)
  await page.clickButton('About', '.about-button')
  await pause(300)
  page.check('it says it runs as files', await page.evaluate(`document.querySelectorAll('.about-panel p')[1]?.textContent`), 'Runs as files opened in the browser: what it keeps stays in this browser, on this computer.')
  await page.screenshot('files-about')
}
