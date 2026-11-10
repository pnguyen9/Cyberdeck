// Erasing what Cyberdeck keeps, from the projects page: the saves and progress of the previews, so
// that a story plays from a clean start, its lasting values back to what it declares; or every
// project with them.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter lasting: Coins = 0]
You have {Coins} coins.
[add: Coins 5]
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Coins', STORY)
  const preview = async () => {
    await page.clickButton('Preview ▶', '.button')
    await page.waitFor('.viewport .text')
    await pause(800)
    const shown = await shownStep(page)
    for (let press = 0; press < 4; press++) {
      await page.press(' ')
      await pause(300)
    }
    await page.evaluate(`document.querySelector('.leave-button').click()`)
    await pause(800)
    return shown
  }
  const erase = async label => {
    await page.clickButton('← Projects')
    await pause(800)
    await page.clickButton('Erase what Cyberdeck keeps…', '.erase .link-button')
    await pause(200)
    await page.clickButton(label, '.erase .button')
    await pause(800)
  }

  page.check('the first preview starts with what the story declares', await preview(), 'You have 0 coins.')
  page.check('the next carries over what the last left', await preview(), 'You have 5 coins.')

  await erase('Erase the preview saves and progress')
  page.check('erasing the previews says so, and keeps the project', [await page.statusText(), await page.evaluate(`document.querySelectorAll('.project').length`)], ['The saves and progress of the previews were erased.', 1])
  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(800)
  page.check('a preview then starts from a clean start', await preview(), 'You have 0 coins.')

  await erase('Erase every project too')
  page.check('erasing every project too leaves none', [await page.statusText(), await page.evaluate(`document.querySelectorAll('.project').length`)], ['Every project was erased, with the saves and progress of the previews.', 0])
}
