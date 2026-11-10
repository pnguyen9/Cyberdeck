// Datajack's settings open from the library, before any game: on a screen of their own, drawn as in a
// game and kept for the profile; Escape goes back to the library.
import { createProfile, pause } from './harness.mjs'

export default async function check(page, { serve }) {
  await createProfile(page, await serve('datajack'), 'Pascal')
  await page.clickButton('Settings', '.header-actions .button')
  await page.waitFor('.settings-screen .overlay')
  page.check('the settings open from the library', await page.evaluate(`document.querySelector('.settings-screen h2')?.textContent`), 'Settings')
  page.check('the language is among them, within reach', await page.evaluate(`(() => {
    const category = document.querySelector('.settings-screen .category')
    category.scrollTop = category.scrollHeight
    return category.lastElementChild.getBoundingClientRect().bottom <= category.getBoundingClientRect().bottom + 1 && category.lastElementChild.querySelector('select') !== null
  })()`), true)
  await page.evaluate(`[...document.querySelectorAll('.settings-screen .category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
  await pause(100)
  await page.evaluate(`[...document.querySelectorAll('.settings-screen .choice-button')].find(button => button.textContent.trim() === 'Stays put').click()`)
  await pause(100)
  await page.screenshot('settings')
  await page.press('Escape')
  await pause(300)
  page.check('Escape goes back to the library', await page.evaluate(`!!document.querySelector('.library') && !document.querySelector('.settings-screen')`), true)
  page.check('what was chosen is kept for the profile', await page.evaluate(`Object.entries(localStorage).find(([key]) => key.startsWith('datajack:settings:'))?.[1].includes('"namePlateMotion":"fixed"')`), true)
}
