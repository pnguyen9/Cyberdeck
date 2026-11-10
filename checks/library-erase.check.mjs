// Erasing what Datajack keeps, from the library: the games alone, the saves kept for when they come
// back; or the games with the profile's saves and progress.
import { createProfile, createProjectWithStory, exportGame, installGame, pause } from './harness.mjs'

const STORY = `# One
The first page.
The second page.`

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Erasable', STORY)
  const archive = await exportGame(page, 'erasable.zip')
  await createProfile(page, await serve('datajack'), 'Pascal')
  const buttons = () => page.evaluate(`[...document.querySelectorAll('.game .button')].map(button => button.textContent.trim())`)
  const erase = async label => {
    await page.clickButton('Erase what Datajack keeps…', '.erase .link-button')
    await pause(200)
    await page.clickButton(label, '.erase .button')
    await pause(800)
  }

  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(600)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  page.check('a game played can be continued', (await buttons()).includes('Continue'), true)

  await erase('Erase the games')
  page.check('erasing the games empties the library', [await page.evaluate(`document.querySelectorAll('.game').length`), await page.statusText()], [0, 'Every game was erased.'])
  await installGame(page, archive)
  page.check('its saves were kept: installed again, it continues', (await buttons()).includes('Continue'), true)

  await erase('Erase the games, the saves and the progress')
  page.check('erasing the saves too', await page.statusText(), 'Every game was erased, with the saves and the progress.')
  await installGame(page, archive)
  page.check('installed again, it starts afresh', (await buttons()).includes('Continue'), false)
}
