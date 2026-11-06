// Choices with many options: six fit above the text box, none cut nor under the menu buttons; twelve
// scroll in their place, the last reached from the keyboard, the wheel scrolling them rather than
// going back; past eight, the import says the list is long.
import { createProject, pause } from './harness.mjs'

const optionsOf = count => Array.from({ length: count }, (_, index) => `> Option number ${index + 1} = O${index + 1}`).join('\n')
const STORY = `Hello.\n[choice: Six]\n${optionsOf(6)}\nBetween.\n[choice: Twelve]\n${optionsOf(12)}\nThe end.`

export default async function check(page, { url }) {
  await createProject(page, url, 'Many options')
  await page.setValue('.import .source', STORY)
  await pause(800)
  page.check('the import says a list of twelve is long', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent.trim())`), [
    'Line 10 — 12 options: more than fit on the screen, so players see them in a list that scrolls. Fewer reads more easily; a choice can lead to another.',
  ])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(900)

  // Every option inside the screen, above the menu buttons.
  const layout = `(() => {
    const viewport = document.querySelector('.viewport').getBoundingClientRect()
    const buttons = document.querySelector('.viewport .quick-menu').getBoundingClientRect()
    const menu = document.querySelector('.viewport .choice-menu').getBoundingClientRect()
    const options = [...document.querySelectorAll('.viewport .option')].map(option => option.getBoundingClientRect())
    return {
      count: options.length,
      inside: options.every(option => option.top >= viewport.top && option.bottom <= buttons.top),
      shown: options.filter(option => option.top >= menu.top - 1 && option.bottom <= menu.bottom + 1).length,
    }
  })()`
  page.check('six options all fit, none cut nor under the menu buttons', await page.evaluate(layout), { count: 6, inside: true, shown: 6 })
  await page.screenshot('six')

  await page.evaluate(`document.querySelector('.viewport .option').click()`)
  await pause(600)
  await page.press(' ')
  await pause(900)
  const twelve = await page.evaluate(layout)
  page.check('twelve options scroll in their place, the first ones shown', [twelve.count, twelve.shown < 12, await page.evaluate(`document.querySelector('.viewport .choice-menu').classList.contains('more-below')`)], [12, true, true])
  await page.screenshot('twelve')

  // Scrolled down, the wheel upwards over the list scrolls it back rather than going back a page.
  await page.evaluate(`(() => { const menu = document.querySelector('.viewport .choice-menu'); menu.scrollTop = menu.scrollHeight; menu.dispatchEvent(new Event('scroll')) })()`)
  await pause(300)
  await page.evaluate(`document.querySelector('.viewport .choice-menu').dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }))`)
  await pause(400)
  page.check('the wheel over a list with more above does not go back', await page.evaluate(`document.querySelectorAll('.viewport .option').length`), 12)

  await page.press('ArrowUp')
  await pause(400)
  page.check('the keyboard reaches the last option, brought into view', await page.evaluate(`(() => {
    const menu = document.querySelector('.viewport .choice-menu').getBoundingClientRect()
    const focused = document.activeElement.getBoundingClientRect()
    return [document.activeElement.textContent.trim(), focused.bottom <= menu.bottom + 1]
  })()`), ['Option number 12', true])
}
