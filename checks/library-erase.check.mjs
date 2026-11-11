// Erasing what Datajack keeps, from the library: the games alone, the saves kept for when they come
// back; or the games with the profile's saves and progress. And one game's own, from its card: its
// progress alone, its saves alone, the game staying installed.
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
  page.check('installed again, the same file, it starts afresh', [await page.evaluate(`document.querySelectorAll('.game').length`), (await buttons()).includes('Continue')], [1, false])

  const hasProgress = () => page.evaluate(`[...document.querySelectorAll('.game .link-button')].some(link => link.textContent.trim() === 'Progress to a file')`)
  const eraseOne = async label => {
    await page.clickButton('Erase…', '.game .link-button')
    await pause(200)
    await page.clickButton(label, '.game .button')
    await pause(800)
  }
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(600)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  page.check('played again: a save to continue, and progress', [(await buttons()).includes('Continue'), await hasProgress()], [true, true])
  await eraseOne('Its progress')
  page.check('erasing the progress of one game keeps its saves', [await page.statusText(), (await buttons()).includes('Continue'), await hasProgress()],
    ['The progress of Erasable was erased: its endings, map, gallery, pages read and what it remembers.', true, false])
  await eraseOne('Its saves')
  page.check('erasing its saves, it starts afresh, still installed', [await page.statusText(), (await buttons()).includes('Continue'), await page.evaluate(`document.querySelectorAll('.game').length`)],
    ['The saves of Erasable were erased.', false, 1])
}
