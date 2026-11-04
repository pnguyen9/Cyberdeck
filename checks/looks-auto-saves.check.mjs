// What 1.4 adds to how a game looks and plays: the text box and the name plate drawn by the game's
// CSS and picture frames, a colour for a character's name; values in the text; auto mode moving on
// by itself and giving way to the player; save slots showing a picture of the stage.
import { writeFileSync } from 'node:fs'
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter: Hour = 8]
[bg: rooftop]
[enter: marie left]
— Marie: It is {Hour} o'clock.
[add: Hour 2]
— Marie: Now it is {Hour}.
Still nobody.
The end.`

const FRAME = `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90">
  <rect x="2" y="2" width="86" height="86" rx="20" fill="#2b1d10" stroke="#e9b44c" stroke-width="6"/>
  <circle cx="14" cy="14" r="9" fill="#e9b44c"/><circle cx="76" cy="14" r="9" fill="#e9b44c"/>
  <circle cx="14" cy="76" r="9" fill="#e9b44c"/><circle cx="76" cy="76" r="9" fill="#e9b44c"/>
</svg>`

export default async function check(page, { url, assets, output }) {
  const frame = `${output}/text-box.svg`
  writeFileSync(frame, FRAME)
  await createProjectWithStory(page, url, 'Looks', STORY)
  page.check('the story imports without problems', await page.evaluate(`document.querySelectorAll('.import .problems li').length`), 0)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [frame, `${assets}/Rooftop.svg`, `${assets}/marie.svg`])
  await pause(1200)
  page.check('a picture named text-box becomes the frame of the text box', (await page.statusText())?.includes('text-box.svg → Frame of the text box'), true)
  await page.setValue('.cast input[type=color]', '#ff6699', 'change')
  await pause(300)

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions textarea.css')
  await page.setValue('.definitions textarea.css', '.name-plate { background: #3a0d24; border-color: #ff6699 }')
  await page.clickButton('Save the CSS', '.button')
  await pause(300)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .textbox')
  await pause(1500)
  page.check('values show in the text', await shownStep(page), 'It is 8 o\'clock.')
  page.check('the box takes its frame, the plate the CSS and the character\'s colour', await page.evaluate(`(() => {
    const box = getComputedStyle(document.querySelector('.viewport .textbox'))
    const plate = getComputedStyle(document.querySelector('.viewport .speaker'))
    return [box.borderImageSource.startsWith('url('), plate.backgroundColor, plate.color]
  })()`), [true, 'rgb(58, 13, 36)', 'rgb(255, 102, 153)'])
  await page.screenshot('looks')

  // Auto mode moves on by itself, then a key of the player's takes over.
  await page.press('a')
  await pause(2700)
  page.check('auto mode moves on by itself, after a reading time', await shownStep(page), 'Now it is 10.')
  await page.press(' ')
  await pause(300)
  const taken = await shownStep(page)
  const pressed = await page.evaluate(`document.querySelector('.viewport .auto-button').getAttribute('aria-pressed')`)
  await pause(3500)
  page.check('a key of the player\'s takes over from it', [taken, pressed, await shownStep(page)], ['Still nobody.', 'false', 'Still nobody.'])

  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Save').click()`)
  await page.waitFor('.overlay .slot')
  await page.evaluate(`document.querySelector('.overlay .slot').click()`)
  await pause(800)
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Load').click()`)
  await page.waitFor('.overlay .slot')
  await pause(400)
  page.check('a save shows a picture of the stage', await page.evaluate(`(() => {
    const picture = [...document.querySelectorAll('.overlay .slot img.slot-picture')].at(-1) ?? document.querySelector('.overlay .slot img.slot-picture')
    return picture !== null && picture.src.startsWith('data:image/jpeg') && picture.naturalWidth === 320
  })()`), true)
  await page.screenshot('slots')
}
