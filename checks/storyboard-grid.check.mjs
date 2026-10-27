// The storyboard grid without a mouse: blocks as single elements, entering them, selecting neighbours with
// Space, moving with Ctrl+Shift+arrows, cut and paste across levels; then dragging, and the block size setting.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `# Grid
First page.
[choice: Answer]
> Yes = A
> No = B
[if: Answer is A]
Yes one.
Yes two.
[else]
No one.
[end]
After the small block.
[if: Answer is B]
Long one.
Long two.
Long three.
Long four.
Long five.
Long six.
[else]
Short else.
[end]
The end.`

/** What an element shows, shortly: a page's text, a choice's decision, a block as [block] or [stack]. */
const DESCRIBE = `element => element.classList.contains('block')
  ? (element.classList.contains('collapsed') ? '[stack]' : '[block]')
  : element.classList.contains('empty-lane') ? '[empty]'
  : (element.querySelector('.text') ?? element.querySelector('.speaker') ?? element).textContent.trim()`

export default async function check(page, { url }) {
  const shown = () => page.evaluate(`[...document.querySelectorAll('.grid .lane')].map(lane =>
    (lane.querySelector('.lane-title')?.textContent.trim() ?? 'chapter') + ': '
    + [...lane.querySelectorAll(':scope > .elements > .element')].map(${DESCRIBE}).join(' / ')).join(' || ')`)
  const focused = () => page.evaluate(`[...document.querySelectorAll('.grid .element.focused')].map(${DESCRIBE}).join()`)
  const selected = () => page.evaluate(`[...document.querySelectorAll('.grid .element.selected')].map(${DESCRIBE}).join(' + ')`)
  const path = () => page.evaluate(`[...document.querySelectorAll('.grid .path-entry')].map(entry => entry.textContent.trim()).join(' › ')`)
  /** A selector for the element showing a text, by its identifier. */
  const elementWith = text => page.evaluate(`'#' + CSS.escape([...document.querySelectorAll('.grid .element')].find(element => (${DESCRIBE})(element) === ${JSON.stringify(text)}).id)`)
  const keys = async (...presses) => {
    for (const press of presses) {
      await (Array.isArray(press) ? page.press(press[0], press[1]) : page.press(press))
    }
  }
  const ctrlShift = { ctrl: true, shift: true }

  await createProjectWithStory(page, url, 'Grid', STORY)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  page.check('each condition is one block', await shown(), 'chapter: First page. / Choice: Answer / [block] / After the small block. / [stack] / The end.')
  page.check('a small block shows its pages', await page.evaluate(`[...document.querySelectorAll('.element.block:not(.collapsed) .mini')].map(mini => mini.textContent.trim()).join(', ')`), '3a Yes one., 4a Yes two., 3b No one.')
  page.check('a block over the limit is one card that says so', await page.evaluate(`document.querySelector('.element.block.collapsed .summary').textContent.trim()`), '2 routes · 7 pages')
  await page.screenshot('chapter-level')

  await page.evaluate(`document.querySelector('.board').focus()`)
  await keys('Home', 'ArrowRight')
  page.check('arrows move the focus without selecting', [await focused(), await selected()], ['Choice: Answer', ''])
  await keys('ArrowRight', ' ')
  page.check('Space selects the block', await selected(), '[block]')
  await keys(['ArrowLeft', ctrlShift])
  page.check('Ctrl+Shift+← moves the block as a whole', await shown(), 'chapter: First page. / [block] / Choice: Answer / After the small block. / [stack] / The end.')
  page.check('it stays selected', await selected(), '[block]')
  await keys(['z', { ctrl: true }])
  page.check('Ctrl+Z puts it back', await shown(), 'chapter: First page. / Choice: Answer / [block] / After the small block. / [stack] / The end.')

  await keys('Escape', 'Home', ' ', 'ArrowRight', ' ')
  page.check('Space next to the selection adds to it', await selected(), 'First page. + Choice: Answer')
  await keys('ArrowRight', 'ArrowRight', ' ')
  page.check('Space further away starts again', await selected(), 'After the small block.')
  await keys('Escape')
  page.check('Escape lets go of the selection', await selected(), '')

  await keys('ArrowLeft', 'Enter')
  page.check('Enter opens the block', await path(), 'Grid › ◆ if Answer is A')
  page.check('its branches show as lanes', await shown(), 'if Answer is A: Yes one. / Yes two. || else: No one.')
  page.check('the focus is on its first page', await focused(), 'Yes one.')
  await keys(' ', ['ArrowLeft', ctrlShift])
  page.check('moving past the start of a branch leaves the block', await shown(), 'chapter: First page. / Choice: Answer / Yes one. / [block] / After the small block. / [stack] / The end.')
  await keys(['z', { ctrl: true }])

  await keys('Home', 'ArrowRight', 'ArrowRight', 'Enter', 'ArrowDown')
  page.check('↓ goes to the next branch', await focused(), 'No one.')
  await keys(' ', ['ArrowUp', ctrlShift])
  page.check('Ctrl+Shift+↑ moves into the branch above', await shown(), 'if Answer is A: No one. / Yes one. / Yes two. || else: [empty]')
  await page.screenshot('inside-block')
  await keys(['x', { ctrl: true }])
  page.check('cut cards are dimmed', await page.evaluate(`[...document.querySelectorAll('.grid .element.cut')].map(${DESCRIBE}).join()`), 'No one.')
  await keys('Escape')
  page.check('Escape leaves the block, keeping what was cut', [await path(), await focused()], ['', '[block]'])
  await keys('End', ['v', { ctrl: true }])
  page.check('Ctrl+V puts it after the focus, at another level', await shown(), 'chapter: First page. / Choice: Answer / [block] / After the small block. / [stack] / The end. / No one.')
  page.check('what was pasted is selected', await selected(), 'No one.')
  await keys('Delete')
  page.check('Delete removes the selection', await shown(), 'chapter: First page. / Choice: Answer / [block] / After the small block. / [stack] / The end.')

  await keys('End', 'ArrowLeft', 'Enter')
  page.check('the block shown as one card opens too', await shown(), 'if Answer is B: Long one. / Long two. / Long three. / Long four. / Long five. / Long six. || else: Short else.')
  await keys('Escape')
  page.check('leaving it focuses it again', await focused(), '[stack]')

  await page.evaluate(`(() => { const input = document.querySelector('.block-limit input'); input.value = '10'; input.dispatchEvent(new Event('input')) })()`)
  await pause(300)
  page.check('a higher limit shows the big block inside its frame', await shown(), 'chapter: First page. / Choice: Answer / [block] / After the small block. / [block] / The end.')
  await page.evaluate(`(() => { const input = document.querySelector('.block-limit input'); input.value = '5'; input.dispatchEvent(new Event('input')) })()`)
  await pause(300)

  await page.drag(await elementWith('The end.'), await elementWith('First page.'), 'before')
  page.check('a card dragged before another goes there', await shown(), 'chapter: The end. / First page. / Choice: Answer / [block] / After the small block. / [stack]')
  await page.drag(await elementWith('[block]'), await elementWith('[stack]'), 'after')
  page.check('a block drags as a whole', await shown(), 'chapter: The end. / First page. / Choice: Answer / After the small block. / [stack] / [block]')
  await page.evaluate(`document.querySelector('.board').focus()`)
  await keys('End', 'Enter')
  await page.drag(await elementWith('Yes two.'), '.grid .path-entry', 'before')
  page.check('dropped on the path, a card leaves the block, landing after it', await shown(), 'chapter: The end. / First page. / Choice: Answer / After the small block. / [stack] / [block] / Yes two.')
  await page.screenshot('after-drags')
}
