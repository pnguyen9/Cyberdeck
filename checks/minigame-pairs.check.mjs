// The Pairs sample in docs/sample/minigames: its text imports without a problem and its files each find
// their entry; played through, as a player would, remembering the animals seen: a grid of 16 tiles, a pair
// staying face up, two different animals turning back over at the next pick, the game ending once all
// eight pairs are found, the turns counted. Exported as a game, it carries every tile's picture, which no
// tag names, the grid showing them by the names its list holds.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, exportGame, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'pairs')
/** Each tile as its label says it: what it shows, `back` for one face down. */
const tiles = page => page.evaluate(`[...document.querySelectorAll('.viewport .grid-menu .tile')].map(tile => tile.getAttribute('aria-label').split(': ')[1] ?? '')`)
const pick = async (page, number) => {
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[${number - 1}].click()`)
  await pause(250)
}

export default async function check(page, { url }) {
  await createProject(page, url, 'Pairs')
  await page.setValue('.import .source', readFileSync(join(sample, 'pairs.txt'), 'utf8'))
  await pause(1200)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1200)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'pairs-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(600)
  const report = await page.statusText()
  page.check('every file finds its entry but the cover', report.slice(report.indexOf('Not used')), 'Not used, no entry of that name: cover.svg.')
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  for (let press = 0; press < 4 && !await page.evaluate(`!!document.querySelector('.viewport .grid-menu')`); press++) {
    await page.press(' ')
    await pause(500)
  }
  page.check('a grid of 16 tiles, all face down, each showing its picture', [(await tiles(page)).filter(tile => tile === 'back').length, await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile img').length`)], [16, 16])

  await pick(page, 1)
  const first = (await tiles(page))[0]
  page.check('a tile picked turns over', first !== 'back' && first !== '', true)
  await page.screenshot('turned')

  // Play on as a player would: remembering each animal seen, taking a known pair when there is one.
  const seen = new Map([[1, first]])
  const done = new Set()
  let open = 1
  for (let pickCount = 0; pickCount < 60 && await page.evaluate(`!!document.querySelector('.viewport .grid-menu')`); pickCount++) {
    const partner = open === null ? null : [...seen].find(([number, animal]) => number !== open && animal === seen.get(open) && !done.has(number))?.[0]
    const knownPair = open !== null ? null : [...seen].find(([number, animal]) => !done.has(number) && [...seen].some(([other, otherAnimal]) => other !== number && otherAnimal === animal && !done.has(other)))
    const target = partner ?? knownPair?.[0] ?? [...Array(16).keys()].map(index => index + 1).find(number => !seen.has(number) && !done.has(number))
    await pick(page, target)
    const shown = await tiles(page)
    if (!await page.evaluate(`!!document.querySelector('.viewport .grid-menu')`)) {
      break
    }
    seen.set(target, shown[target - 1])
    if (open === null) {
      open = target
    } else {
      if (shown[target - 1] === shown[open - 1]) {
        done.add(target)
        done.add(open)
      }
      open = null
    }
  }
  await pause(800)
  page.check('every pair found ends the game, the turns counted', /^Every pair found, in \d+ turns!$/.test(await shownStep(page)), true)

  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  const archive = await exportGame(page, 'pairs.zip')
  const tilePictures = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).split('\n').filter(path => /characters\/tile\//i.test(path))
  page.check('the exported game carries the back and the eight animals', tilePictures.length, 9)
}
