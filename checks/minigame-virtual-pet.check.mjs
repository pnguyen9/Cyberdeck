// The virtual pet sample in docs/sample/minigames: its text imports without a problem and its files
// each find their entry; played, the first visit says how to care for Pip, feeding it shows it eating
// and leaves it less hungry in the journal, and waiting lets it live its own life.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'virtual-pet')
const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)

async function untilOptions(page) {
  for (let press = 0; press < 8 && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(500)
  }
}

export default async function check(page, { url }) {
  await createProject(page, url, 'Pip')
  await page.setValue('.import .source', readFileSync(join(sample, 'virtual-pet.txt'), 'utf8'))
  await pause(1000)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1000)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'virtual-pet-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(500)
  const report = await page.statusText()
  page.check('every file finds its entry but the cover', report.slice(report.indexOf('Not used')), 'Not used, no entry of that name: cover.svg.')
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('the first visit introduces Pip', (await shownStep(page)).startsWith('A small round chick'), true)
  await untilOptions(page)
  page.check('Pip can be cared for, or watched', await options(page), ['Feed Pip', 'Play together', 'Pet Pip', 'Let Pip nap', '⏱ Just watch', 'Say goodbye for now'])
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === 'Feed Pip').click()`)
  await pause(800)
  page.check('feeding shows Pip eating', await shownStep(page), 'Pip gobbles the seeds, crumbs everywhere.')
  await page.press('j')
  await pause(300)
  page.check('and the journal shows Pip less hungry', await page.evaluate(`[...document.querySelectorAll('.viewport .entry')].map(entry => entry.innerText.replace(/\\s+/g, ' ').trim())`), ['Hunger 0', 'Mood 8', 'Energy 7', 'Visits 1'])
  await page.press('Escape')
  await pause(300)
  await untilOptions(page)
  await page.screenshot('pip')
}
