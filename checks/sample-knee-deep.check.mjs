// The Knee-Deep sample in docs/sample/knee-deep: its text imports without a problem and its files,
// given as the zip they come in, each find their entry, its cover the game's; played, the hero is named,
// the town offers its three places, the journal the hero's to-hit and armour by readable names, the Delve
// shows the hero's gauge and three doors with what lies behind them; then a player picking at random wanders it for a while, fighting, opening chests, meeting odd
// folk, and never finds the game stuck or a value left unfilled; met, the Lost Property can be neither
// talked round nor run from.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'knee-deep')

const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
const pick = (page, text) => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === ${JSON.stringify(text)}).click()`)
const hasGrid = page => page.evaluate(`!!document.querySelector('.viewport .grid-menu')`)
const gaugeLabels = page => page.evaluate(`[...document.querySelectorAll('.viewport .gauge .label')].map(label => label.textContent)`)
async function untilOptions(page, limit = 30) {
  for (let press = 0; press < limit && (await options(page)).length === 0 && !(await hasGrid(page)); press++) {
    await page.press(' ')
    await pause(150)
  }
}

export default async function check(page, { url }) {
  await createProject(page, url, 'Knee-Deep')
  await page.setValue('.import .source', readFileSync(join(sample, 'knee-deep.txt'), 'utf8'))
  await pause(2500)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(2500)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'knee-deep-assets.zip')])
  await page.waitFor('.message[role=status]', 60000)
  await pause(800)
  const report = await page.statusText()
  page.check('every file of the zip finds its entry, the cover the game\'s cover', [report.includes('Not used'), report.includes('cover.svg → Cover of the game')], [false, true])
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  // The game's draws all follow from the seed it takes when it starts: one fixed seed makes the wander
  // below the same each run, rather than a walk that some runs never take down the stairs.
  await page.evaluate(`window.__random = Math.random; Math.random = () => 0.25`)
  await page.clickButton('Preview ▶', '.button')
  await pause(300)
  await page.evaluate(`Math.random = window.__random`)
  for (let press = 0; press < 20 && !await page.evaluate(`!!document.querySelector('.viewport .ask-input')`); press++) {
    await page.press(' ')
    await pause(200)
  }
  await page.waitFor('.viewport .ask-input')
  await page.press('Enter')
  await pause(400)
  await untilOptions(page)
  page.check('the town offers the shop, the tavern and the Delve', await options(page), ['Grizelda\'s Everything Shop', 'The Tipsy Anvil, the tavern', 'Down into the Delve (30 of 30 HP)'])
  await page.screenshot('town')
  await page.press('j')
  await pause(300)
  const journal = await page.evaluate(`[...document.querySelectorAll('.viewport .entry')].map(entry => entry.innerText.replace(/\\s+/g, ' ').trim())`)
  page.check('the journal shows the to-hit and the armour, by readable names', ['To hit 3', 'Armour class 10'].every(entry => journal.includes(entry)), true)
  await page.press('Escape')
  await pause(300)
  await pick(page, 'Down into the Delve (30 of 30 HP)')
  await pause(400)
  await untilOptions(page)
  const doors = await options(page)
  page.check('a room offers three doors, each saying what lies behind it', doors.slice(0, 3).map(door => door.split(': ')[0]), ['To the left', 'Straight ahead', 'To the right'])
  page.check('and the hero\'s gauge shows, by the name given', await gaugeLabels(page), ['Pebble'])
  await page.screenshot('doors')

  // A player picking at random, though never the endings that give up, swinging in fights, drinking when low.
  let seed = 7
  const random = count => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % count }
  const seen = { fight: false, grid: false, unfilled: [], stuck: 0, floors: new Set(), lostProperty: [] }
  for (let step = 0; step < 900; step++) {
    if (await page.evaluate(`!!document.querySelector('.viewport .end-screen')`)) {
      break
    }
    const text = await shownStep(page)
    if (/\{[^}]*\}/.test(text)) {
      seen.unfilled.push(text)
    }
    const floor = /^Floor (\d)/.exec(text)
    if (floor) {
      seen.floors.add(Number(floor[1]))
    }
    if (await hasGrid(page)) {
      if (!seen.grid) {
        await pause(600)
        await page.screenshot('chests')
      }
      seen.grid = true
      await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[${random(9)}].click()`)
      await pause(250)
      continue
    }
    const offered = (await options(page)).filter(option => !/bakery|Take the gold|Bread never/i.test(option))
    if (offered.length > 0) {
      const labels = await gaugeLabels(page)
      if (labels.some(label => label.includes('Lost Property'))) {
        seen.lostProperty.push(offered.some(option => option === 'Talk' || option === 'Run away'))
      }
      if (labels.length === 2) {
        if (!seen.fight) {
          page.check('a fight offers a swing of the weapon, named', offered.some(option => /^Swing your \S/.test(option)), true)
          await pause(600)
          await page.screenshot('fight')
        }
        seen.fight = true
      }
      const potion = offered.find(option => option.startsWith('Potion ('))
      const swing = offered.find(option => option.startsWith('Swing your'))
      const choice = swing && potion && random(4) === 0 ? potion : swing && random(5) > 0 ? swing : offered[random(offered.length)]
      await pick(page, choice)
      await pause(200)
      continue
    }
    if (text === 'NONE') {
      seen.stuck++
    }
    await page.press(' ')
    await pause(120)
  }
  page.check('every value shown is filled in', seen.unfilled, [])
  page.check('the game never stood still with nothing to do', seen.stuck < 10, true)
  page.check('the wandering player fought, and opened chests', [seen.fight, seen.grid], [true, true])
  page.check('and went down at least one floor', seen.floors.size >= 1, true)
  page.check('the Lost Property, if met, offers no talking and no running', seen.lostProperty.some(Boolean), false)
  console.log(`  Lost Property fight turns seen: ${seen.lostProperty.length}`)
  await page.screenshot('wandered')
}
