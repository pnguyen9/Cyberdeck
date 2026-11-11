// A game's own settings, from its card in the library: at first the profile's, for every game; given
// its own, it starts from them, and what changes there changes for that game alone, in the game too;
// back to the profile's, its own are forgotten.
import { createProfile, createProjectWithStory, exportGame, installGame, pause } from './harness.mjs'

export const app = 'datajack'

const STORY = `— Marie: Hello.
— Marie: Goodbye.`

const motion = page => page.evaluate(`[...document.querySelectorAll('.choice-button')].find(button => button.getAttribute('aria-checked') === 'true' && ['Slides to who speaks', 'Jumps to who speaks', 'Stays put'].includes(button.textContent.trim()))?.textContent.trim() ?? null`)
const scope = page => page.evaluate(`(() => {
  const group = document.querySelector('.scope')
  return group === null ? null : [group.querySelector('span').textContent, [...group.querySelectorAll('label')].find(label => label.querySelector('input').checked)?.textContent.trim()]
})()`)
const accessibility = page => page.evaluate(`[...document.querySelectorAll('.category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
const pick = (page, text) => page.evaluate(`[...document.querySelectorAll('.choice-button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`)

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, await serve('cyberdeck'), 'Own settings', STORY)
  const archive = await exportGame(page, 'own-settings.zip')
  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)

  await page.clickButton('Settings', '.game .link-button')
  await page.waitFor('.settings-screen .overlay')
  page.check('a game uses the profile settings at first', await scope(page), ['Settings for Own settings:', 'the profile’s, for every game'])
  await page.evaluate(`[...document.querySelectorAll('.scope label')].find(label => label.textContent.trim() === 'its own').querySelector('input').click()`)
  await pause(200)
  await accessibility(page)
  await pause(100)
  await pick(page, 'Stays put')
  await pause(200)
  page.check('given its own, it changes for that game', [await scope(page), await motion(page)], [['Settings for Own settings:', 'its own'], 'Stays put'])
  await page.press('Escape')
  await pause(300)

  await page.clickButton('Settings', '.header-actions .button')
  await page.waitFor('.settings-screen .overlay')
  await accessibility(page)
  await pause(100)
  page.check('the profile keeps its own, with no game named', [await scope(page), await motion(page)], [null, 'Slides to who speaks'])
  await page.press('Escape')
  await pause(300)

  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Settings').click()`)
  await pause(300)
  await accessibility(page)
  await pause(100)
  page.check('in the game, its own settings', [await scope(page), await motion(page)], [['Settings for Own settings:', 'its own'], 'Stays put'])
  await page.evaluate(`[...document.querySelectorAll('.scope label')].find(label => label.textContent.trim() === 'the profile’s, for every game').querySelector('input').click()`)
  await pause(200)
  page.check('back to the profile settings, its own forgotten', [await scope(page), await motion(page), await page.evaluate(`Object.keys(localStorage).some(key => key.includes(':game:'))`)], [['Settings for Own settings:', 'the profile’s, for every game'], 'Slides to who speaks', false])
}
