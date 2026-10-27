// Previewing from a card of the storyboard: a path is found to it, and the stage follows that path.
import { createProjectWithSample, pause } from './harness.mjs'

export default async function check(page, { url }) {
  const clickCard = async test => {
    await page.evaluate(`[...document.querySelectorAll('.grid .lane > .elements > .element.card')].find(card => (${test})(card)).click()`)
    await pause(200)
  }

  await createProjectWithSample(page, url, 'Paths')
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await page.evaluate(`document.querySelector('.grid .element.block').click()`)
  await pause(200)
  await page.press('Enter')
  await clickCard(`card => card.querySelector('.text')?.textContent === "Don't do that."`)
  page.check('a card offers to preview from it', await page.evaluate(`[...document.querySelectorAll('.inspector .button')].some(button => button.textContent.startsWith('Preview from here'))`), true)
  await page.press('p')
  await page.waitFor('.viewport .text')
  await pause(500)
  page.check('the preview opens on that page', await page.evaluate(`document.querySelector('.viewport .text')?.textContent`), "Don't do that.")
  page.check('with the stage of the path to it', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 1)
  await page.screenshot('preview-from-page')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  page.check('leaving comes back to the storyboard', await page.evaluate(`document.querySelector('.tab.current')?.textContent.trim()`), 'Storyboard')

  await page.evaluate(`document.querySelector('.board').focus()`)
  await page.press('Escape')
  await page.press('Escape')
  await clickCard(`card => card.querySelector('.speaker')?.textContent.startsWith('Choice')`)
  await page.press('p')
  await page.waitFor('.viewport .option')
  page.check('previewing from a choice shows the choice', await page.evaluate(`document.querySelectorAll('.viewport .option').length`), 2)
}
