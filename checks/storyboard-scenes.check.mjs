// From a `[play]` to its scene and back, in the storyboard: the play's panel opens the scene; the scene
// says where it is played from, each a way back to that `[play]`.
import { createProjectWithStory, openChapterBoard, pause } from './harness.mjs'

const STORY = `# Lake
We reach the lake.
[play: Swim]
Back on the shore.

# Scene: Swim
The water is cold.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Scenes', STORY)
  await openChapterBoard(page)
  await pause(600)
  await page.evaluate(`[...document.querySelectorAll('.element.marker')].find(marker => marker.textContent.includes('Swim')).click()`)
  await pause(400)
  await page.clickButton('Open the scene', '.button')
  await pause(800)
  page.check('the play opens its scene', await page.evaluate(`document.querySelector('.chapter-picker select').selectedOptions[0].textContent`), 'Swim')
  page.check('the scene says where it is played from', await page.evaluate(`document.querySelector('.played-from')?.textContent.replace(/\\s+/g, ' ').trim()`), 'Played from: Lake')
  await page.clickButton('Lake', '.played-from .link-button')
  await pause(800)
  page.check('and leads back to the play, selected', [
    await page.evaluate(`document.querySelector('.chapter-picker select').selectedOptions[0].textContent`),
    await page.evaluate(`document.querySelector('.element.focused, .element[aria-current], .element.is-focused')?.textContent.includes('Swim') ?? null`),
  ], ['Lake', true])
}
