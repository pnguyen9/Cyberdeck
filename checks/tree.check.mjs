// The tree view of the storyboard: branches side by side, editing by clicking, no moving, and back to the grid.
import { createProjectWithSample, pause } from './harness.mjs'

export default async function check(page, { url }) {
  const treeOrder = () => page.evaluate(`[...document.querySelectorAll('.board.tree .item.card .line')].map(line => line.textContent.trim().slice(0, 20))`)

  await createProjectWithSample(page, url, 'Tree')
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await page.clickButton('Tree', '.view-switch .button')
  await page.waitFor('.board.tree')
  page.check('a condition shows its branches side by side', await page.evaluate(`[...document.querySelectorAll('.board.tree .branches > .branch > .test')].map(test => test.textContent.trim()).join(' | ')`), '◆ if Answer is Truth | else')
  page.check('each with its own pages', await page.evaluate(`[...document.querySelectorAll('.board.tree .branch')].map(branch => branch.querySelectorAll('.item.card').length).join(',')`), '2,2')
  page.check('joining again at its end', await page.evaluate(`document.querySelector('.board.tree .join')?.textContent.trim()`), '◆ end')
  await page.screenshot('tree')

  await page.evaluate(`[...document.querySelectorAll('.board.tree .item.card')].find(item => item.textContent.includes("Don't do that")).click()`)
  await pause(200)
  page.check('clicking a page shows it in the panel', await page.evaluate(`document.querySelector('.inspector .full-text')?.textContent`), "Don't do that.")
  await page.press('Enter')
  await pause(300)
  page.check('Enter edits it', (await page.evaluate(`document.querySelector('.tag-editor .field')?.value`))?.endsWith("— Marie: Don't do that."), true)
  await page.press('Escape')
  await pause(200)

  const before = await treeOrder()
  await page.evaluate(`[...document.querySelectorAll('.board.tree .item.card')][1].click()`)
  await pause(200)
  await page.press(' ')
  await page.press('ArrowRight', { ctrl: true, shift: true })
  await pause(300)
  page.check('moving is off in the tree', await treeOrder(), before)
  page.check('and nothing can be dragged', await page.evaluate(`document.querySelectorAll('.board.tree [draggable="true"]').length`), 0)

  await page.clickButton('Grid', '.view-switch .button')
  await pause(300)
  page.check('the grid comes back', await page.evaluate(`document.querySelectorAll('.grid .element.card').length > 10`), true)
}
