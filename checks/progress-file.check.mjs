// A game's progress to a file and back, as a player carries it to another computer: the endings reached
// come back once the file is loaded, joined to what the profile has.
import { createProfile, createProjectWithStory, exportGame, installGame, pause } from './harness.mjs'

const STORY = `# One
The only page.
[ending: Home]`

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Homeward', STORY)
  const archive = await exportGame(page, 'homeward.zip')
  await createProfile(page, await serve('datajack'), 'Pascal')
  await installGame(page, archive)
  const card = () => page.evaluate(`document.querySelector('.chapters')?.textContent.trim()`)

  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  for (let press = 0; press < 5 && !await page.evaluate(`!!document.querySelector('.viewport .end-screen')`); press++) {
    await page.press(' ')
    await pause(400)
  }
  await page.evaluate(`document.querySelector('.leave-button, .end-button')?.click()`)
  await pause(800)
  if (await page.evaluate(`!document.querySelector('.library')`)) {
    await page.press('Escape')
    await pause(800)
  }
  page.check('the card counts the ending reached', (await card())?.endsWith('endings reached: 1 of 1'), true)

  const link = '.game a.link-button'
  page.check('the card offers its progress as a file', await page.evaluate(`document.querySelector('${link}')?.textContent.trim()`), 'Progress to a file')
  await page.evaluate(`document.querySelector('${link}').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`)
  await pause(200)
  const file = await page.saveDownload('progress.json', link)

  await page.clickButton('Erase what Datajack keeps…', '.erase .link-button')
  await pause(200)
  await page.clickButton('Erase the games, the saves and the progress', '.erase .button')
  await pause(800)
  await installGame(page, archive)
  page.check('erased, the progress is gone', (await card())?.endsWith('endings reached: 0 of 1'), true)

  await page.setFiles('.load-button .file-input', [file])
  await pause(1000)
  page.check('loading the file says so', await page.statusText(), 'The progress of Homeward was loaded, joined to what you had reached.')
  page.check('and the ending reached is back', (await card())?.endsWith('endings reached: 1 of 1'), true)
}
