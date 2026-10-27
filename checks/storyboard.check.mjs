// The storyboard of the sample story: numbering, markers, focus and selection by mouse and keyboard,
// reordering by keyboard and by dragging, removal, undo, and the order kept after a reload.
import { createProjectWithSample, pause } from './harness.mjs'

export default async function check(page, { url }) {
  const cardSelector = '.grid .lane > .elements > .element.card'
  const cards = () => page.evaluate(`[...document.querySelectorAll(${JSON.stringify(cardSelector)})].map(card => card.querySelector('.number').textContent + ' ' + (card.querySelector('.text')?.textContent ?? 'choice').slice(0, 12))`)
  const withoutNumbers = list => list.map(card => card.slice(card.indexOf(' ') + 1))
  const focusedNumber = () => page.evaluate(`document.querySelector('.grid .element.focused .number')?.textContent ?? document.querySelector('.grid .element.focused')?.textContent.trim()`)
  const selectedCount = () => page.evaluate(`document.querySelectorAll('.grid .element.selected').length`)
  const ctrlShift = { ctrl: true, shift: true }

  await createProjectWithSample(page, url, 'Board')
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  const initial = await cards()
  page.check('pages are numbered from 1', initial[0]?.startsWith('1 '), true)
  const branchPages = await page.evaluate(`[...document.querySelectorAll('.grid .element.block .mini.card')].map(mini => mini.textContent.trim())`)
  page.check('pages in branches are lettered a and b', branchPages.some(text => /^\d+a /.test(text)) && branchPages.some(text => /^\d+b /.test(text)), true)
  page.check('a condition shows its test', await page.evaluate(`document.querySelector('.grid .element.block .block-title')?.childNodes[0].textContent.trim()`), '◆ if Answer is Truth')
  page.check('cards count the staging before them', await page.evaluate(`[...document.querySelectorAll('.grid .element.card .staging')].map(staging => staging.textContent.trim()).slice(0, 2)`), ['◧ 2', '◧ 1'])
  await page.screenshot('storyboard')

  await page.evaluate(`document.querySelector(${JSON.stringify(cardSelector)}).click()`)
  await pause(200)
  page.check('clicking a card focuses it', await focusedNumber(), '1')
  await page.press('ArrowRight')
  page.check('the right arrow moves to the next card', await focusedNumber(), '2')
  page.check('the inspector shows the whole page', (await page.evaluate(`document.querySelector('.inspector .full-text')?.textContent`))?.startsWith('Somewhere in the building'), true)
  await page.press(' ')
  await page.press('ArrowRight', { shift: true })
  page.check('Shift extends the selection', await selectedCount(), 2)

  const [first, second, third, fourth] = withoutNumbers(initial)
  await page.press('ArrowRight', ctrlShift)
  const nudged = withoutNumbers(await cards())
  page.check('Ctrl+Shift+→ moves the selection past the next card', nudged.slice(0, 4), [first, fourth, second, third])
  page.check('the selection follows the cards moved', await selectedCount(), 2)
  await page.press('z', { ctrl: true })
  page.check('Ctrl+Z puts them back', await cards(), initial)

  await page.evaluate(`(() => {
    const all = [...document.querySelectorAll(${JSON.stringify(cardSelector)})]
    const transfer = new DataTransfer()
    all[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }))
    const rect = all[3].getBoundingClientRect()
    all[3].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.right - 5, clientY: rect.top + 10 }))
  })()`)
  await pause(200)
  page.check('dragging shows where the cards will land', await page.evaluate(`document.querySelectorAll('.grid .element.drop-after').length`), 1)
  await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(cardSelector)})][3].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }))`)
  await pause(600)
  const dragged = await cards()
  page.check('dropping puts the card after the target', withoutNumbers(dragged).slice(0, 4), [second, third, fourth, first])
  page.check('numbers follow the new order', dragged[3]?.startsWith('4 '), true)

  await page.evaluate(`document.querySelector('.board').focus()`)
  await page.press('Delete')
  page.check('Delete removes the selection', (await cards()).length, initial.length - 1)
  page.check('and says how to undo', (await page.statusText())?.includes('Ctrl+Z'), true)
  await page.press('z', { ctrl: true })
  page.check('Ctrl+Z brings it back', (await cards()).length, initial.length)

  await page.evaluate(`document.querySelector(${JSON.stringify(cardSelector)}).click()`)
  await pause(200)
  const top = await page.evaluate(`document.querySelector('.grid .element.focused').getBoundingClientRect().top`)
  await page.press('ArrowDown')
  page.check('the down arrow goes to the row below', await page.evaluate(`document.querySelector('.grid .element.focused').getBoundingClientRect().top > ${top}`), true)

  await page.reload()
  await page.waitFor('.open-project')
  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(800)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  page.check('the new order is kept after a reload', await cards(), dragged)

  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: true })
  await pause(400)
  page.check('no horizontal scroll at phone width', await page.evaluate(`document.documentElement.scrollWidth <= 375`), true)
}
