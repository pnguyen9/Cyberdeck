// A Word document of plain prose only (no heading, dialogue or tag) made into a game and played to its end
// in Datajack. fixtures/plain.docx is fixtures/plain.html saved by LibreOffice.
import { createProfile, createProject, exportGame, installGame, pause, shownStep } from './harness.mjs'

export default async function check(page, { url, fixtures, serve }) {
  await createProject(page, url, 'The Clockmaker')
  await page.setFiles('.import .file-button input[type=file]', [`${fixtures}/plain.docx`])
  await pause(1200)
  page.check('the document imports without a problem', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  page.check('it becomes one chapter', await page.evaluate(`document.querySelectorAll('.chapter').length`), 1)
  const archive = await exportGame(page, 'clockmaker.zip')

  await createProfile(page, await serve('datajack'), 'Reader')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  page.check('it plays from its first sentence', (await shownStep(page))?.startsWith('The rain had not stopped'), true)
  const pages = []
  for (let press = 0; press < 30 && await page.evaluate(`!document.querySelector('.viewport .end-screen')`); press++) {
    const step = await shownStep(page)
    if (pages.at(-1) !== step) {
      pages.push(step)
    }
    await page.press(' ')
    await pause(150)
  }
  page.check('every paragraph is read, cut into pages', pages.join(' ').includes('walked out into the rain.'), true)
  page.check('and the story ends', (await shownStep(page))?.startsWith('The end'), true)
  page.check('without a map, there being no choice to show', await page.evaluate(`[...document.querySelectorAll('.end-button')].map(button => button.textContent.trim()).join(', ')`), '◀ Back, ← Library')
  await page.screenshot('end')
}
