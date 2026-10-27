// Cyberdeck and Datajack apart: the engine previews with the stage they share and exports the game,
// the player has no editing of its own and plays the archive as the preview did.
import { createProfile, createProjectWithSample, exportGame, installGame, pause, shownStep } from './harness.mjs'

export default async function check(page, { url, serve }) {
  await page.navigate(url)
  await page.waitFor('.new-project')
  page.check('Cyberdeck opens on its projects', await page.evaluate(`document.querySelector('.section-title')?.textContent`), 'Projects')
  await createProjectWithSample(page, url, 'The Letter')
  await page.watchViolations()
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  const firstPage = await shownStep(page)
  page.check('the preview plays with the shared stage', firstPage.startsWith('The classroom was empty'), true)
  page.check('leaving the preview goes back to the project', await page.evaluate(`document.querySelector('.leave-button')?.textContent.trim()`), '← Project Esc')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(500)
  page.check('on the tab it was left from', await page.evaluate(`document.querySelector('.tab.current')?.textContent.trim()`), 'Chapters')
  const archive = await exportGame(page, 'The Letter 1.0.zip')
  page.check('the export is named after the project and its release', await page.evaluate(`document.querySelector('.export .download')?.getAttribute('download')`), 'The Letter 1.0.zip')
  page.check('no content security violation in Cyberdeck', await page.violations(), '[]')

  await createProfile(page, await serve('datajack'), 'Pascal')
  await page.watchViolations()
  page.check('Datajack opens the library after the profile', (await page.evaluate(`document.querySelector('.empty')?.textContent.trim()`))?.startsWith('No games yet'), true)
  page.check('Datajack has no editing of its own', await page.evaluate(`[...document.querySelectorAll('button, label')].some(element => /sandbox|import|preview/i.test(element.textContent))`), false)
  await installGame(page, archive)
  page.check('it installs the archive', await page.statusText(), 'The Letter 1.0 installed.')
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  page.check('and plays it as the preview did', await shownStep(page), firstPage)
  page.check('no content security violation in Datajack', await page.violations(), '[]')
}
