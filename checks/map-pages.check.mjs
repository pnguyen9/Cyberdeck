// Turning the pages of a wide map, on Sakura Week's every path: Ctrl with an arrow, or a strip at the
// edge, brings the last column wholly in view to the left (the last row to the top), and back; the
// strips show only where there is more map; Home goes to the start, End to the last column.
import { openEveryPathMap, pause } from './harness.mjs'

/** Long enough for a smooth scroll to land. */
const TURN_PAUSE = 1000

export default async function check(page, { url }) {
  await page.setViewport(1280, 600)
  await openEveryPathMap(page, url)

  /**
   * What the view shows: where it is scrolled, the columns and rows wholly in view (by the left and
   * top of their cards, in the map), and the strips at its edges.
   */
  const view = () => page.evaluate(`(() => {
    const scroller = document.querySelector('.map-scroll')
    const nodes = [...scroller.querySelectorAll('.node')]
    const tallest = Math.max(...nodes.map(node => node.offsetHeight))
    const whole = (starts, size, scrolled, length) => [...new Set(starts)].sort((first, second) => first - second).filter(start => start >= scrolled - 1 && start + size <= scrolled + length + 1)
    const columns = whole(nodes.map(node => node.offsetLeft), nodes[0].offsetWidth, scroller.scrollLeft, scroller.clientWidth)
    const rows = whole(nodes.map(node => node.offsetTop), tallest, scroller.scrollTop, scroller.clientHeight)
    return {
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      height: scroller.clientHeight,
      firstColumn: columns[0],
      lastColumn: columns.at(-1),
      firstRow: rows[0],
      lastRow: rows.at(-1),
      everyRow: [...new Set(nodes.map(node => node.offsetTop))].sort((first, second) => first - second),
      strips: [...document.querySelectorAll('.page-strip')].map(strip => strip.classList[1]).sort(),
      isFocused: document.activeElement?.classList.contains('node') && scroller.contains(document.activeElement),
      focusedCard: document.activeElement?.classList.contains('node') ? { left: document.activeElement.offsetLeft, top: document.activeElement.offsetTop } : null,
      isWide: scroller.scrollWidth > scroller.clientWidth,
      isTall: scroller.scrollHeight > scroller.clientHeight,
    }
  })()`)

  const start = await view()
  page.check('the map is wide and tall: the check means something', [start.isWide, start.isTall], [true, true])
  page.check('a card has the focus once the map is open, for its keys', start.isFocused, true)
  page.check('the keys are told in the header', (await page.evaluate(`document.querySelector('.keys-hint').textContent.replace(/\\s+/g, ' ').trim()`)), '←→↑↓ move from card to card · Ctrl + ←→↑↓ turn a page · HomeEnd go to the start or the last column')
  page.check('at the start, strips only to the right and below', start.strips, ['down', 'right'])
  page.check('the strips have names', await page.evaluate(`[...document.querySelectorAll('.page-strip')].map(strip => strip.getAttribute('aria-label')).sort()`), ['Page below', 'Page to the right'])
  await page.screenshot('start')

  await page.press('ArrowRight', { ctrl: true })
  await pause(TURN_PAUSE)
  const turned = await view()
  page.check('Ctrl+→: the last column wholly in view comes first, at its card, the padding before it', [turned.firstColumn, turned.firstColumn - turned.left], [start.lastColumn, 24])
  page.check('a strip to the left now', turned.strips, ['down', 'left', 'right'])
  page.check('the focus follows to the first card of the column brought first', turned.focusedCard?.left, turned.firstColumn)
  await page.screenshot('turned')

  await page.press('ArrowLeft', { ctrl: true })
  await pause(TURN_PAUSE)
  const back = await view()
  page.check('Ctrl+←: the first column wholly in view comes last, back to the start', [back.lastColumn, back.left], [turned.firstColumn, 0])

  await page.clickAt('.page-strip.right')
  await pause(TURN_PAUSE)
  const clicked = await view()
  page.check('the strip to the right turns the page as Ctrl+→ does', clicked.left, turned.left)
  page.check('and moves the focus to a card of the new page', [clicked.isFocused, clicked.focusedCard?.left], [true, turned.firstColumn])
  await page.clickAt('.page-strip.left')
  await pause(TURN_PAUSE)
  const backByStrip = await view()
  page.check('the strip to the left turns it back, and goes at the start', [backByStrip.left, backByStrip.strips], [0, ['down', 'right']])

  await page.press('ArrowDown', { ctrl: true })
  await pause(TURN_PAUSE)
  const down = await view()
  // Sakura Week's rows stand further apart than this view is tall: the page moves on as Page Down does, a strip of the view before kept on screen.
  page.check('Ctrl+↓: rows further apart than the view, the page keeps 64 pixels of the one before', [down.height < start.everyRow[1] - start.everyRow[0], start.top + start.height - down.top], [true, 64])
  page.check('a strip above now', down.strips.includes('up'), true)
  await page.screenshot('down')
  await page.press('ArrowUp', { ctrl: true })
  await pause(TURN_PAUSE)
  page.check('Ctrl+↑: back to the top', (await view()).top, 0)

  await page.press('End')
  await pause(TURN_PAUSE * 2)
  const end = await view()
  page.check('End: the last column, at its first card: no strip to the right', [end.strips.includes('right'), end.strips.includes('left'), end.firstRow - end.top], [false, true, 24])
  await page.screenshot('end')
  await page.press('Home')
  await pause(TURN_PAUSE * 2)
  const home = await view()
  page.check('Home: the start again', [home.left, home.top, home.strips], [0, 0, ['down', 'right']])

  // Page by page to the end: each page moves on, until the strip to the right goes.
  let pages = 0
  let previous = -1
  while ((await view()).strips.includes('right') && pages < 50) {
    previous = (await view()).left
    await page.clickAt('.page-strip.right')
    await pause(TURN_PAUSE)
    pages++
    if ((await view()).left <= previous) {
      break
    }
  }
  const last = await view()
  page.check('every page moves on, to the end of the map', [last.strips.includes('right'), last.left > previous], [false, true])
}
