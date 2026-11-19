// A Datajack profile to a file and back, in the desktop build: the file carries the game with its
// files, read from Datajack's folder, and the save files of the profile's folder; importing asks the
// save folder as creating a profile does, and writes the saves there; importing it again beside
// Pascal adds another profile, saving in a folder of its own.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { askProfileRemoval, exportSampleGame, installGame, libraryGames, newProfile, pause, playProfile, profileAction, switchProfile } from './harness.mjs'

export const app = 'datajack-desktop'

export default async function check(page, { home, output, assets, serve }) {
  const archive = await exportSampleGame(`${output}/cyberdeck`, await serve('cyberdeck'), assets)
  const saveFolder = `${home}/Documents/Datajack/Pascal`
  const assetFolder = `${home}/.config/Datajack/library/assets`
  const profiles = () => JSON.parse(readFileSync(`${home}/.config/Datajack/profiles.json`, 'utf8')).profiles
  const message = () => page.evaluate(`document.querySelector('.profiles .message')?.textContent.trim() ?? null`)
  const saveFiles = () => readdirSync(saveFolder).flatMap(game => readdirSync(`${saveFolder}/${game}`)).sort().join()
  const hasContinue = () => page.evaluate(`[...document.querySelectorAll('.button')].some(button => button.textContent.trim() === 'Continue')`)

  await newProfile(page, 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await page.press(' ')
  await page.press(' ')
  await pause(400)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(600)
  const pascalId = profiles()[0].id
  page.check('Pascal has an autosave and progress as files', saveFiles(), 'auto.json,progress.json')

  await switchProfile(page)
  await profileAction(page, 'Pascal', 'Export to a file')
  await page.waitFor('.export-panel .download')
  const profileFile = await page.saveDownload('Pascal - Datajack profile.zip', '.export-panel .download')
  await page.clickButton('Close', '.export-panel .button')
  await askProfileRemoval(page, 'Pascal')
  await page.evaluate(`document.querySelector('.confirmation .button.danger').click()`)
  await pause(800)
  page.check('removed, Pascal’s game files are deleted, its saves stay', [existsSync(assetFolder) ? readdirSync(assetFolder).length : 0, saveFiles()], [0, 'auto.json,progress.json'])

  await page.setFiles('.import-button .file-input', [profileFile])
  await pause(2500)
  page.check('importing asks the save folder, the default one for its name', await page.evaluate(`document.querySelector('.import-form .folder-path')?.textContent`), saveFolder)
  await page.screenshot('desktop-profile-import')
  await page.evaluate(`document.querySelector('.import-form button[type=submit]').click()`)
  await pause(2500)
  page.check('the import says what came', await message(), 'Pascal was imported, with 1 game and 1 save. It is in the list above; open it to play.')
  page.check('Pascal comes back as a new profile, saving in that folder', [profiles()[0].id !== pascalId, profiles()[0].saveFolder], [true, saveFolder])
  page.check('the game’s files are back in Datajack’s folder', readdirSync(assetFolder).length > 0, true)
  await playProfile(page, 'Pascal')
  page.check('its game and its save are back', [await libraryGames(page), await hasContinue()], ['The Letter 1.0', true])

  // Imported again beside Pascal: Pascal 2, in a folder of its own; Pascal's own saves are left alone.
  await page.clickButton('Remove', '.link-button')
  await pause(200)
  await page.evaluate(`document.querySelector('.game .confirmation .button.danger').click()`)
  await pause(1000)
  await switchProfile(page)
  await page.setFiles('.import-button .file-input', [profileFile])
  await pause(2500)
  page.check('importing again offers a free name and its own folder', [await page.evaluate(`document.querySelector('.import-form .text-input').value`), await page.evaluate(`document.querySelector('.import-form .folder-path')?.textContent`)], ['Pascal 2', `${saveFolder} 2`])
  await page.evaluate(`document.querySelector('.import-form button[type=submit]').click()`)
  await pause(2500)
  page.check('Pascal 2 is added, Pascal left as it was', [await message(), profiles().map(profile => profile.saveFolder).join(), saveFiles()], ['Pascal 2 was imported, with 1 game and 1 save. It is in the list above; open it to play.', `${saveFolder},${saveFolder} 2`, 'auto.json,progress.json'])
  await playProfile(page, 'Pascal 2')
  page.check('its game is there', await libraryGames(page), 'The Letter 1.0')
  await switchProfile(page)
  await playProfile(page, 'Pascal')
  page.check('Pascal’s library stays without the game it removed', await libraryGames(page), '')
}
