// Endings, memories, the map of the routes explored and skipping: a story written in Cyberdeck, played in Datajack.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, shownStep } from './harness.mjs'

const STORY = `# Night
The station was empty.
A train was coming.
[if: remembered The conductor's face]
The conductor nods at you, as if he knew.
[else]
A stranger checks your ticket.
[end]
[remember: The conductor's face]
[choice: Train]
> Board it = Board
> Stay = Stay
[if: Train is Board]
The doors closed behind you.
[ending: Departure]
[end]
The train left without you.
[ending: Platform]`

export default async function check(page, { url, serve }) {
  /** Presses on until a choice or the end, then waits for the options to accept clicks. */
  const playUntilStop = async () => {
    for (let press = 0; press < 20; press++) {
      const step = await shownStep(page)
      if (step === 'CHOICE' || await page.evaluate(`!!document.querySelector('.viewport .end-screen')`)) {
        break
      }
      await page.press(' ')
    }
    await pause(500)
  }
  const pickOption = text => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes(${JSON.stringify(text)}))?.click() ?? 'missing'`)
  const cardChapters = () => page.evaluate(`document.querySelector('.chapters')?.textContent.trim()`)

  await createProjectWithStory(page, url, 'Night Train', STORY)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.board')
  await page.clickButton('Tree', '.view-switch .button')
  await page.waitFor('.board.tree')
  page.check('the storyboard shows memories and endings as markers', await page.evaluate(`[...document.querySelectorAll('.board.tree .item.marker')].map(marker => marker.querySelector('.symbol').textContent + ' ' + marker.querySelector('.line').textContent.trim()).join(' / ')`), "✦ The conductor's face / ★ Departure / ★ Platform")
  page.check('and conditions on memories', await page.evaluate(`document.querySelector('.board.tree .branch > .test')?.textContent.trim()`), "◆ if remembered The conductor's face")
  const archive = await exportGame(page, 'night.zip')

  await createProfile(page, await serve('datajack'), 'Pascal')
  await page.watchViolations()
  await installGame(page, archive)
  page.check('the card counts the endings', (await cardChapters())?.endsWith('endings reached: 0 of 2'), true)
  page.check('no map before playing', await page.evaluate(`[...document.querySelectorAll('.button')].some(button => button.textContent.trim() === 'Map')`), false)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  await playUntilStop()
  await pickOption('Board it')
  await pause(300)
  await playUntilStop()
  page.check('the end screen names the ending', (await shownStep(page))?.startsWith('Departure'), true)
  page.check('and counts the endings reached', (await shownStep(page))?.includes('Endings reached: 1 of 2'), true)
  await page.screenshot('ending')

  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(300)
  page.check('the map shows the choice and the ending', await page.evaluate(`[...document.querySelectorAll('.node')].map(node => node.querySelector('h2')?.textContent ?? node.textContent.trim()).join(' / ')`), 'Train / ★ Departure')
  page.check('the option tried and the one not yet', await page.evaluate(`[...document.querySelectorAll('.options li')].map(item => item.textContent.trim()).join(' / ')`), '› Board it / ? Stay')
  page.check('a curve joins the option to the ending', await page.evaluate(`document.querySelectorAll('.curves path').length`), 1)
  await page.clickButton('Play from here', '.play-button')
  await page.waitFor('.viewport')
  await pause(1000)
  page.check('playing from the point shows the choice again', await shownStep(page), 'CHOICE')
  await pickOption('Stay')
  await pause(300)
  await playUntilStop()
  page.check('the other option leads to the other ending', (await shownStep(page))?.startsWith('Platform'), true)
  page.check('both endings are counted', (await shownStep(page))?.includes('Endings reached: 2 of 2'), true)
  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen')
  await pause(300)
  page.check('the map now holds one choice and two endings', await page.evaluate(`document.querySelectorAll('.node').length`), 3)
  page.check('with both options tried', await page.evaluate(`document.querySelectorAll('.options li.untried').length`), 0)
  await page.screenshot('map')
  await page.clickButton('← Game', '.close-button')
  await pause(1200)
  page.check('closing the map goes back to the game', await page.evaluate(`!!document.querySelector('.viewport .text') || !!document.querySelector('.viewport .end-screen')`), true)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  page.check('the card shows the endings reached', (await cardChapters())?.endsWith('endings reached: 2 of 2'), true)

  await page.clickButton('New game', '.button')
  await pause(200)
  await page.clickButton('Start over', '.button')
  await page.waitFor('.viewport .text')
  await pause(500)
  await page.clickButton('Skip ⏩', '.quick-button')
  await pause(800)
  page.check('the second playthrough remembers, and skipping stops at the new text', await shownStep(page), 'The conductor nods at you, as if he knew.')
  page.check('no content security violation', await page.violations(), '[]')
}
