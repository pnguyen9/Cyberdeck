// Assembles the site GitHub Pages publishes, https://pnguyen9.github.io/Cyberdeck/, into site/: both
// applications' web builds in cyberdeck/ and datajack/, the guide in guide/, the sample stories in
// sample/ (each a text and the zip of its files, linked from the guide), and at the root a page
// sending players to Datajack.
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
cpSync(join(root, 'docs', 'sample'), join(site, 'sample'), { recursive: true })
writeFileSync(join(site, 'index.html'), rootRedirect())
console.log(`The site of ${version} is in ${site}`)

// The site's root sends players straight to Datajack: Cyberdeck is for authors, who find its address
// in the README. A meta refresh, since GitHub Pages has no redirects; the link is for when it is off.
function rootRedirect() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'none'; form-action 'none'">
<meta http-equiv="refresh" content="0; url=datajack/">
<title>Datajack</title>
<link rel="icon" href="datajack/icon.svg" type="image/svg+xml">
</head>
<body>
<p><a href="datajack/">Datajack</a></p>
</body>
</html>
`
}
