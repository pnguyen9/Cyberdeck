// Makes a folder that runs an application without installing anything: Electron's own runtime with
// the application inside, as Electron loads one from `resources/app`. Run from the application's
// package folder after its `build:desktop`:
//   node ../desktop/scripts/packageApp.mjs <Product name> <executable name> [linux | win32 | darwin]
// The system is this computer's unless named: the application is the same JavaScript everywhere, so
// only Electron's runtime differs. The folder lands in the package's `release/`.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const [, , productName, executableName, platform = process.platform] = process.argv
if (productName === undefined || executableName === undefined || !['linux', 'win32', 'darwin'].includes(platform)) {
  console.error('Usage: node ../desktop/scripts/packageApp.mjs <Product name> <executable name> [linux | win32 | darwin]')
  process.exit(1)
}

const packageFolder = process.cwd()
const require = createRequire(join(packageFolder, 'package.json'))
const electronPackageFolder = dirname(require.resolve('electron/package.json'))
const electronFolder = platform === process.platform ? join(electronPackageFolder, 'dist') : await runtimeFor(platform, process.arch)
const { version } = JSON.parse(readFileSync(join(packageFolder, 'package.json'), 'utf8'))

for (const built of ['dist', 'dist-electron']) {
  if (!existsSync(join(packageFolder, built))) {
    console.error(`No ${built}/ folder: run npm run build:desktop first.`)
    process.exit(1)
  }
}
if (!existsSync(electronFolder)) {
  console.error('No Electron runtime: run node node_modules/electron/install.js from the repository root first.')
  process.exit(1)
}

const releaseFolder = join(packageFolder, 'release', `${productName}-${version}-${platform}-${process.arch}`)
rmSync(releaseFolder, { recursive: true, force: true })
mkdirSync(releaseFolder, { recursive: true })
cpSync(electronFolder, releaseFolder, { recursive: true, verbatimSymlinks: true })

const resourcesFolder = platform === 'darwin'
  ? join(releaseFolder, 'Electron.app', 'Contents', 'Resources')
  : join(releaseFolder, 'resources')
// Electron's own welcome page would otherwise stay in the folder, unused.
rmSync(join(resourcesFolder, 'default_app.asar'), { force: true })

const appFolder = join(resourcesFolder, 'app')
mkdirSync(appFolder, { recursive: true })
cpSync(join(packageFolder, 'dist'), join(appFolder, 'dist'), { recursive: true })
cpSync(join(packageFolder, 'dist-electron'), join(appFolder, 'dist-electron'), { recursive: true })
writeFileSync(join(appFolder, 'package.json'), `${JSON.stringify({ name: executableName, productName, version, type: 'module', main: 'dist-electron/main.js' }, null, 2)}\n`)

const executables = { linux: ['electron', executableName], win32: ['electron.exe', `${productName}.exe`], darwin: ['Electron.app', `${productName}.app`] }
const [from, to] = executables[platform] ?? []
if (from !== undefined) {
  renameSync(join(releaseFolder, from), join(releaseFolder, to))
}
console.log(`${productName} is in ${releaseFolder}: start ${to ?? 'the Electron executable'} there.`)

/**
 * Electron's runtime for another system, as Electron publishes it: downloaded once into
 * `node_modules/.cache/electron`, checked against the SHA-256 the electron package lists, unpacked.
 */
async function runtimeFor(targetPlatform, arch) {
  const { version: electronVersion } = JSON.parse(readFileSync(join(electronPackageFolder, 'package.json'), 'utf8'))
  const archiveName = `electron-v${electronVersion}-${targetPlatform}-${arch}.zip`
  const expectedHash = JSON.parse(readFileSync(join(electronPackageFolder, 'checksums.json'), 'utf8'))[archiveName]
  if (expectedHash === undefined) {
    console.error(`Electron ${electronVersion} publishes no ${archiveName}.`)
    process.exit(1)
  }
  const cacheFolder = join(electronPackageFolder, '..', '.cache', 'electron')
  const runtimeFolder = join(cacheFolder, archiveName.replace(/\.zip$/, ''))
  if (existsSync(runtimeFolder)) {
    return runtimeFolder
  }
  const response = await fetch(`https://github.com/electron/electron/releases/download/v${electronVersion}/${archiveName}`)
  if (!response.ok) {
    console.error(`${archiveName} could not be downloaded: ${response.status} ${response.statusText}.`)
    process.exit(1)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
    console.error(`${archiveName} does not match the SHA-256 the electron package lists: not used.`)
    process.exit(1)
  }
  // Unpacked beside its place, then moved in: an interrupted run leaves no half runtime to be reused.
  const archivePath = join(cacheFolder, archiveName)
  const unpackingFolder = `${runtimeFolder}.unpacking`
  mkdirSync(cacheFolder, { recursive: true })
  writeFileSync(archivePath, bytes)
  rmSync(unpackingFolder, { recursive: true, force: true })
  mkdirSync(unpackingFolder)
  // Windows' own tar reads zip archives; elsewhere, unzip does.
  if (process.platform === 'win32') {
    execFileSync('tar', ['-xf', archivePath, '-C', unpackingFolder])
  } else {
    execFileSync('unzip', ['-q', archivePath, '-d', unpackingFolder])
  }
  rmSync(archivePath)
  renameSync(unpackingFolder, runtimeFolder)
  return runtimeFolder
}
