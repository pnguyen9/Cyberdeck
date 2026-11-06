// The tree view with blocks inside blocks, several branches each: columns side by side never overlap,
// however wide what a branch holds; the board scrolls sideways instead.
import { createProjectWithStory, openChapterBoard, pause } from './harness.mjs'

const LONG = 'is a long line of dialogue, long enough to fill a card to its edge and more.'
// A column holding a block of short pages, beside columns of long lines: it shrinks the most.
const STORY = `[decision: Score = A | B | C | D | E]
Hello.
[if: Score is A]
[illustration: none]
[if: Score is B]
Hi.
[else if: Score is C]
Yes.
[else]
No.
[end]
[else if: Score is B]
— Sota: One ${LONG}
[else if: Score is C]
— Sota: Two ${LONG}
[else if: Score is D]
— Sota: Three ${LONG}
[else]
— Sota: Four ${LONG}
[end]
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Nested', STORY)
  await openChapterBoard(page)
  await page.waitFor('.grid')
  await page.clickButton('Tree', '.view-switch .button')
  await page.waitFor('.board.tree')
  await pause(300)
  page.check('columns side by side never overlap', await page.evaluate(`(() => {
    const overlaps = []
    for (const branches of document.querySelectorAll('.board.tree .branches')) {
      const columns = [...branches.children].map(column => column.getBoundingClientRect())
      columns.slice(1).forEach((column, index) => {
        if (column.left < columns[index].right - 1) overlaps.push(index)
      })
      // Nothing a column holds reaches into the next one.
      ;[...branches.children].forEach((column, index) => {
        const next = branches.children[index + 1]
        if (next === undefined) return
        const limit = next.getBoundingClientRect().left
        for (const item of column.querySelectorAll('.item, .test, .join')) {
          if (item.getBoundingClientRect().right > limit + 1) overlaps.push(item.textContent.trim().slice(0, 30))
        }
      })
    }
    return overlaps
  })()`), [])
  page.check('the board scrolls sideways instead', await page.evaluate(`(() => { const board = document.querySelector('.board.tree'); return board.scrollWidth > board.clientWidth })()`), true)
  await page.screenshot('tree-nested')
}
