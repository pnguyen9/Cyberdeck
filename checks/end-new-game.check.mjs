// The end screen's New game, in Cyberdeck's preview and in Datajack: first in order, one Tab away but
// never focused at once, it starts the story again from its first page, the lasting values carried over
// as the library's New game carries them. It always asks first, the autosave it replaces being where
// players come back to the end.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, pickOption, playUntilStop, shownStep } from './harness.mjs'

const STORY = `# Monday
[counter lasting: Visits = 0]
You have been here {Visits} times.
[add: Visits 1]
[choice: Way]
> Stay = Stay
> Leave = Leave
[if: Way is Stay]
You stay.
[ending: Home]
[end]
[to be continued: The road goes on with the next update.]
# Tuesday
The road.
[ending: Away]`

const isEnded = page => page.evaluate(`!!document.querySelector('.viewport .end-screen')`)
const endButtons = page => page.evaluate(`[...document.querySelectorAll('.viewport .end-button')].map(button => button.textContent.trim())`)
const focused = page => page.evaluate(`document.activeElement?.textContent.trim() ?? null`)

/** From the story's start, takes a way at the choice and plays on to the end screen. */
async function playTo(page, way) {
  await playUntilStop(page)
  await pickOption(page, way)
  await pause(300)
  await playUntilStop(page)
}

/** Once a new game shows its first page. */
async function waitForStart(page) {
  await page.waitUntil(`document.querySelector('.viewport .text')?.textContent.startsWith('You have been') === true`, 4000)
  await pause(400)
}

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Visits', STORY)
  page.check('the story imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])

  // Cyberdeck's preview: the same end screen, the same New game.
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  await playTo(page, 'Stay')
  page.check('the preview ends', (await shownStep(page))?.startsWith('Home'), true)
  page.check('the end screen offers New game first', (await endButtons(page))[0], 'New game')
  await page.clickButton('New game', '.end-button')
  await pause(300)
  page.check('New game asks first at an ending', await page.evaluate(`document.querySelector('.viewport .end-confirm')?.textContent.trim()`), 'Start a new game? Your autosave, here at the end, will be replaced; your saved slots are kept.')
  page.check('with New game and Cancel', await endButtons(page), ['New game', 'Cancel'])
  await page.clickButton('New game', '.end-button')
  await waitForStart(page)
  page.check('New game in the preview starts the story again, the lasting counter kept', (await shownStep(page))?.startsWith('You have been here 1 times'), true)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  await page.clickButton('Export', '.tab')
  await pause(300)
  await page.evaluate(`[...document.querySelectorAll('.export .chapters input[type=checkbox]')][1].click()`)
  await pause(200)
  await page.evaluate(`document.querySelector('.export .left-out input[value=hidden]').click()`)
  await pause(200)
  const archive = await exportGame(page, 'visits.zip')

  await createProfile(page, await serve('datajack'), 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('Datajack starts the story with the lasting counter at its start', (await shownStep(page))?.startsWith('You have been here 0 times'), true)
  await playTo(page, 'Stay')
  page.check('the story reaches its ending', (await shownStep(page))?.startsWith('Home'), true)
  page.check('the end screen offers New game, then going back and the library', await endButtons(page), ['New game', '◀ Back', 'Map', '← Library'])
  page.check('the ending keeps the focus away from New game: the keys reading the last page cannot start again', (await focused(page)) === 'New game', false)
  await page.screenshot('ending')

  // The keyboard: one Tab reaches New game, Space presses it (the harness's Enter types no character, which a button needs).
  await page.press('Tab')
  await pause(200)
  page.check('one Tab reaches New game', await focused(page), 'New game')
  await page.press(' ')
  await pause(300)
  page.check('Space on New game asks first', await endButtons(page), ['New game', 'Cancel'])
  page.check('the question takes the focus on Cancel, which reads it out', [await focused(page), await page.evaluate(`document.getElementById(document.activeElement.getAttribute('aria-describedby'))?.classList.contains('end-confirm') ?? false`)], ['Cancel', true])
  await page.screenshot('confirm-at-ending')
  await page.press('Escape')
  await pause(300)
  page.check('Escape while asked only cancels the question: the end screen stays, the focus back on New game', [await isEnded(page), await endButtons(page), await focused(page)], [true, ['New game', '◀ Back', 'Map', '← Library'], 'New game'])
  await page.press(' ')
  await pause(300)
  await page.clickButton('Cancel', '.end-button')
  await pause(300)
  page.check('Cancel leaves the end screen at its ending', [(await shownStep(page))?.startsWith('Home'), (await endButtons(page))[0]], [true, 'New game'])
  await page.clickButton('New game', '.end-button')
  await pause(300)
  await page.clickButton('New game', '.end-button')
  await waitForStart(page)
  page.check('New game starts the story again from its first page, the lasting counter carried over', (await shownStep(page))?.startsWith('You have been here 1 times'), true)

  // Where the story is to be continued, the question says the autosave is where it goes on.
  await playTo(page, 'Leave')
  page.check('running out of chapters says the story goes on', (await shownStep(page))?.startsWith('The road goes on'), true)
  await page.clickButton('New game', '.end-button')
  await pause(300)
  page.check('New game asks first, saying the story is to be continued', await page.evaluate(`document.querySelector('.viewport .end-confirm')?.textContent.trim()`), 'Start a new game? Your autosave, where the story goes on once its next chapters are installed, will be replaced; your saved slots are kept.')
  page.check('with New game and Cancel', await endButtons(page), ['New game', 'Cancel'])
  await page.screenshot('to-be-continued')
  await page.clickButton('Cancel', '.end-button')
  await pause(300)
  page.check('Cancel leaves the end screen as it was', [await isEnded(page), (await endButtons(page))[0]], [true, 'New game'])
  await page.clickButton('New game', '.end-button')
  await pause(300)
  await page.clickButton('New game', '.end-button')
  await waitForStart(page)
  page.check('confirmed, New game starts again, the counter carried over once more', (await shownStep(page))?.startsWith('You have been here 2 times'), true)

  // Back in the library, the story is played from its first page.
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.clickButton('Continue', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('the autosave is the new game’s', (await shownStep(page))?.startsWith('You have been here 2 times'), true)
}
