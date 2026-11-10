// A project made again from the game exported, for an author who lost it: the game restored on the
// projects page, its chapters back, the one it left out said.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `# Monday
The week begins.
# Tuesday
The week goes on.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Week', STORY)
  await page.clickButton('Export', '.tab')
  await pause(300)
  await page.evaluate(`[...document.querySelectorAll('.export .chapters input[type=checkbox]')][1].click()`)
  await pause(200)
  await page.clickButton('Export', '.export .button')
  await page.waitFor('.export .download')
  const game = await page.saveDownload('week.zip', '.export .download')

  await page.clickButton('← Projects')
  await pause(800)
  await page.clickButton('Delete', '.link-button')
  await pause(200)
  await page.clickButton('Delete', '.button')
  await pause(800)
  page.check('the project is gone', await page.evaluate(`document.querySelectorAll('.project').length`), 0)

  await page.setFiles('.file-button input[type=file]', [game])
  await pause(1500)
  page.check('the game restores as its project, saying what it left out', await page.statusText(), 'Week was made again from the game. The game left out a chapter: import it to have the whole story. Files the game did not use wait for theirs in Cast & files.')
  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(1000)
  page.check('its chapter is back', await page.evaluate(`[...document.querySelectorAll('.story-level .card.chapter .title')].map(title => title.textContent)`), ['Monday'])
}
