// A part played as a game, `[game mode]`, in Datajack: no going back, saving or loading there (the log
// can be read, not gone back through), its choices no points of the map, which goes from the choice
// before it to the one after; everything back once `[game mode: off]`. Cyberdeck's preview lets the
// author go back anyway.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, shownStep } from './harness.mjs'

export const app = 'datajack'

const STORY = `Before the game.
[choice: Start]
> Play = Play
[game mode]
Cards are dealt.
[choice: Hand]
> Hit = Hit
> Stand = Stand
You chose {Hand}.
[game mode: off]
After the game.
[choice: End]
> Finish = Finish
The end.`

const quickButton = (page, label) => page.evaluate(`(() => { const button = [...document.querySelectorAll('.viewport .quick-button')].find(candidate => candidate.textContent.trim().startsWith(${JSON.stringify(label)})); return button === undefined ? 'missing' : button.disabled ? 'off' : 'on' })()`)
const pickOption = (page, text) => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === ${JSON.stringify(text)}).click()`)
const lockedButtons = async page => [await quickButton(page, '◀ Back'), await quickButton(page, 'Save'), await quickButton(page, 'Load')]

export default async function check(page, { url, serve }) {
  const cyberdeck = await serve('cyberdeck')
  await createProjectWithStory(page, cyberdeck, 'Card game', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await pause(600)
  await pickOption(page, 'Play')
  await pause(800)
  page.check('the preview lets the author go back in a part played as a game', await quickButton(page, '◀ Back'), 'on')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  const archive = await exportGame(page, 'Card game.zip')

  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  page.check('before the game, saving and loading are there', (await lockedButtons(page)).slice(1), ['on', 'on'])
  await page.press(' ')
  await pause(600)
  await pickOption(page, 'Play')
  await pause(800)
  page.check('in the game, no going back, saving or loading', await lockedButtons(page), ['off', 'off', 'off'])
  await page.press('ArrowLeft')
  await pause(300)
  page.check('the key to go back says why it does nothing', [await shownStep(page), await page.evaluate(`document.querySelector('.viewport .notice')?.textContent.trim() ?? null`)], ['Cards are dealt.', 'This part is played as a game: no going back, saving or loading until it ends.'])
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim().startsWith('Log')).click()`)
  await pause(400)
  page.check('the log can be read, not gone back through', await page.evaluate(`[document.querySelectorAll('.lines .line').length > 0, [...document.querySelectorAll('.lines .line')].every(line => line.disabled), document.querySelector('.overlay .hint')?.textContent]`), [true, true, 'This part is played as a game: no going back, saving or loading until it ends.'])
  await page.evaluate(`document.querySelector('.overlay .close-button').click()`)
  await pause(300)
  await page.press(' ')
  await pause(600)
  await pickOption(page, 'Hit')
  await pause(600)
  await page.press(' ')
  await pause(800)
  page.check('after [game mode: off], everything is back', [await shownStep(page), ...await lockedButtons(page)], ['After the game.', 'on', 'on', 'on'])
  await page.press(' ')
  await pause(600)
  await pickOption(page, 'Finish')
  await pause(600)
  await page.press(' ')
  await pause(800)
  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(500)
  page.check('the map leaves the game out, from the choice before it to the one after', await page.evaluate(`[...document.querySelectorAll('.map-screen .node.point h2')].map(heading => heading.textContent)`), ['Start', 'End'])
  page.check('linked', await page.evaluate(`document.querySelectorAll('.map-screen .curves path').length`), 2)
  await page.screenshot('map')
}
