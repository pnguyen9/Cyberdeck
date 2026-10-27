// The player's settings, in Cyberdeck's preview: pages shown at once, a key given to another action,
// the music volume, the text hidden with the right button, and all of it kept for the next preview.
import { createProjectWithSample, pause, shownStep, visibleText } from './harness.mjs'

export default async function check(page, { url }) {
  await createProjectWithSample(page, url, 'Settings')
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(500)

  await page.press('o')
  page.check('O opens the settings', await page.evaluate(`document.querySelector('.overlay h2')?.textContent`), 'Settings')
  await page.evaluate(`[...document.querySelectorAll('.overlay .check input')][0].click()`)
  await pause(100)
  page.check('pages can be shown at once', await page.evaluate(`document.querySelector('.overlay .setting-value').textContent`), 'instant')

  await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Next')).querySelector('.add').click()`)
  await pause(100)
  await page.press('n')
  page.check('a key pressed is given to the action', await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Next')).querySelector('.inputs').textContent.includes('N')`), true)
  await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Log')).querySelector('.add').click()`)
  await pause(100)
  await page.press('n')
  page.check('taking a key from another action says so', await page.evaluate(`document.querySelector('.overlay .notice').textContent`), 'N now does “Log”, no longer “Next”.')
  await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Log')).querySelector('.remove:last-of-type, .input:last-child .remove').click()`)
  await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Next')).querySelector('.add').click()`)
  await pause(100)
  await page.press('n')
  await page.setValue('.overlay input[aria-label="Music volume"]', '20')
  await pause(100)
  page.check('the music volume follows the slider', await page.evaluate(`document.querySelector('.viewport audio').volume`), 0.2)
  await page.press('Escape')
  await pause(200)
  page.check('Escape closes the settings', await page.evaluate(`document.querySelector('.overlay') === null`), true)

  // The first page began typing before the change: the first press completes it, the next one moves on.
  await page.press('n')
  const before = await shownStep(page)
  await page.press('n')
  await pause(300)
  const after = await shownStep(page)
  page.check('the new key moves on', after !== before, true)
  page.check('the page is shown at once', await visibleText(page), after)

  await page.evaluate(`document.querySelector('.viewport .screen').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))`)
  await pause(200)
  page.check('the right button hides the text', await page.evaluate(`document.querySelector('.viewport .textbox') === null && document.querySelector('.viewport .quick-menu') === null`), true)
  await page.evaluate(`document.querySelector('.viewport .screen').click()`)
  await pause(200)
  page.check('a click shows it again, without moving on', [await page.evaluate(`document.querySelector('.viewport .textbox') !== null`), await shownStep(page)], [true, after])
  await page.screenshot('playing')

  await page.press('Escape')
  await pause(300)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  await page.press('o')
  page.check('the settings are kept for the next preview', [
    await page.evaluate(`document.querySelector('.overlay .setting-value').textContent`),
    await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Next')).querySelector('.inputs').textContent.includes('N')`),
  ], ['instant', true])
  await page.screenshot('settings')
}
