// The preview's State panel, for an author: a memory ticked by hand, as on a second playthrough, and a
// counter given a number; what follows reads them, and the memory is kept for the next previews.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter: Coins = 0]
The gate.
[if: remembered Met the cat]
The cat knows you.
[else if: Coins > 5]
Rich already.
[else]
A cat you never met.
[end]
[remember: Met the cat]
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Cat', STORY)
  const preview = async () => {
    await page.clickButton('Preview ▶', '.button')
    await page.waitFor('.viewport .text')
    await pause(800)
    await page.clickButton('State', '.quick-button')
    await pause(300)
  }
  await preview()
  page.check('the State panel offers its values to change', await page.evaluate(`document.querySelector('.state-panel .hint')?.textContent.trim()`), 'Change any of these to try the story from here: what follows reads the new values.')
  await page.setValue('.state-panel input[aria-label="Coins"]', '9')
  await page.evaluate(`document.querySelector('.state-panel input[aria-label="Coins"]').dispatchEvent(new Event('change'))`)
  await pause(200)
  await page.press(' ')
  await pause(700)
  page.check('a counter given a number by hand is read by what follows', await shownStep(page), 'Rich already.')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  // A new preview: no memory yet; ticked by hand, the cat knows you, as on a second playthrough.
  await preview()
  await page.evaluate(`[...document.querySelectorAll('.state-panel .check')].find(label => label.textContent.includes('Met the cat')).querySelector('input').click()`)
  await pause(200)
  await page.screenshot('state')
  await page.press(' ')
  await pause(700)
  page.check('a memory ticked by hand is read by what follows', await shownStep(page), 'The cat knows you.')
}
