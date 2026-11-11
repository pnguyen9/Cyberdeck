// The map in Cyberdeck's preview, as Datajack shows it: opened from the end screen, the choice and the
// option tried; every path, explored from the story, or only those played; playing from the point
// previews from it, and closing the map goes back to the preview.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[no going back]
A fork in the road.
[choice: Road]
> Left = Left
> Right = Right
You took the {Road} road.
[ending: Arrived]`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Roads', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(600)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === 'Left').click()`)
  await pause(600)
  for (let press = 0; press < 4 && !(await page.evaluate(`!!document.querySelector('.viewport .end-screen')`)); press++) {
    await page.press(' ')
    await pause(600)
  }
  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(500)
  page.check('the preview has the map: the choice, the option tried, the ending', await page.evaluate(`[...document.querySelectorAll('.map-screen .node')].map(node => node.querySelector('h2')?.textContent ?? node.textContent.trim())`), ['Road', '★ Arrived'])
  page.check('the author plays from any point, [no going back] or not', await page.evaluate(`!!document.querySelector('.map-screen .play-button')`), true)
  await page.clickButton('Every path', '.switch-button')
  await pause(600)
  page.check('every path, explored from the story: both options taken, though one was played', [
    await page.evaluate(`document.querySelector('.map-screen .subtitle').textContent`),
    await page.evaluate(`[...document.querySelectorAll('.map-screen .options li')].map(option => option.textContent.trim())`),
  ], ['every path, explored from the story', ['› Left', '› Right']])
  await page.clickButton('The paths played', '.switch-button')
  await pause(600)
  page.check('and back to the paths played', await page.evaluate(`[...document.querySelectorAll('.map-screen .options li')].map(option => option.textContent.trim())`), ['› Left', '? Right'])
  await page.evaluate(`document.querySelector('.map-screen .play-button').click()`)
  await page.waitFor('.viewport .option')
  await pause(600)
  page.check('playing from the point previews from it', await shownStep(page), 'CHOICE')
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Map').click()`)
  await page.waitFor('.map-screen')
  await pause(400)
  await page.clickButton('← Preview', '.close-button')
  await page.waitFor('.viewport')
  await pause(600)
  page.check('closing the map goes back to the preview', await shownStep(page), 'CHOICE')
}
