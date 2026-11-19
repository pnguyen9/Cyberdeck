// A Datajack profile to a file and back, in the web build: exporting asks its PIN and says the file is
// not encrypted; the file brings back, once the profile is removed, its game with its pictures, its save,
// its progress, its settings and its PIN, as a new profile; importing it again while Pascal is there adds
// another profile, under a free name, never replacing Pascal; a zip locked with a password, a game chosen
// as a profile and a profile file added as a game are each refused in words a player understands.
import { readFileSync, writeFileSync } from 'node:fs'
import { askProfileRemoval, createProfile, exportSampleGame, installGame, libraryGames, pause, playProfile, profileAction, switchProfile, typePin } from './harness.mjs'

export const app = 'datajack'

export default async function check(page, { url, output, assets, serve }) {
  const archive = await exportSampleGame(`${output}/cyberdeck`, await serve('cyberdeck'), assets)
  const profileNames = () => page.evaluate(`[...document.querySelectorAll('.profile-name')].map(element => element.textContent).join()`)
  const message = () => page.evaluate(`document.querySelector('.profiles .message')?.textContent.trim() ?? null`)
  const error = () => page.evaluate(`document.querySelector('.error')?.textContent.trim() ?? null`)
  const hint = () => page.evaluate(`document.querySelector('.pin-dialog #pin-hint')?.textContent.trim() ?? null`)
  const importFile = async path => {
    await page.setFiles('.import-button .file-input', [path])
    await pause(2500)
  }
  const importSentence = () => page.evaluate(`document.querySelector('.import-form p:not(.hint)')?.textContent.trim() ?? null`)
  const submitLabel = () => page.evaluate(`document.querySelector('.import-form button[type=submit]')?.textContent.trim() ?? null`)
  const submitImport = () => page.evaluate(`document.querySelector('.import-form button[type=submit]').click()`)
  const hasContinue = () => page.evaluate(`[...document.querySelectorAll('.button')].some(button => button.textContent.trim() === 'Continue')`)
  const profileId = name => page.evaluate(`JSON.parse(localStorage.getItem('datajack:profiles')).profiles.find(profile => profile.name === ${JSON.stringify(name)})?.id ?? null`)
  const keptFor = id => page.evaluate(`(() => {
    const keys = Object.keys(localStorage)
    return {
      progress: keys.some(key => key.startsWith('datajack:profile:${id}:save:') && key.endsWith(':progress')),
      setting: (localStorage.getItem('datajack:settings:${id}') ?? '').includes('"namePlateMotion":"fixed"'),
      pin: localStorage.getItem('datajack:pin:${id}') !== null,
    }
  })()`)
  const coverShown = () => page.evaluate(`(() => { const cover = document.querySelector('.game .cover img'); return cover !== null && cover.complete && cover.naturalWidth > 0 })()`)

  // Pascal: a game, an autosave, its progress, a setting and a PIN.
  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await page.press(' ')
  await page.press(' ')
  await pause(400)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(600)
  await page.clickButton('Settings', '.header-tools .button')
  await page.waitFor('.settings-screen .overlay')
  await page.evaluate(`[...document.querySelectorAll('.settings-screen .category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
  await pause(200)
  await page.evaluate(`[...document.querySelectorAll('.settings-screen .choice-button')].find(button => button.textContent.trim() === 'Stays put').click()`)
  await pause(200)
  await page.press('Escape')
  await pause(500)
  await page.evaluate(`document.querySelector('.pin-button').click()`)
  await pause(400)
  await typePin(page, '1234')
  await typePin(page, '1234')
  const pascalId = await profileId('Pascal')
  page.check('Pascal has a game, a save, progress, a setting and a PIN', [await libraryGames(page), await hasContinue(), await keptFor(pascalId)], ['The Letter 1.0', true, { progress: true, setting: true, pin: true }])

  // Exporting asks the PIN, then offers the file, saying plainly it is not encrypted.
  await switchProfile(page)
  await profileAction(page, 'Pascal', 'Export to a file')
  page.check('exporting asks Pascal’s PIN', await hint(), 'Enter Pascal’s PIN to go on.')
  await typePin(page, '1234')
  await page.waitFor('.export-panel .download')
  page.check('the file is ready', await page.evaluate(`document.querySelector('.export-panel [role=status]')?.textContent.trim()`), 'Pascal’s profile file is ready, with its games, saves, progress and settings, and its PIN.')
  page.check('it says plainly the file is not encrypted', await page.evaluate(`document.querySelector('.export-panel .hint')?.textContent.trim()`), 'The file is not encrypted: anyone who has it can read its saves, and the PIN does not protect it. You may put a password on the zip yourself; remove it before importing the file.')
  page.check('the file is named after the profile', await page.evaluate(`document.querySelector('.export-panel .download').download`), 'Pascal - Datajack profile.zip')
  await page.screenshot('profile-export')
  const profileFile = await page.saveDownload('Pascal - Datajack profile.zip', '.export-panel .download')
  page.check('the file is a zip holding the profile, its game and its saves', (() => {
    const text = readFileSync(profileFile).toString('latin1')
    return ['datajack-profile.json', 'games/', 'saves/'].every(part => text.includes(part))
  })(), true)
  await page.clickButton('Close', '.export-panel .button')
  await pause(300)

  // Removed, then imported: everything comes back, the PIN asked to enter.
  await askProfileRemoval(page, 'Pascal')
  await typePin(page, '1234')
  await page.evaluate(`document.querySelector('.confirmation .button.danger').click()`)
  await pause(800)
  page.check('Pascal is removed', await profileNames(), '')
  await importFile(profileFile)
  page.check('importing asks to confirm, with the profile’s name and when it was exported', [/^This file holds Pascal’s profile, exported on .*\d{4}\.$/.test(await importSentence()), await page.evaluate(`document.querySelector('.import-form .text-input').value`), await submitLabel()], [true, 'Pascal', 'Import Pascal'])
  await page.screenshot('profile-import')
  await submitImport()
  await pause(2500)
  page.check('the import says what came', await message(), 'Pascal was imported, with 1 game and 1 save. It is in the list above; open it to play.')
  page.check('Pascal is back, with its PIN', [await profileNames(), await page.evaluate(`!!document.querySelector('.play-profile .locked')`)], ['Pascal', true])
  const importedId = await profileId('Pascal')
  page.check('as a new profile, of its own identifier', importedId !== null && importedId !== pascalId, true)
  await playProfile(page, 'Pascal')
  page.check('entering it asks its PIN', await hint(), 'Enter it to play as Pascal.')
  await typePin(page, '1234')
  page.check('its game is back, with its pictures', [await libraryGames(page), await coverShown()], ['The Letter 1.0', true])
  page.check('its save, progress and setting too', [await hasContinue(), await keptFor(importedId)], [true, { progress: true, setting: true, pin: true }])

  // A profile file added as a game says where it goes; a zip locked with a password says what to do.
  await installGame(page, profileFile)
  page.check('a profile file added as a game says where it goes', await error(), 'Pascal - Datajack profile.zip: This is a profile file, not a game: import it from the profiles screen (Switch profile).')
  const locked = `${output}/locked.zip`
  writeFileSync(locked, lockedCopy(readFileSync(archive)))
  await installGame(page, locked)
  page.check('a game locked with a password says to unzip it first', await error(), 'locked.zip: This file is locked with a password, which Datajack cannot open. Unzip it with its password, zip what it holds again without one, then use that new file.')

  // Imported again while Pascal is here: another profile, under a free name; Pascal is left as it is.
  await page.clickButton('Remove', '.link-button')
  await pause(200)
  await page.evaluate(`document.querySelector('.game .confirmation .button.danger').click()`)
  await pause(1000)
  page.check('Pascal’s game is removed', await libraryGames(page), '')
  await switchProfile(page)
  await importFile(profileFile)
  page.check('importing again offers a free name, asking nothing about Pascal', [await page.evaluate(`document.querySelector('.import-form .hint')?.textContent.trim()`), await page.evaluate(`document.querySelector('.import-form .text-input').value`), await submitLabel(), await page.evaluate(`!!document.querySelector('.import-profile .confirmation')`)], ['Pascal is taken: this one will be Pascal 2, or choose another name.', 'Pascal 2', 'Import Pascal 2', false])
  await page.evaluate(`document.querySelector('.import-form .text-input').select()`)
  await page.typeText('Pascal')
  await submitImport()
  await pause(800)
  page.check('the same name is refused', await error(), 'Another profile is already named Pascal.')
  await page.evaluate(`document.querySelector('.import-form .text-input').select()`)
  await page.typeText('Pascal 2')
  await submitImport()
  await pause(2500)
  page.check('both are kept', [await message(), await profileNames()], ['Pascal 2 was imported, with 1 game and 1 save. It is in the list above; open it to play.', 'Pascal,Pascal 2'])
  page.check('the copy has an identifier of its own', [importedId, pascalId].includes(await profileId('Pascal 2')), false)
  await playProfile(page, 'Pascal')
  await typePin(page, '1234')
  page.check('Pascal is left as it was, without the game it removed', await libraryGames(page), '')
  await switchProfile(page)

  // A locked profile file, and a game chosen as one.
  writeFileSync(locked, lockedCopy(readFileSync(profileFile)))
  await importFile(locked)
  page.check('a profile file locked with a password says to unzip it first', await error(), 'locked.zip: This file is locked with a password, which Datajack cannot open. Unzip it with its password, zip what it holds again without one, then use that new file.')
  await importFile(archive)
  page.check('a game chosen as a profile says where it goes', await error(), 'The Letter 1.0.zip: This file is a game, not a profile: open a profile, then use Add a game…')
  page.check('nothing was imported', await profileNames(), 'Pascal,Pascal 2')
}

/** The zip with its first entry marked encrypted in the file list, as zip tools lock it with a password. */
function lockedCopy(bytes) {
  const copy = Buffer.from(bytes)
  const end = copy.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  const central = copy.readUInt32LE(end + 16)
  copy.writeUInt16LE(copy.readUInt16LE(central + 8) | 1, central + 8)
  return copy
}
