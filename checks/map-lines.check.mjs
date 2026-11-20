// The lines of the map, on Sakura Week's every path: where a point branches, each line says the option
// it follows; and a line with a point in its way goes under it rather than through it.
import { openEveryPathMap, pause } from './harness.mjs'

export default async function check(page, { url }) {
  await openEveryPathMap(page, url)
  // The lines leaving Monday's job, each the option it follows, the long ones by their value.
  const labelsAfter = decision => page.evaluate(`(() => {
    const point = [...document.querySelectorAll('.map-screen .node')].find(node => node.querySelector('h2')?.textContent === ${JSON.stringify(decision)})
    const right = point.offsetLeft + point.offsetWidth
    return [...document.querySelectorAll('.map-screen .line-label')].filter(label => Math.abs(label.getBBox().x - right - 6) < 1 && label.getBBox().y > point.offsetTop && label.getBBox().y < point.offsetTop + point.offsetHeight).map(label => label.textContent)
  })()`)
  page.check('each line leaving the job says its option, its value when the text is long', await labelsAfter('Job'), ['Decorations', 'Cash', 'Helper'])
  page.check('and those leaving the quiz', await labelsAfter('Quiz'), ['Careful', 'Guess boldly', 'Cat'])
  // No line crosses a point: along each, no spot falls inside a card.
  const crossings = await page.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.map-screen .node')].map(node => ({ name: node.querySelector('h2')?.textContent ?? node.textContent.trim(), left: node.offsetLeft + 2, right: node.offsetLeft + node.offsetWidth - 2, top: node.offsetTop + 2, bottom: node.offsetTop + node.offsetHeight - 2 }))
    const found = []
    for (const path of document.querySelectorAll('.map-screen .curves path')) {
      for (let at = 0; at < path.getTotalLength(); at += 8) {
        const spot = path.getPointAtLength(at)
        const card = cards.find(card => spot.x > card.left && spot.x < card.right && spot.y > card.top && spot.y < card.bottom)
        if (card !== undefined) {
          found.push(card.name)
          break
        }
      }
    }
    return found
  })()`)
  page.check('no line runs over a point', crossings, [])
  page.check('the lines heading home go under the points in their way', await page.evaluate(`document.querySelectorAll('.map-screen .curves path[data-under]').length > 0`), true)
  const size = await page.evaluate(`(() => { const map = document.querySelector('.map-screen .map'); return { width: map.offsetWidth, height: map.offsetHeight + 120 } })()`)
  await page.setViewport(Math.min(size.width, 6000), Math.min(size.height, 4000))
  await pause(500)
  await page.screenshot('every-path')
}
