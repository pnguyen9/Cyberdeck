// The blackjack sample in docs/sample/minigames: its text imports without a problem and its files each
// find their entry, the shared deck given once; played, a hand is dealt as cards on the table, the
// dealer's second face down, and the bet comes out of the money.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'blackjack')
const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
const pick = (page, text) => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim().startsWith(${JSON.stringify(text)})).click()`)

async function untilOptions(page) {
  for (let press = 0; press < 12 && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(500)
  }
}

export default async function check(page, { url }) {
  await createProject(page, url, 'Blackjack')
  await page.setValue('.import .source', readFileSync(join(sample, 'blackjack.txt'), 'utf8'))
  await pause(1500)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1500)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'blackjack-assets.zip')])
  await page.waitFor('.message[role=status]', 60000)
  await pause(800)
  const report = await page.statusText()
  page.check('every file finds its entry but the cover', report.slice(report.indexOf('Not used')), 'Not used, no entry of that name: cover.svg.')
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  await untilOptions(page)
  await pick(page, 'I know how to play')
  await pause(500)
  await untilOptions(page)
  await pick(page, 'One deck')
  await pause(500)
  await untilOptions(page)
  page.check('bets are offered, the money it holds among them', await options(page), ['Bet $10', 'Bet $50', 'Bet $100', 'Everything: 1,000.00 dollars', 'Another amount…'])
  await pick(page, 'Bet $10')
  await pause(2500)
  page.check('a hand is dealt: two cards each, the dealer’s second face down', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 4)
  page.check('the hand is told', /^You bet 10\.00\. Your hand counts \d+; the dealer shows \d+\.$/.test(await shownStep(page)), true)
  await page.screenshot('hand')
  await page.press('j')
  await pause(300)
  page.check('the bet came out of the money', await page.evaluate(`[...document.querySelectorAll('.viewport .entry')].map(entry => entry.innerText.replace(/\\s+/g, ' ').trim())`), ['Money 990.00'])
}
