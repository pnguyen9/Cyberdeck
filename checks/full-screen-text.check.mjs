// Full-screen text in the preview: pages pile up on the screen, a clear starts a new one, going back
// and loading a save show the screen as it was, and the box comes back when asked.
import { pause } from './harness.mjs'

const STORY = `[text: full]
— Marie: The first page.
The second one.
[clear]
A new screen.
[text: box] [enter: marie right]
— Marie: Back in the box.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Full')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts it', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .full-text')
  const screen = () => page.evaluate(`[...document.querySelectorAll('.viewport .full-text .paragraph')].map(paragraph => paragraph.textContent.trim())`)
  const next = async () => {
    await page.press(' ')
    await page.press(' ')
    await pause(500)
  }
  await page.press(' ')
  page.check('the text is over the whole screen, the speaker on a plate above', await page.evaluate(`[...document.querySelectorAll('.viewport .full-text .paragraph')].map(paragraph => [paragraph.querySelector('.speaker')?.textContent ?? null, paragraph.querySelector('.paragraph-text').textContent.trim()])`), [['Marie', 'The first page.']])
  await next()
  page.check('pages pile up', (await screen()).length, 2)
  page.check('the menu sits below the text', await page.evaluate(`(() => {
    const lastLine = [...document.querySelectorAll('.viewport .full-text .paragraph')].at(-1).getBoundingClientRect()
    return document.querySelector('.viewport .quick-menu').getBoundingClientRect().top > lastLine.bottom
  })()`), true)
  await page.screenshot('piled')
  await page.clickButton('Save', '.quick-button')
  await pause(300)
  await page.evaluate(`document.querySelectorAll('.slot')[0].click()`)
  await pause(300)
  await next()
  page.check('a clear starts a new screen', await screen(), ['A new screen.'])
  await page.clickButton('Load', '.quick-button')
  await pause(300)
  await page.evaluate(`[...document.querySelectorAll('.slot')].find(slot => slot.textContent.includes('Slot 1')).click()`)
  await pause(500)
  page.check('loading a save shows the screen as it was', (await screen()).length, 2)
  await next()
  await page.press('ArrowLeft')
  await pause(400)
  page.check('going back shows the screen as it was', (await screen()).length, 2)
  await page.press(' ')
  await next()
  page.check('the box comes back', [await page.evaluate(`document.querySelector('.viewport .full-text') === null`), await page.evaluate(`document.querySelector('.viewport .textbox .text')?.textContent`)], [true, 'Back in the box.'])
  await pause(400)
  page.check('the name plate sits above the speaker, on the right', await page.evaluate(`(() => {
    const plate = document.querySelector('.viewport .textbox .speaker').getBoundingClientRect()
    const marie = document.querySelector('.viewport .character').getBoundingClientRect()
    return Math.abs((plate.left + plate.right) / 2 - (marie.left + marie.right) / 2) < 30
  })()`), true)
  await page.screenshot('plate')
}
