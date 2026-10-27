// Going back in the player, and its guards against worn mice and wheels: arrows, the mouse's back
// button, the wheel, and choices, played in Cyberdeck's preview of the sample story.
import { advanceUntil, createProjectWithSample, pause, shownStep } from './harness.mjs'

export default async function check(page, { url }) {
  const mouseButton = async button => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: 640, y: 300, button, clickCount: 1, buttons: 0 })
    }
  }
  const wheel = deltaY => page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 300, deltaX: 0, deltaY })
  const startsWith = async prefix => (await shownStep(page)).startsWith(prefix)

  await createProjectWithSample(page, url, 'Going back')
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  const previewUrl = await page.evaluate('location.href')
  page.check('back is disabled on the first page', await page.evaluate(`document.querySelector('.quick-button').disabled`), true)

  await page.press('ArrowRight')
  await page.press('ArrowRight')
  page.check('the right arrow completes the page, then moves on', await startsWith('Somewhere'), true)
  await page.press('ArrowLeft')
  page.check('the left arrow goes back, the page shown complete', await shownStep(page), 'The classroom was empty. The last rays of the sun slid across the desks, and the dust floated in the light as if it had nowhere else to be.')
  page.check('its typing is complete', await page.evaluate(`!!document.querySelector('.viewport .continue-mark')`), true)

  await mouseButton('left')
  await pause(10)
  await mouseButton('left')
  await pause(300)
  page.check('two clicks 10 ms apart move one page only', await startsWith('Somewhere'), true)

  await mouseButton('back')
  await pause(300)
  page.check('the mouse back button goes back', await startsWith('The classroom'), true)
  page.check('and stays in the page', await page.evaluate('location.href'), previewUrl)

  await wheel(120)
  await wheel(120)
  await pause(300)
  page.check('a burst of wheel events moves one step', await startsWith('Somewhere'), true)
  await wheel(-120)
  await pause(300)
  page.check('the wheel up goes back', await startsWith('The classroom'), true)

  await advanceUntil(page, step => step === 'CHOICE')
  page.check('the choice is reached', await shownStep(page), 'CHOICE')
  await pause(500)
  await page.evaluate(`document.querySelectorAll('.viewport .option')[0].click()`)
  await pause(300)
  page.check('the first option is picked', await startsWith('Because I was afraid'), true)
  await page.press('ArrowLeft')
  await pause(500)
  page.check('going back returns to the choice', await shownStep(page), 'CHOICE')
  await page.press('ArrowLeft')
  await pause(150)
  page.check('the left arrow on the choice goes to the page before it', await startsWith('I read your letter'), true)
  await page.screenshot('back-before-choice')
  await page.press(' ')
  await pause(600)
  await page.evaluate(`document.querySelectorAll('.viewport .option')[1].click()`)
  await pause(300)
  page.check('another option can be picked', await startsWith('Did you see the sunset'), true)
}
