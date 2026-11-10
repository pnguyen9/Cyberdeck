// A game exported with only its first chapter, the second kept quiet about, played in Datajack: the
// library counts one chapter; running out of chapters is no ending; the end screen says the story goes on, in the words the route taken gave, and the map shows
// no end where the next chapter is.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, shownStep } from './harness.mjs'

const STORY = `# Monday
The week begins.
[choice: Breakfast]
> Toast = Toast
> Rice = Rice
[if: Breakfast is Toast]
[to be continued: Tuesday, and its toast, come with the next update.]
[end]
You eat.
# Tuesday
The week goes on.
[ending: Friday]`

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Week', STORY)
  await page.clickButton('Export', '.tab')
  await pause(300)
  await page.evaluate(`[...document.querySelectorAll('.export .chapters input[type=checkbox]')][1].click()`)
  await pause(200)
  await page.evaluate(`document.querySelector('.export .left-out input[value=hidden]').click()`)
  await pause(200)
  const archive = await exportGame(page, 'monday.zip')

  await createProfile(page, await serve('datajack'), 'Pascal')
  await installGame(page, archive)
  page.check('the library says nothing of the chapter left out', (await page.evaluate(`document.querySelector('.chapters')?.textContent.trim()`))?.startsWith('1 chapter ·'), true)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  for (let press = 0; press < 10 && await shownStep(page) !== 'CHOICE'; press++) {
    await page.press(' ')
  }
  await pause(400)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes('Toast')).click()`)
  await pause(300)
  for (let press = 0; press < 10 && !await page.evaluate(`!!document.querySelector('.viewport .end-screen')`); press++) {
    await page.press(' ')
    await pause(200)
  }
  await pause(500)
  page.check('the end screen says the story goes on, as the route taken wrote it', (await shownStep(page))?.startsWith('Tuesday, and its toast, come with the next update.'), true)
  await page.screenshot('to-be-continued')

  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(300)
  page.check('the map shows the choice, and no end after it', await page.evaluate(`[...document.querySelectorAll('.node')].map(node => node.querySelector('h2')?.textContent ?? node.textContent.trim())`), ['Breakfast'])
}
