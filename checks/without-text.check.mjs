// A project begun without any text: an empty chapter, written page by page in the storyboard; then
// a second chapter and a scene from the story's level, named so that each has its own name.
import { createProject, pause, showStory } from './harness.mjs'

export default async function check(page, { url }) {
  await createProject(page, url, 'Blank')
  await page.clickButton('Start without a text', '.import .link-button')
  await page.waitFor('.grid')
  await pause(400)
  page.check('an empty chapter opens in the storyboard', [await page.statusText(), await page.evaluate(`document.querySelector('.chapter-picker select').selectedOptions[0].textContent`)], ['Chapter 1 is ready: write its first page here.', 'Chapter 1'])
  await page.clickButton('Write the first page N', '.inspector-actions .button')
  await pause(300)
  await page.typeText('— Marie: Here we are.')
  await pause(300)
  await page.press('Enter', { ctrl: true })
  await pause(500)
  page.check('its first page is written there', await page.evaluate(`[...document.querySelectorAll('.grid .text')].map(text => text.textContent.trim())`), ['Here we are.'])

  await showStory(page)
  await page.evaluate(`[...document.querySelectorAll('.add-actions .button')].find(button => button.textContent.trim().startsWith('New chapter')).click()`)
  await pause(500)
  await showStory(page)
  await page.clickButton('New scene', '.add-actions .button')
  await pause(500)
  await showStory(page)
  page.check('more chapters and scenes, each with a name of its own', await page.evaluate(`[...document.querySelectorAll('.story-level .chapter .title')].map(title => title.textContent.trim())`), ['Chapter 1', 'Chapter 2', 'Scene 1'])
  await page.screenshot('story')
}
