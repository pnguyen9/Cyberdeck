// Loops: a hub the player leaves with a break, shown and entered as a block in the grid and played by the
// preview; a loop nothing leaves is warned about at import and marked in the grid.
import { advanceUntil, createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `# Hub
[loop]
[choice: Where]
> The library = Library
> The park = Park
> Go home = Home
[if: Where is Library]
Dust and silence.
[else if: Where is Park]
Wind in the trees.
[else]
[break]
[end]
[end]
Home at last.
[loop]
Round and round.
[end]`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Loops')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import warns about the loop nothing leaves', await page.evaluate(`[...document.querySelectorAll('.problems li')].map(item => item.textContent.trim())`), [
    'Line 16 — This loop never stops: nothing inside leaves it. Add a [break], in a branch the player can reach, or an [ending].',
  ])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')

  // A block's title and its marks are spaced by the style, not by the text: their parts are read one by one.
  const titles = () => page.evaluate(`[...document.querySelectorAll('.grid .lane > .elements > .element')].map(element => {
    const title = element.querySelector('.block-title')
    return title === null
      ? (element.querySelector('.text') ?? element).textContent.trim()
      : [...title.childNodes].filter(part => part.nodeType !== Node.COMMENT_NODE).map(part => part.textContent.replace(/\\s+/g, ' ').trim()).filter(part => part !== '').join(' ')
  })`)
  page.check('each loop is one block, the one nothing leaves marked', await titles(), ['↻ loop 1–2', 'Home at last.', '↻ loop 4 ⚠ never stops'])
  await page.screenshot('loops')

  await page.evaluate(`document.querySelector('.board').focus()`)
  await page.press('Home')
  await page.press('Enter')
  page.check('Enter opens the loop', await page.evaluate(`[...document.querySelectorAll('.grid .path-entry')].map(entry => entry.textContent.trim()).join(' › ')`), 'Hub › ↻ loop')
  page.check('its body is one lane', await page.evaluate(`[...document.querySelectorAll('.grid .lane-title')].map(title => title.textContent.trim())`), ['repeats until a break'])
  await page.press('Escape')
  await page.press('End')
  page.check('the panel says why the last loop is a problem', (await page.evaluate(`document.querySelector('.inspector .warning')?.textContent`))?.includes('the player would be stuck'), true)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  const choose = async text => {
    await advanceUntil(page, step => step === 'CHOICE')
    await pause(400)
    await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes(${JSON.stringify(text)})).click()`)
    await pause(300)
  }
  const seen = []
  for (const place of ['The library', 'The park', 'Go home']) {
    await choose(place)
    seen.push(await shownStep(page))
  }
  page.check('the preview comes back to the choice until home is chosen', seen, ['Dust and silence.', 'Wind in the trees.', 'Home at last.'])
  await advanceUntil(page, step => step === 'Round and round.')
  await page.press(' ')
  await page.press(' ')
  page.check('the loop nothing leaves plays again', await shownStep(page), 'Round and round.')
}
