// Profiles in the desktop build of Datajack: saves as files in the documents folder, the profile
// list in the application data, and the last profile remembered across restarts.
import { readdirSync, readFileSync } from 'node:fs'
import { exportSampleGame, installGame, pause } from './harness.mjs'

export const app = 'datajack-desktop'

export default async function check(page, { home, output, assets, serve }) {
  const archive = await exportSampleGame(`${output}/cyberdeck`, await serve('cyberdeck'), assets)
  const saveFolder = `${home}/Documents/Datajack/Pascal`

  page.check('the first start asks for a profile', await page.evaluate(`document.querySelector('h2')?.textContent`), 'Create your profile')
  await page.typeText('Pascal')
  await pause(300)
  page.check('the default save folder is shown', await page.evaluate(`document.querySelector('.folder-path')?.textContent`), saveFolder)
  await page.screenshot('desktop-first-start')
  await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
  await pause(800)
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await page.press(' ')
  await page.press(' ')
  await pause(400)
  await page.clickButton('Save', '.quick-button')
  await pause(300)
  await page.evaluate(`document.querySelectorAll('.slot')[1].click()`)
  await pause(500)
  page.check('saving in a slot is confirmed', await page.evaluate(`document.querySelector('.notice')?.textContent`), 'Saved in slot 2.')

  const gameFolders = readdirSync(saveFolder)
  page.check('one folder per game', gameFolders.length, 1)
  const saveFiles = readdirSync(`${saveFolder}/${gameFolders[0]}`).sort()
  page.check('the autosave, the slot and the progress are files', saveFiles.join(), '2.json,auto.json,progress.json')
  page.check('a save is readable JSON', readFileSync(`${saveFolder}/${gameFolders[0]}/auto.json`, 'utf8').includes('\n  "excerpt": '), true)
  page.check('the profile list is in the application data', readFileSync(`${home}/.config/Datajack/profiles.json`, 'utf8').includes('"name": "Pascal"'), true)

  await page.restart()
  page.check('the last profile opens directly after a restart', await page.evaluate(`document.querySelector('.profile-button')?.textContent.trim()`), 'Pascal · Switch profile')
  page.check('Continue is offered from the file', await page.clickButton('Continue', '.button'), true)
  await page.waitFor('.viewport .text')
  await pause(500)
  page.check('Continue resumes where the autosave was', (await page.evaluate(`document.querySelector('.viewport .text')?.textContent`))?.startsWith('Somewhere'), true)
}
