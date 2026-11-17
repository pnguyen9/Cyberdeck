// Going back a page after picking an option keeps where it leads: the next choice is still joined to it
// on the map. Going back to the choice itself and picking again joins nothing to the choice it left.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `A fork in the road.
[choice: Road]
> Left = Left
> Right = Right
You walk on.
The road goes on.
[choice: Rest]
> Sit = Sit
> Run = Run
The end.`

export default async function check(page, { url }) {
  const advanceTo = async condition => {
    for (let press = 0; press < 10 && !condition(await shownStep(page)); press++) {
      await page.press(' ')
      await pause(400)
    }
  }
  const pick = async text => {
    await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === ${JSON.stringify(text)}).click()`)
    await pause(600)
  }
  const openMap = async () => {
    await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Map').click()`)
    await page.waitFor('.map-screen')
    await pause(500)
  }
  const mapNow = async () => [
    await page.evaluate(`[...document.querySelectorAll('.map-screen .node')].map(node => node.querySelector('h2')?.textContent).join(' / ')`),
    await page.evaluate(`document.querySelectorAll('.map-screen .curves path').length`),
  ]

  await createProjectWithStory(page, url, 'Roads back', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await advanceTo(step => step === 'CHOICE')
  await pick('Left')
  for (let press = 0; press < 4 && await shownStep(page) !== 'CHOICE'; press++) {
    await page.press('ArrowLeft')
    await pause(400)
  }
  await pick('Right')
  await advanceTo(step => step.startsWith('The road'))
  await page.press('ArrowLeft')
  await pause(400)
  page.check('going back a page after the pick', (await shownStep(page)).startsWith('You walk on'), true)
  await advanceTo(step => step === 'CHOICE')
  await openMap()
  page.check('still joins the option to the next choice, and the option undone to nothing', await mapNow(), ['Road / Rest', 1])
  page.check('both options picked are shown taken', await page.evaluate(`[...document.querySelectorAll('.map-screen .options li')].map(option => option.textContent.trim()).slice(0, 2)`), ['› Left', '› Right'])
}
