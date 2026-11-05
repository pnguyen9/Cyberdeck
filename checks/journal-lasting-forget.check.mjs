// What 2.0 adds to playing a story: a lasting counter carried into the next playthrough, a memory
// forgotten, the journal showing what the author chose, a timed choice whose waiting answers "yes",
// offered as the others, the time running out on it; and a text exported with its paragraphs as written.
import { advanceUntil, createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter lasting: Coins = 0]
[decision multi: Bag = Key | Lamp]
[shown: Bag, Coins]
[remember: Met the guard]
You have {Coins} coins in your pocket, and the night is long. The guard at the gate watches every move you make, as he has every night since the fair came to town. Nobody else is out, not even the cats that usually sleep under the carts. The wind carries the smell of rain from the hills, and somewhere a door bangs open and shut, open and shut, as if someone had forgotten to close it.
[add: Coins 5]
[set: Bag = Key]
[forget: Met the guard]
[if: remembered Met the guard]
The guard nods.
[else]
The guard does not know you.
[end]
[choice: Answer 30s]
> Yes. = Accept [timeout]
> No. = Refuse
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Coins', STORY)
  page.check('the story imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('a lasting counter starts at what it declares, the first time', (await shownStep(page)).startsWith('You have 0 coins'), true)
  page.check('the long paragraph is cut into pages', (await shownStep(page)).includes('open and shut'), false)
  page.check('the journal is offered, the story showing players something', await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].some(button => button.textContent.trim() === 'Journal')`), true)

  await advanceUntil(page, step => step.startsWith('The guard does') || step.startsWith('The guard nods'))
  await pause(400)
  page.check('a memory forgotten no longer holds', await shownStep(page), 'The guard does not know you.')

  await page.press('j')
  await pause(300)
  page.check('the journal shows what the author chose: a bag by its items, a counter its number', await page.evaluate(`[...document.querySelectorAll('.viewport .entry')].map(entry => entry.innerText.replace(/\\s+/g, ' ').trim())`), ['Bag Key', 'Coins 5'])
  await page.screenshot('journal')
  await page.press('Escape')
  await pause(300)

  await page.press(' ')
  await pause(800)
  page.check('a timed choice offers the option waiting takes as the others, marked by a clock', await page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`), ['⏱ Yes.', 'No.'])
  page.check('the time runs out on the option it will take', await page.evaluate(`document.querySelector('.viewport .option.waited')?.textContent.trim()`), '⏱ Yes.')
  await page.screenshot('waiting')

  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('a new playthrough starts with what the last one left', (await shownStep(page)).startsWith('You have 5 coins'), true)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  // Exported as written, the paragraph the import cut into three pages is one again.
  await page.clickButton('Export', '.tab')
  await page.waitFor('.export')
  await page.evaluate(`[...document.querySelectorAll('.export .paragraphs input')][1].click()`)
  await pause(200)
  await page.clickButton('Export the story as text, in English', '.button')
  await pause(500)
  const written = await page.evaluate(`fetch([...document.querySelectorAll('.export .download')].at(-1).href).then(response => response.text())`)
  page.check('the text exported reads as written', written.includes('You have {Coins} coins in your pocket, and the night is long. The guard at the gate watches every move you make, as he has every night since the fair came to town. Nobody else is out, not even the cats that usually sleep under the carts. The wind carries the smell of rain from the hills, and somewhere a door bangs open and shut, open and shut, as if someone had forgotten to close it.'), true)
}
