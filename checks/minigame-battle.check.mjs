// The battle sample in docs/sample/minigames: its text imports without a problem, its pictures and
// sounds, given as the zip they come in, each find their entry; played, a duel shows both creatures
// with their gauges, a strike empties some of the foe's, and the duel ends in a win or a loss, counted
// in the journal; leaving the arena ends on the record.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'battle')

const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
async function untilOptions(page, limit = 12) {
  for (let press = 0; press < limit && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(450)
  }
}
const pick = (page, text) => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === ${JSON.stringify(text)}).click()`)
const gauges = page => page.evaluate(`[...document.querySelectorAll('.viewport .gauge')].map(gauge => ({
  label: gauge.querySelector('.label').textContent,
  numbers: gauge.querySelector('.numbers')?.textContent ?? null,
  share: Number(gauge.getAttribute('aria-valuenow')),
  corner: gauge.parentElement.className.replace('corner ', ''),
}))`)

export default async function check(page, { url }) {
  await createProject(page, url, 'Arena')
  await page.setValue('.import .source', readFileSync(join(sample, 'battle.txt'), 'utf8'))
  await pause(1200)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1200)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'battle-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(800)
  page.check('no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await pause(800)
  await untilOptions(page)
  page.check('a battle is a duel or three in a row', await options(page), ['One duel', 'Three in a row'])
  await pick(page, 'One duel')
  await pause(600)
  await untilOptions(page)
  await pick(page, 'Pyrrup, the ember fox: quick and fierce, but fragile')
  await pause(600)
  await untilOptions(page)
  page.check('a turn offers the four kinds of move', await options(page), ['Strike', 'Ember burst (3 left)', 'Guard', 'Potion (2 left)'])
  const before = await gauges(page)
  page.check('both gauges show, the foe\'s at the top left, yours with its numbers', before.map(gauge => [gauge.corner, gauge.share, gauge.numbers]), [['top-left', 100, null], ['bottom-right', 100, '34 / 34']])
  page.check('each gauge is named by its creature', before[1]?.label === 'Pyrrup' && /^Rei's (Pyrrup|Fernling|Ripplet)$/.test(before[0]?.label ?? ''), true)
  // The moves sit along the bottom, two by two, leaving the creatures in view.
  page.check('the moves are laid out two by two along the bottom of the stage', await page.evaluate(`(() => {
    const menu = document.querySelector('.viewport .choice-menu.below')
    const viewport = document.querySelector('.viewport').getBoundingClientRect()
    const tops = [...new Set([...document.querySelectorAll('.viewport .option')].map(option => Math.round(option.getBoundingClientRect().top)))]
    return menu !== null && tops.length === 2 && menu.getBoundingClientRect().top > viewport.top + viewport.height * 0.7
  })()`), true)
  page.check('both creatures are on stage', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 2)
  await page.screenshot('battle-turn')

  await pick(page, 'Strike')
  await pause(1500)
  const struck = await gauges(page)
  page.check('a strike takes some of the foe\'s gauge', struck[0]?.share < 100, true)
  await page.screenshot('battle-struck')

  // Strike until the duel is over: every turn ends on its menu, or the duel on asking for another.
  for (let turn = 0; turn < 40 && !(await options(page)).includes('Leave the arena'); turn++) {
    await untilOptions(page)
    const offered = await options(page)
    if (offered.includes('Strike')) {
      await pick(page, 'Strike')
      await pause(500)
    }
  }
  page.check('the duel ends, offering another battle', await options(page), ['Another battle', 'Leave the arena'])
  page.check('and its gauges are gone', (await gauges(page)).length, 0)
  await pick(page, 'Leave the arena')
  await pause(800)
  for (let press = 0; press < 6 && !(await shownStep(page)).startsWith('Battles won'); press++) {
    await page.press(' ')
    await pause(450)
  }
  page.check('leaving ends on the record', /^Battles won: [01]\. Battles lost: [01]\. Gauntlets cleared: 0\.$/.test(await shownStep(page)), true)
}
