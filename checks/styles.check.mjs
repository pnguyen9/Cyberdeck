// Named styles: declared once, used inside the text, drawn by the preview from the properties of
// the style, shown as typing reaches them, and kept in the log.
import { pause } from './harness.mjs'

const STORY = `[style: Whisper = italic, small, grey]
— Marie: [style: whisper]Don't tell anyone.[style: none] Promise?
It was [style: bold]very[style: none] quiet.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Styles')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts the style and its uses', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .textbox')
  await page.press(' ')
  await pause(300)
  const runs = () => page.evaluate(`[...document.querySelectorAll('.viewport .textbox .text span')].map(run => [run.textContent, [...run.classList].filter(name => name.startsWith('style-')).join(' ')])`)
  page.check('the whisper is italic, small and grey', await runs(), [["Don't tell anyone.", 'style-italic style-small style-grey'], [' Promise?', '']])
  page.check('italics are drawn as such', await page.evaluate(`getComputedStyle(document.querySelector('.viewport .style-italic')).fontStyle`), 'italic')
  await page.screenshot('whisper')
  await page.press(' ')
  await page.press(' ')
  await pause(300)
  page.check('a property alone is a style of its own', (await runs()).find(([text]) => text === 'very')?.[1], 'style-bold')
  await page.clickButton('Log', '.quick-button')
  await pause(300)
  page.check('the log keeps the styles of what was read', await page.evaluate(`[...document.querySelectorAll('.overlay .line .text span')].filter(run => run.className !== '').map(run => [run.textContent, run.className])`), [["Don't tell anyone.", 'style-italic style-small style-grey']])
  await page.screenshot('log')
}
