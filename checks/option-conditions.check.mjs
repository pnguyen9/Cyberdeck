// Options with a condition: shown as such on the choice card, and offered by the preview only while it
// holds, so that places visited leave a hub.
import { advanceUntil, pause, shownStep } from './harness.mjs'

const STORY = `# Hub
[decision multi: Visited = Library | Park]
[loop]
[choice: Where]
> The library = Library [if: Visited is not Library]
> The park = Park [if: Visited is not Park]
> Go home = Home
[if: Where is Library]
[set: Visited = Library]
Dust and silence.
[else if: Where is Park]
[set: Visited = Park]
Wind in the trees.
[else]
[break]
[end]
[end]
Home at last.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Options')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts it', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')

  await page.evaluate(`document.querySelector('.board').focus()`)
  await page.press('Home')
  await page.press('Enter')
  const optionTexts = () => page.evaluate(`[...document.querySelectorAll('.grid .element.card .option')].map(option => option.textContent.replace(/\\s+/g, ' ').trim())`)
  page.check('the choice card says which options have a condition', await optionTexts(), [
    '› The library · if Visited is not Library',
    '› The park · if Visited is not Park',
    '› Go home',
  ])
  await page.press('Home')
  page.check('so does the panel', (await page.evaluate(`document.querySelector('.inspector ul')?.textContent.replace(/\\s+/g, ' ')`))?.includes('The library → Library, offered only if Visited is not Library'), true)
  await page.screenshot('choice')

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  const offered = async () => {
    await advanceUntil(page, step => step === 'CHOICE')
    await pause(400)
    return page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
  }
  const choose = async text => {
    await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes(${JSON.stringify(text)})).click()`)
    await pause(300)
  }
  page.check('every place is offered at first', await offered(), ['The library', 'The park', 'Go home'])
  await choose('The library')
  page.check('the library is no longer offered once visited', await offered(), ['The park', 'Go home'])
  await choose('The park')
  page.check('nor the park', await offered(), ['Go home'])
  await choose('Go home')
  page.check('going home leaves the hub', await shownStep(page), 'Home at last.')
}
