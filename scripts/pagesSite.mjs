// Assembles the site GitHub Pages publishes, https://pnguyen9.github.io/Cyberdeck/, into site/: a small
// landing page, both applications' web builds in cyberdeck/ and datajack/, and the guide in guide/.
// The applications are built first, unless --no-build says their dist/ folders are ready.
//   npm run pages
// The workflow .github/workflows/pages.yml runs it on each release tag, then publishes site/.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site = join(root, 'site')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (!process.argv.includes('--no-build')) {
  // `npm run pages` says where npm is; run otherwise, the npm of the PATH builds.
  const npmCli = process.env.npm_execpath
  const [command, prefix] = npmCli === undefined ? ['npm', []] : [process.execPath, [npmCli]]
  for (const workspace of ['cyberdeck', 'datajack']) {
    console.log(`· ${workspace}: build`)
    execFileSync(command, [...prefix, 'run', 'build', '-w', `@cyberdeck/${workspace}`], { cwd: root, stdio: 'inherit', shell: npmCli === undefined && process.platform === 'win32' })
  }
}

rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })
for (const workspace of ['cyberdeck', 'datajack']) {
  cpSync(join(root, 'packages', workspace, 'dist'), join(site, workspace), { recursive: true })
}
cpSync(join(root, 'docs', 'guide'), join(site, 'guide'), { recursive: true })
cpSync(join(root, 'packages', 'cyberdeck', 'public', 'icon.svg'), join(site, 'icon.svg'))
writeFileSync(join(site, 'index.html'), landingPage(version))
console.log(`The site of ${version} is in ${site}`)

function landingPage(release) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Cyberdeck and Datajack</title>
<link rel="icon" href="icon.svg" type="image/svg+xml">
<style>
body {
  margin: 0;
  background: #0b0d12;
  color: #e6e9ef;
  font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: dark;
}
main {
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 20px;
}
h1 {
  margin: 0 0 8px;
}
.lead, .fr, footer {
  color: #a0a6b4;
}
.fr {
  font-size: 15px;
}
.apps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin: 32px 0;
}
.app {
  display: block;
  padding: 20px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
  color: inherit;
  text-decoration: none;
}
.app:hover, .app:focus-visible {
  border-color: #9eeaff;
}
.app img {
  width: 64px;
  height: 64px;
  border-radius: 12px;
}
.app h2 {
  margin: 8px 0 4px;
  color: #9eeaff;
}
.app p {
  margin: 0 0 4px;
}
a {
  color: #9eeaff;
}
footer {
  font-size: 15px;
}
</style>
</head>
<body>
<main>
<h1>Cyberdeck and Datajack</h1>
<p class="lead">Write a visual novel, play it, share it: both applications run in the browser, offline once opened, and install from it.</p>
<p class="fr" lang="fr">Écrire un roman visuel, y jouer, le partager : les deux applications fonctionnent dans le navigateur, hors ligne une fois ouvertes, et s’installent depuis lui.</p>
<div class="apps">
<a class="app" href="cyberdeck/">
<img src="cyberdeck/icon.svg" alt="">
<h2>Cyberdeck</h2>
<p>The engine: write a story, preview it, export it as a game.</p>
<p class="fr" lang="fr">Le moteur : écrire une histoire, la prévisualiser, l’exporter en jeu.</p>
</a>
<a class="app" href="datajack/">
<img src="datajack/icon.svg" alt="">
<h2>Datajack</h2>
<p>The player: install games and play them.</p>
<p class="fr" lang="fr">Le lecteur : installer des jeux et y jouer.</p>
</a>
</div>
<p>What the applications keep stays in the browser, on the device. A browser may erase what a site keeps (Safari does after about seven days without a visit, unless the app is installed): back up projects, and keep games and saves as files.</p>
<p class="fr" lang="fr">Ce que gardent les applications reste dans le navigateur, sur l’appareil. Un navigateur peut effacer ce qu’un site garde (Safari le fait après environ sept jours sans visite, sauf si l’application est installée) : faites des copies de secours des projets, et gardez jeux et sauvegardes dans des fichiers.</p>
<footer>
<p>Version ${release} · <a href="guide/">Guide</a> · <a href="https://github.com/pnguyen9/Cyberdeck">Source code</a> · <a href="https://github.com/pnguyen9/Cyberdeck/releases">Desktop and offline downloads</a> · Public domain (<a href="https://github.com/pnguyen9/Cyberdeck/blob/main/LICENSE">Unlicense</a>)</p>
</footer>
</main>
</body>
</html>
`
}
