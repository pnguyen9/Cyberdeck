// Builds every download of a release into release/v<version>/: both applications for Linux and
// Windows, both as files for a browser, the documentation, and the SHA-256 of each.
//   npm run release
// Linux builds need this computer to be Linux (Windows ones are made from any system); zipping
// uses the `zip` command, which keeps the executable bit the Linux builds need.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const releaseFolder = join(root, 'release', `v${version}`)
const workFolder = join(releaseFolder, '.work')
const APPS = [{ product: 'Cyberdeck', workspace: 'cyberdeck' }, { product: 'Datajack', workspace: 'datajack' }]

/** Runs an npm script of a workspace with this Node, whatever the shell's: the build tools need it. */
function npm(script, workspace) {
  console.log(`· ${workspace}: ${script}`)
  const environment = { ...process.env }
  // VS Code's terminal sets it, which would turn Electron into plain Node.
  delete environment.ELECTRON_RUN_AS_NODE
  // `npm run release` says where npm is; run otherwise, the npm of the PATH builds.
  const npmCli = process.env.npm_execpath
  const [command, prefix] = npmCli === undefined ? ['npm', []] : [process.execPath, [npmCli]]
  execFileSync(command, [...prefix, 'run', script, '-w', `@cyberdeck/${workspace}`], { cwd: root, stdio: 'inherit', env: environment, shell: npmCli === undefined && process.platform === 'win32' })
}

/** Zips a folder into the release, the folder itself at the root of the archive. */
function zipFolder(parent, folderName, zipName) {
  const zipPath = join(releaseFolder, zipName)
  rmSync(zipPath, { force: true })
  execFileSync('zip', ['-qry', zipPath, folderName], { cwd: parent })
}

rmSync(releaseFolder, { recursive: true, force: true })
mkdirSync(workFolder, { recursive: true })

for (const { product, workspace } of APPS) {
  const packageFolder = join(root, 'packages', workspace)
  npm('build:file', workspace)
  const webName = `${product}-${version}-web`
  cpSync(join(packageFolder, 'dist-file'), join(workFolder, webName), { recursive: true })
  zipFolder(workFolder, webName, `${webName}.zip`)

  npm('package:desktop:windows', workspace)
  zipFolder(join(packageFolder, 'release'), `${product}-${version}-win32-x64`, `${product}-${version}-windows-x64.zip`)
  if (process.platform === 'linux') {
    npm('package:desktop', workspace)
    zipFolder(join(packageFolder, 'release'), `${product}-${version}-linux-x64`, `${product}-${version}-linux-x64.zip`)
  }
}

// The guide as it is read in a browser, its images beside it, with the README, the changes and the
// licence, where the repository has them: the README's link to the guide works in the archive too.
const documentationName = `Cyberdeck-${version}-documentation`
const documentationFolder = join(workFolder, documentationName)
cpSync(join(root, 'docs', 'guide'), join(documentationFolder, 'docs', 'guide'), { recursive: true })
for (const fileName of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
  cpSync(join(root, fileName), join(documentationFolder, fileName))
}
zipFolder(workFolder, documentationName, `${documentationName}.zip`)
rmSync(workFolder, { recursive: true, force: true })

const sums = readdirSync(releaseFolder).filter(fileName => fileName.endsWith('.zip')).sort()
  .map(fileName => `${createHash('sha256').update(readFileSync(join(releaseFolder, fileName))).digest('hex')}  ${fileName}`)
writeFileSync(join(releaseFolder, 'SHA256SUMS'), `${sums.join('\n')}\n`)
console.log(`\nThe release is in ${releaseFolder}:\n${readdirSync(releaseFolder).sort().join('\n')}`)
if (!existsSync(join(releaseFolder, `Cyberdeck-${version}-linux-x64.zip`))) {
  console.log('No Linux builds: make them on Linux.')
}
