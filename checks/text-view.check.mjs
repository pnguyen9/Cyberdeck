// The storyboard's Text view: the chapter written out as it imports, edited like a document and saved
// in place; leaving it with changes asks first; a block opened in the grid shows as its own text.
import { createProjectWithStory, openChapterBoard, pause } from './harness.mjs'

const STORY = `# Morning
The sun rises.
[decision: Way = Left | Right]
[choice: Way]
> Go left = Left
> Go right = Right
[if: Way is Left]
The left path.
[end]
The day ends.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Paths', STORY)
  await openChapterBoard(page)
  await page.waitFor('.board')
  await page.clickButton('Text', '.view-switch .button')
  await page.waitFor('.text-view textarea')
  await pause(300)
  const written = () => page.evaluate(`document.querySelector('.text-view textarea').value`)
  page.check('the chapter shows as the text it imports from', (await written()).split('\n').slice(0, 2), ['The sun rises.', '[decision: Way = Left | Right]'])

  await page.setValue('.text-view textarea', (await written()).replace('The day ends.', 'The night falls.'))
  await pause(400)
  await page.clickButton('Grid', '.view-switch .button')
  await pause(300)
  page.check('leaving with changes asks first, the text still shown', [await page.evaluate(`!!document.querySelector('.text-view .pending')`), await page.evaluate(`!!document.querySelector('.text-view textarea')`)], [true, true])
  await page.screenshot('asks')
  await page.evaluate(`[...document.querySelectorAll('.text-view .pending .button')].at(-1).click()`)
  await pause(200)
  await page.evaluate(`document.querySelector('.text-view .edit-actions .button.primary').click()`)
  await pause(800)
  page.check('saving writes the chapter anew', await page.statusText(), 'Saved. Ctrl+Z puts the old text back.')
  page.check('and the text stays open, saved', [(await written()).includes('The night falls.'), await page.evaluate(`document.querySelector('.text-view .changed') === null`)], [true, true])

  await page.clickButton('Grid', '.view-switch .button')
  await pause(500)
  page.check('the board shows the new text', await page.evaluate(`document.querySelector('.board')?.textContent.includes('The night falls.')`), true)
  await page.evaluate(`document.querySelector('.element.block').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
  await pause(400)
  await page.clickButton('Text', '.view-switch .button')
  await page.waitFor('.text-view textarea')
  await pause(300)
  page.check('a block opened shows as its own text', (await written()).split('\n'), ['[if: Way is Left]', 'The left path.', '[end]'])
}
