// The battle sample in docs/sample/minigames: its text imports without a problem, its pictures and
// sounds, given as the zip they come in, each find their entry; played, the three creatures line up
// and the one picked steps forward, the others back, until the player sees the others again or
// teams up with it; a duel shows both creatures with their gauges, a strike empties some of the foe's,
// and the duel ends in a win or a loss, counted in the journal; another battle lines the three up
// again on a clear stage; leaving the arena ends on the record.
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
/** Where each creature on stage stands and how its depth scales it, as [left, scale], sorted from left to right. */
const lineUp = page => page.evaluate(`[...document.querySelectorAll('.viewport .character')].map(character => [character.style.left, character.style.scale])`)
  .then(places => places.sort((one, other) => parseFloat(one[0]) - parseFloat(other[0])))
const LINE_UP_OPTIONS = ['Pyrrup: quick and fierce, but fragile', 'Fernling: slow and sturdy', 'Ripplet: steady in everything']
/** The three creatures side by side, at the same depth, as `lineUp` reads them. */
const LINED_UP = [['18%', '1'], ['50%', '1'], ['82%', '1']]

/** Picks an option, then waits for the next options. */
async function pickThen(page, text) {
  await pick(page, text)
  await pause(600)
  await untilOptions(page)
}

/** Strikes until the duel is over: every turn ends on its menu, or the duel on asking for another. */
async function strikeUntilOver(page) {
  for (let turn = 0; turn < 40 && !(await options(page)).includes('Leave the arena'); turn++) {
    await untilOptions(page)
    if ((await options(page)).includes('Strike')) {
      await pick(page, 'Strike')
      await pause(500)
    }
  }
}

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
  await pickThen(page, 'One duel')
  page.check('the three creatures line up, offered along the bottom', await options(page), LINE_UP_OPTIONS)
  page.check('side by side, at the same depth', await lineUp(page), LINED_UP)
  await page.screenshot('battle-line-up')
  await pickThen(page, 'Fernling: slow and sturdy')
  page.check('the one picked is teamed up with or the others seen again', await options(page), ['Team up with Fernling', 'See the others again'])
  page.check('it steps forward, the others back, nobody leaving', await lineUp(page), [['16%', '0.75'], ['50%', '1.25'], ['84%', '0.75']])
  await page.screenshot('battle-picked')
  await pickThen(page, 'See the others again')
  page.check('seeing the others again lines the three up again', await options(page), LINE_UP_OPTIONS)
  page.check('back in their places', await lineUp(page), LINED_UP)
  await pickThen(page, 'Pyrrup: quick and fierce, but fragile')
  await pickThen(page, 'Team up with Pyrrup')
  page.check('a turn offers the moves, no potion at full health', await options(page), ['Strike', 'Ember burst (3 left)', 'Guard'])
  const before = await gauges(page)
  page.check('both gauges show, each over its creature, with their numbers', before.map(gauge => [gauge.corner, gauge.share]), [['top-left', 100], ['top-right', 100]])
  page.check('yours reads its health', before[0]?.numbers, '34 / 34')
  page.check('each gauge is named by its creature', before[0]?.label === 'Your Pyrrup' && /^Rei's (Pyrrup|Fernling|Ripplet)$/.test(before[1]?.label ?? ''), true)
  // The moves sit along the bottom, in one row, leaving the creatures in view.
  page.check('the moves are laid out in a row along the bottom of the stage', await page.evaluate(`(() => {
    const menu = document.querySelector('.viewport .choice-menu.below')
    const viewport = document.querySelector('.viewport').getBoundingClientRect()
    const tops = [...new Set([...document.querySelectorAll('.viewport .option')].map(option => Math.round(option.getBoundingClientRect().top)))]
    return menu !== null && tops.length === 1 && menu.getBoundingClientRect().top > viewport.top + viewport.height * 0.7
  })()`), true)
  page.check('both creatures are on stage', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 2)
  await page.screenshot('battle-turn')

  await pick(page, 'Strike')
  await pause(1500)
  const struck = await gauges(page)
  page.check('a strike takes some of the foe\'s gauge', struck[1]?.share < 100, true)
  await page.screenshot('battle-struck')

  await strikeUntilOver(page)
  page.check('the duel ends, offering another battle', await options(page), ['Another battle', 'Leave the arena'])
  page.check('and its gauges are gone', (await gauges(page)).length, 0)
  await pickThen(page, 'Another battle')
  page.check('another battle starts from the mode', await options(page), ['One duel', 'Three in a row'])
  await pickThen(page, 'One duel')
  page.check('the line-up is offered again', await options(page), LINE_UP_OPTIONS)
  page.check('on a clear stage: the three alone, in line, and no gauge', [await lineUp(page), (await gauges(page)).length], [LINED_UP, 0])
  await pickThen(page, 'Ripplet: steady in everything')
  await pickThen(page, 'Team up with Ripplet')
  page.check('the chosen one alone stands with the foe', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 2)
  page.check('with its own health', (await gauges(page))[0]?.numbers, '40 / 40')
  await strikeUntilOver(page)
  await pick(page, 'Leave the arena')
  await pause(800)
  for (let press = 0; press < 6 && !(await shownStep(page)).startsWith('Battles won'); press++) {
    await page.press(' ')
    await pause(450)
  }
  page.check('leaving ends on the record', /^Battles won: [012]\. Battles lost: [012]\. Gauntlets cleared: 0\.$/.test(await shownStep(page)), true)
}
