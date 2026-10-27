// Endings in the storyboard: blocks and branches say when their routes end, and what no path reaches
// is warned about at import and shown faded, until moved where it can be read.
import { pause } from './harness.mjs'

const STORY = `# Endings
[choice: Door]
> Open it
> Walk away
[if: Door is A]
The room was empty.
[ending: Empty]
Lost after the ending.
[else]
You went home.
[ending: Home]
[end]
Nobody reads this.`

const DESCRIBE = `element => element.classList.contains('block') ? '[block]' : (element.querySelector('.text') ?? element.querySelector('.speaker') ?? element).textContent.trim()`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Endings')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import warns about the page no path reaches', await page.evaluate(`[...document.querySelectorAll('.problems li')].map(item => item.textContent.trim())`), [
    'Line 8 — Never reached: every path before it ends, at an [ending] or in a block whose branches, [else] included, all end.',
    'Line 13 — Never reached: every path before it ends, at an [ending] or in a block whose branches, [else] included, all end.',
  ])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')

  const unreachable = () => page.evaluate(`[...document.querySelectorAll('.grid .element.unreachable')].map(${DESCRIBE}).join()`)
  page.check('the page shows faded', await unreachable(), 'Nobody reads this.')
  page.check('the block says its routes all end', await page.evaluate(`document.querySelector('.element.block .ending-mark')?.textContent.trim()`), '★ every route ends')
  page.check('the block counts the page it hides that no path reaches', await page.evaluate(`document.querySelector('.element.block .unreachable-mark')?.textContent.trim()`), '⚠ 1 never reached')
  page.check('the chapter says how many pages are never reached', (await page.evaluate(`document.querySelector('.storyboard > p.warning')?.textContent`))?.includes('2 pages of this chapter are never reached'), true)
  await page.evaluate(`(() => { const input = document.querySelector('.block-limit input'); input.value = '1'; input.dispatchEvent(new Event('input')) })()`)
  await pause(300)
  page.check('shown as one card, the block still says so', await page.evaluate(`document.querySelector('.element.block.collapsed .unreachable-mark')?.textContent.trim()`), '⚠ 1 never reached')
  await page.screenshot('collapsed')
  await page.evaluate(`(() => { const input = document.querySelector('.block-limit input'); input.value = '5'; input.dispatchEvent(new Event('input')) })()`)
  await pause(300)
  page.check('each route says it ends', await page.evaluate(`[...document.querySelectorAll('.element.block .route-name')].map(name => name.textContent.trim())`), ['if Door is A ★', 'else ★'])
  await page.evaluate(`document.querySelector('.board').focus()`)
  await page.press('End')
  page.check('the panel says why and what to do', (await page.evaluate(`document.querySelector('.inspector .warning')?.textContent`))?.includes('Never reached'), true)
  await page.screenshot('unreachable')

  await page.press(' ')
  await page.press('ArrowLeft', { ctrl: true, shift: true })
  page.check('moved before the block, it is read again', await unreachable(), '')
  await page.press('Home')
  await page.press('ArrowRight')
  await page.press('ArrowRight')
  await page.press('ArrowRight')
  await page.press('Enter')
  page.check('inside, each branch says it ends', await page.evaluate(`[...document.querySelectorAll('.grid .lane-title')].map(title => title.textContent.trim())`), ['if Door is A · ★ ends', 'else · ★ ends'])
  await page.screenshot('inside')
}
