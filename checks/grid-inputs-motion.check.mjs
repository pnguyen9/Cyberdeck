// A grid's inputs and less motion, in Cyberdeck's preview: on a grid that does not mark, a right click
// on a tile hides the text as anywhere else; on one that marks, F and a right click mark a tile, and a
// key given to *Mark a tile* marks too while F stays full screen's elsewhere. With *Less motion*, the
// stage does not shake and a flash is soft.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `[list: Shown = a | b | c | d]
Pick one.
[choice: Cell grid 2 × 2 from Shown]
> Picked {Cell}
Now mark some.
[loop]
[set: Spot = 0]
[choice: Spot grid 2 × 2 from Shown, marking Flag]
> Flag {Flag}
[if: Spot >= 1]
[break]
[end]
[end]
[shake: strong 0.4s]
[flash: white 0.2s]
Shaken.`

const caption = page => page.evaluate(`document.querySelector('.viewport .textbox .text')?.textContent.trim() ?? null`)
const tile = number => `document.querySelectorAll('.viewport .grid-menu .tile')[${number - 1}]`
const rightClick = number => `${tile(number)}.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))`
const hasGrid = page => page.evaluate(`!!document.querySelector('.viewport .grid-menu')`)

async function openCategory(page, name) {
  await page.press('o')
  await page.waitFor('.overlay')
  await page.evaluate(`[...document.querySelectorAll('.overlay .category-button')].find(button => button.textContent.trim() === ${JSON.stringify(name)}).click()`)
  await pause(150)
}

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Grid inputs', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  for (let press = 0; press < 4 && !(await hasGrid(page)); press++) {
    await page.press(' ')
    await pause(500)
  }
  page.check('a grid that does not mark', await hasGrid(page), true)
  await page.evaluate(rightClick(1))
  await pause(400)
  page.check('a right click on its tile hides the text, as anywhere else', await hasGrid(page), false)
  await page.press(' ')
  await pause(400)
  page.check('and the text comes back', await hasGrid(page), true)

  await page.evaluate(`${tile(1)}.click()`)
  for (let press = 0; press < 4 && !(await caption(page))?.startsWith('Flag'); press++) {
    await pause(500)
    await page.press(' ')
  }
  await pause(500)
  page.check('a grid that marks', await caption(page), 'Flag 0')
  await page.evaluate(`${tile(3)}.focus()`)
  await page.press('f')
  await pause(400)
  page.check('F on a tile marks it', [await caption(page), await page.evaluate('document.fullscreenElement === null')], ['Flag 3', true])

  await openCategory(page, 'Controls')
  await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Mark a tile')).querySelector('.add').click()`)
  await pause(100)
  await page.press('g')
  await pause(100)
  page.check('a key given to Mark a tile', [
    await page.evaluate(`document.querySelector('.overlay .notice').textContent`),
    await page.evaluate(`[...document.querySelectorAll('.overlay .key-row')].find(row => row.textContent.includes('Full screen')).querySelector('.inputs').textContent.includes('F')`),
  ], ['G now does “Mark a tile of a game board”.', true])
  await page.press('Escape')
  await pause(300)
  await page.evaluate(`${tile(2)}.focus()`)
  await page.press('g')
  await pause(400)
  page.check('marks a tile too', await caption(page), 'Flag 2')
  await page.evaluate(rightClick(4))
  await pause(400)
  page.check('a right click on a tile marks it, the text staying', [await caption(page), await hasGrid(page)], ['Flag 4', true])

  await openCategory(page, 'Accessibility')
  await page.evaluate(`[...document.querySelectorAll('.overlay .choice-button')].find(button => button.textContent.trim() === 'Less motion').click()`)
  await pause(100)
  await page.press('Escape')
  await pause(300)
  page.check('less motion, chosen in the settings', await page.evaluate(`document.querySelector('.viewport .screen').classList.contains('less-motion')`), true)
  await page.evaluate(`${tile(1)}.click()`)
  await pause(60)
  page.check('the stage does not shake; the flash is soft', await page.evaluate(`[
    document.querySelector('.viewport .scene').getAnimations().length,
    document.querySelector('.viewport .flash').getAnimations().map(animation => Number(animation.effect.getKeyframes()[0].opacity)),
  ]`), [0, [0.35]])
}
