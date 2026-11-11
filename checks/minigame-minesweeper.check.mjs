// The Minesweeper sample in docs/sample/minigames: its text imports without a problem and its files each
// find their entry; a beginner board of 9 × 9 shown as a grid, the first cell opened never a mine and
// opening an area around it when nothing is near; an expert board of 30 × 16 too, the whole board worked
// through between two picks.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'minesweeper')
const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
const tiles = page => page.evaluate(`[...document.querySelectorAll('.viewport .grid-menu .tile')].map(tile => tile.getAttribute('aria-label').split(': ')[1] ?? '')`)

async function untilOptions(page) {
  for (let press = 0; press < 6 && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(400)
  }
}

async function playLevel(page, level) {
  await untilOptions(page)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim().startsWith(${JSON.stringify(level)})).click()`)
  await pause(1500)
}

export default async function check(page, { url }) {
  await createProject(page, url, 'Minesweeper')
  await page.setValue('.import .source', readFileSync(join(sample, 'minesweeper.txt'), 'utf8'))
  await pause(1500)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1500)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'minesweeper-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(600)
  const report = await page.statusText()
  page.check('every file finds its entry, the cover the game\'s cover', [report.includes('Not used'), report.includes('cover.svg → Cover of the game')], [false, true])
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await playLevel(page, 'Beginner')
  page.check('a beginner board: 81 cells, all hidden', (await tiles(page)).filter(tile => tile === 'hidden').length, 81)
  const caption = () => page.evaluate(`document.querySelector('.viewport .textbox .text')?.textContent.trim() ?? null`)
  page.check('the text box says how many cells are left to open', await caption(), '71 cells left to open · 10 mines · 0 flagged')
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[40].click()`)
  await pause(1500)
  const opened = await tiles(page)
  page.check('and counts down as cells open', Number((await caption())?.split(' ')[0]), 71 - opened.filter(tile => !['hidden', 'mine', 'boom'].includes(tile)).length)
  // A right click flags a hidden cell: picking it then does nothing; F on it takes the flag away.
  const hidden = opened.indexOf('hidden')
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[${hidden}].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))`)
  await pause(800)
  page.check('a right click flags a hidden cell', [(await tiles(page))[hidden], (await caption())?.endsWith('· 1 flagged')], ['flag', true])
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[${hidden}].click()`)
  await pause(800)
  page.check('a flagged cell does not open', (await tiles(page))[hidden], 'flag')
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[${hidden}].focus()`)
  await page.press('f')
  await pause(800)
  page.check('F on it takes the flag away', [(await tiles(page))[hidden], (await caption())?.endsWith('· 0 flagged')], ['hidden', true])
  page.check('the first cell opened is never a mine', ['mine', 'boom', 'hidden'].includes(opened[40]), false)
  page.check('nothing near, the cells around open too', opened[40] !== '0' || opened.filter(tile => tile !== 'hidden').length > 1, true)
  await page.screenshot('beginner')

  // An expert board: the mines placed, counted and an area opened between two picks.
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await playLevel(page, 'Expert')
  page.check('an expert board: 480 cells', (await tiles(page)).length, 480)
  await page.evaluate(`document.querySelectorAll('.viewport .grid-menu .tile')[200].click()`)
  await pause(3000)
  page.check('worked through without being taken for a loop', [await page.evaluate(`!!document.querySelector('.viewport .grid-menu')`), ['mine', 'boom', 'hidden'].includes((await tiles(page))[200])], [true, false])
  await page.screenshot('expert')
}
