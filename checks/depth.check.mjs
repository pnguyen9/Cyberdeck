// Depth in the preview: a character near is larger and in front, one far smaller and behind; a move
// may change the depth alone.
import { pause } from './harness.mjs'

const STORY = `[enter: marie left near] [enter: jules right far]
Both of them.
[move: marie far]
Marie steps back.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Depth')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts depths', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character')
  await pause(1200)
  const depths = () => page.evaluate(`[...document.querySelectorAll('.viewport .character')].map(character => character.dataset.characterId && [character.querySelector('.placeholder-label')?.textContent.split(' ·')[0], character.style.scale, character.style.zIndex].join(' '))`)
  page.check('near is larger and in front, far smaller and behind', await depths(), ['marie 1.25 3', 'jules 0.75 1'])
  page.check('characters stay under the menu', await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('.viewport .quick-button')].find(candidate => candidate.textContent === 'Load')
    const rect = button.getBoundingClientRect()
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === button
  })()`), true)
  await page.screenshot('depth')
  await page.press(' ')
  await page.press(' ')
  await pause(1200)
  page.check('a move to a depth alone', await depths(), ['marie 0.75 1', 'jules 0.75 1'])
}
