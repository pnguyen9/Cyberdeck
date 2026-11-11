// The sample story in docs/sample: its text imports without a problem, and its files, given as the zip
// they come in, each find their entry, whatever type the browser gives them, the .ogg sounds included;
// and in Details, a cover far from 16:9 is said to be cut, the sample's own not.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'sakura-week')

export default async function check(page, { url, output }) {
  await createProject(page, url, 'Sakura Week')
  await page.setValue('.import .source', readFileSync(join(sample, 'sakura-week.txt'), 'utf8'))
  await pause(1500)
  page.check('the sample story imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1500)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'sakura-week-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(500)
  const report = await page.statusText()
  // The cover, which no entry of the story takes, becomes the game's cover, as it has none yet.
  page.check('every file of the zip finds its entry, the cover the game\'s cover', [report.includes('Not used'), report.includes('cover.png → Cover of the game')], [false, true])
  page.check('the sounds and music among them', ['calm.ogg → Music calm', 'door.ogg → Sound door'].every(match => report.includes(match)), true)
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)
  await page.screenshot('cast')

  // A cover far from 16:9 is said to be cut; the sample's own, at 16:9, is not.
  const portrait = join(output, 'portrait.svg')
  writeFileSync(portrait, '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="pink"/></svg>')
  const cover = join(output, 'cover.png')
  writeFileSync(cover, execFileSync('unzip', ['-p', join(sample, 'sakura-week-assets.zip'), 'sakura-week-assets/cover.png']))
  await page.clickButton('Details', '.tab')
  await page.waitFor('.cover-actions input[type=file]')
  await page.setFiles('.cover-actions input[type=file]', [portrait])
  await pause(1000)
  page.check('a cover far from 16:9 is said to be cut', await page.evaluate(`document.querySelector('.cover-actions .warning')?.textContent.trim()`), 'This image is 900×1200, not 16:9: players see only its middle, the rest cut off. Crop it to 16:9 (1600×900, for instance) to choose what they see.')
  await page.setFiles('.cover-actions input[type=file]', [cover])
  await pause(1000)
  page.check('the sample cover, at 16:9, is shown whole', await page.evaluate(`document.querySelector('.cover-actions .warning') === null`), true)
  await page.screenshot('details')
}
