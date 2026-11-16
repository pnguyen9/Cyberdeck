// Draws each application's icon, `public/icon.svg`, as the PNG files installing it wants
// (`icon-192.png`, `icon-512.png`), with headless Chrome (`google-chrome` unless CHROME names another).
// Run after changing an icon, and commit the PNG files:
//   node scripts/appIcons.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = mkdtempSync(join(tmpdir(), 'app-icons-'))
try {
  for (const app of ['cyberdeck', 'datajack']) {
    const folder = join(root, 'packages', app, 'public')
    for (const size of [192, 512]) {
      execFileSync(process.env.CHROME ?? 'google-chrome', [
        '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${profile}`,
        `--window-size=${size},${size}`, `--screenshot=${join(folder, `icon-${size}.png`)}`,
        pathToFileURL(join(folder, 'icon.svg')).href,
      ], { stdio: 'ignore' })
      console.log(`${app}: icon-${size}.png`)
    }
  }
} finally {
  rmSync(profile, { recursive: true, force: true })
}
