// The player's panels take the keyboard focus: the log opens on its list, where a habitual Space or
// Enter goes back nowhere, and the arrow keys move from line to line without touching the story
// behind; Save opens on its first slot; the state panel, kept under the others, never takes the focus
// from them; closing a panel gives the focus back to the button that opened it.
import { advanceUntil, createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `The first line.
The second line.
The third line.
The fourth line.
The fifth line.`

const focusedLine = page => page.evaluate(`[...document.querySelectorAll('.viewport .line')].indexOf(document.activeElement)`)
const focusedButton = page => page.evaluate(`document.activeElement?.matches('.quick-button') ? document.activeElement.textContent.trim() : document.activeElement?.className ?? null`)
/** Gives the focus to a button of the quick menu and presses it with Enter, as a player going through the menu by keyboard does. */
async function pressQuickButton(page, label) {
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === ${JSON.stringify(label)}).focus()`)
  await page.press('Enter', { text: '\r' })
  await pause(400)
}

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Focus', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  await advanceUntil(page, step => step === 'The fourth line.')
  await pause(400)

  // The focus on the Log button, as a player going through the menu by keyboard leaves it, then the log's key.
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Log').focus()`)
  await page.press('l')
  await page.waitFor('.viewport .lines')
  await pause(300)
  const lineCount = await page.evaluate(`document.querySelectorAll('.viewport .line').length`)
  page.check('the log opens with the three lines before the one shown', lineCount, 3)
  page.check('the log opens on its list, not on a line', [await page.evaluate(`document.activeElement === document.querySelector('.viewport .lines')`), await focusedLine(page)], [true, -1])
  page.check('one line only is a Tab stop, the most recent', await page.evaluate(`[...document.querySelectorAll('.viewport .line')].map(line => line.tabIndex)`), [-1, -1, 0])
  await page.press(' ')
  await page.press('Enter', { text: '\r' })
  await pause(300)
  page.check('Space and Enter on the list go back nowhere: the log stays open over the same page', [await page.evaluate(`document.querySelector('.viewport .lines') !== null`), await focusedLine(page)], [true, -1])

  await page.press('ArrowUp')
  page.check('the first up enters the lines on the most recent one', await focusedLine(page), lineCount - 1)
  await page.press('Tab', { shift: true })
  page.check('Shift+Tab from a line reaches Close at once', await focusedButton(page), 'close-button')
  await page.press('Tab')
  page.check('and Tab comes back to the line', await focusedLine(page), lineCount - 1)
  await page.press('ArrowUp')
  page.check('up moves to the line before', await focusedLine(page), lineCount - 2)
  page.check('the line focused is the Tab stop now', await page.evaluate(`[...document.querySelectorAll('.viewport .line')].map(line => line.tabIndex)`), [-1, 0, -1])
  await page.press('ArrowUp')
  await page.press('ArrowDown')
  page.check('down moves to the line after', await focusedLine(page), lineCount - 2)
  await page.press('Home')
  page.check('Home goes to the first line', await focusedLine(page), 0)
  await page.press('ArrowUp')
  page.check('up stops at the first line', await focusedLine(page), 0)
  await page.press('End')
  page.check('End goes to the most recent line', await focusedLine(page), lineCount - 1)
  await page.screenshot('log-focused')

  await page.press('Escape')
  await pause(300)
  page.check('Escape closes the log', await page.evaluate(`document.querySelector('.viewport .lines') === null`), true)
  page.check('the keys pressed in the log left the story where it was', await shownStep(page), 'The fourth line.')
  page.check('the focus is back on the Log button', await focusedButton(page), 'Log')

  // The settings: the category shown takes the focus, and gives it back on closing.
  await page.press('o')
  await page.waitFor('.viewport .category')
  await pause(300)
  page.check('the settings open with the focus on their category', await page.evaluate(`document.activeElement === document.querySelector('.viewport .category')`), true)
  await page.press('Escape')
  await pause(300)
  page.check('closing the settings gives the focus back', await focusedButton(page), 'Log')

  // Save opens on its first slot, and gives the focus back to its button.
  await pressQuickButton(page, 'Save')
  await page.waitFor('.viewport .slot')
  await pause(300)
  page.check('Save opens with the focus on its first slot', await page.evaluate(`document.activeElement === document.querySelector('.viewport .slot:enabled')`), true)
  await page.press('ArrowDown')
  await page.press('Escape')
  await pause(300)
  page.check('closing Save gives the focus back to its button', await focusedButton(page), 'Save')
  page.check('the keys pressed in Save left the story where it was', await shownStep(page), 'The fourth line.')

  // The state panel, for the author: it takes the focus as its button opens it, and Escape closes it.
  await pressQuickButton(page, 'State')
  page.check('the state panel opens with the focus', await page.evaluate(`document.activeElement === document.querySelector('.viewport .state-panel')`), true)
  await page.press('Escape')
  await pause(300)
  page.check('Escape closes the state panel while it has the focus', [await page.evaluate(`document.querySelector('.viewport .state-panel') === null`), await shownStep(page)], [true, 'The fourth line.'])
  // Open beside the story, it stays under another panel and leaves the focus to that panel's button as it closes.
  await pressQuickButton(page, 'State')
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Log').focus()`)
  await page.press('l')
  await page.waitFor('.viewport .lines')
  await pause(300)
  await page.press('Escape')
  await pause(300)
  page.check('closing the log over the state panel gives the focus back to the Log button', [await focusedButton(page), await page.evaluate(`document.querySelector('.viewport .state-panel') !== null`)], ['Log', true])
  await page.evaluate(`document.querySelector('.viewport .state-panel .close').click()`)
  await pause(300)

  // Opened with the mouse, the log gives no focus back, and Space then reads on.
  await page.evaluate(`document.activeElement.blur()`)
  await page.clickButton('Log', '.viewport .quick-button')
  await page.waitFor('.viewport .lines')
  await pause(300)
  await page.press('Escape')
  await pause(300)
  page.check('a log opened with the mouse leaves no button focused', await focusedButton(page) === 'Log', false)
  await page.press('Space')
  await pause(600)
  page.check('Space then reads on', await shownStep(page) === 'The fourth line.', false)
}
