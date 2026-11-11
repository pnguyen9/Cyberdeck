// The map of every path in Cyberdeck's preview: an option only some values open, closed in the state
// its point was first reached in, has its own ▶, which previews from a path where it is offered.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `[counter: Bond = 0]
A free day.
[choice: Day]
> Rest at home = Rest
> Spend it with Mika = Mika
[if: Day is Mika]
[add: Bond 1]
[end]
[choice: Evening]
> Find Mika = Mika [if: Bond >= 1]
> Go home = Home
[if: Evening is Mika]
[ending: Fireworks]
[end]
[ending: Quiet]`

const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Evening', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  // Nothing played yet: the map is offered all the same, on every path.
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Map').click()`)
  await page.waitFor('.map-screen .node')
  await pause(600)
  page.check('the map from the first page, on every path', await page.evaluate(`document.querySelector('.map-screen .subtitle').textContent`), 'every path, explored from the story')
  await page.clickButton('← Preview', '.close-button')
  await page.waitFor('.viewport .text')
  await pause(600)
  for (let press = 0; press < 4 && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(500)
  }
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Map').click()`)
  await page.waitFor('.map-screen')
  await page.clickButton('Every path', '.switch-button')
  await pause(800)
  const evening = `[...document.querySelectorAll('.map-screen .node')].find(node => node.querySelector('h2')?.textContent === 'Evening')`
  page.check('the option closed where the point was first reached has its own ▶', await page.evaluate(`[...${evening}.querySelectorAll('.options li')].map(option => !!option.querySelector('.option-play'))`), [true, false])
  await page.evaluate(`${evening}.querySelector('.option-play').click()`)
  await page.waitFor('.viewport .option')
  await pause(600)
  page.check('and previews from a path where it is offered', await options(page), ['Find Mika', 'Go home'])
}
