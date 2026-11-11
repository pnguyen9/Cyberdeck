// A story played forward only, `[no going back: until an ending]`, in Datajack: no going back, saving
// or loading, the reason told; the map records its choices as usual, without playing from them, which
// would take the player back, each point telling, hovered, what the journal showed then; once an ending
// is reached, everything comes back.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, shownStep } from './harness.mjs'

export const app = 'datajack'

const STORY = `[counter: Steps = 3]
[shown: Steps]
[no going back: until an ending]
A path splits.
[choice: Way]
> Left = Left
> Right = Right
You went {Way}.
[ending: Out]`

const quickButton = (page, label) => page.evaluate(`(() => { const button = [...document.querySelectorAll('.viewport .quick-button')].find(candidate => candidate.textContent.trim().startsWith(${JSON.stringify(label)})); return button === undefined ? 'missing' : button.disabled ? 'off' : 'on' })()`)
const mapPoint = page => page.evaluate(`[...document.querySelectorAll('.map-screen .node.point')].map(node => [node.querySelector('h2').textContent, node.querySelector('.play-button') !== null ? 'play' : node.querySelector('.forward-only')?.textContent])`)

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, await serve('cyberdeck'), 'Forward', STORY)
  const archive = await exportGame(page, 'forward.zip')
  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(600)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === 'Left').click()`)
  await pause(800)
  page.check('forward only: no going back, saving or loading', [await shownStep(page), await quickButton(page, '◀ Back'), await quickButton(page, 'Save'), await quickButton(page, 'Load')], ['You went Left.', 'off', 'off', 'off'])
  await page.press('ArrowLeft')
  await pause(300)
  page.check('going back says why, and until when', await page.evaluate(`document.querySelector('.viewport .notice')?.textContent.trim() ?? null`), 'Here the story only goes forward: no going back, saving or loading until you have reached an ending.')
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'Map').click()`)
  await page.waitFor('.map-screen')
  await pause(500)
  page.check('the map records the choice, without playing from it', await mapPoint(page), [['Way', 'The story only goes forward here']])
  page.check('its point tells, hovered, what the journal showed then', await page.evaluate(`document.querySelector('.map-screen .node.point')?.title`), 'Steps: 3')
  await page.clickButton('← Game', '.close-button')
  await page.waitFor('.viewport .text')
  await pause(800)
  for (let press = 0; press < 4 && !(await page.evaluate(`!!document.querySelector('.viewport .end-screen')`)); press++) {
    await page.press(' ')
    await pause(600)
  }
  page.check('an ending reached, going back comes back', [await page.evaluate(`!!document.querySelector('.viewport .end-screen')`), await page.evaluate(`[...document.querySelectorAll('.viewport .end-button')].some(button => button.textContent.trim().includes('Back'))`)], [true, true])
  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(500)
  page.check('and playing from the map', await mapPoint(page), [['Way', 'play']])
}
