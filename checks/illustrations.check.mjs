// Illustrations: made in Cyberdeck with their file, shown over the stage when Datajack plays the game,
// and collected in the game's gallery, those not seen yet locked.
import { createProfile, exportGame, installGame, pause, shownStep } from './harness.mjs'

export const app = 'datajack'

// The second illustration is in a branch only a later playthrough takes: the first one leaves it locked.
const STORY = `[bg: Rooftop]
The roof, at dawn.
[illustration: Rooftop sunrise]
The sun came up over the city.
[illustration: none]
[if: seen ending Morning]
[cg: Second morning]
Again.
[end]
[ending: Morning]`

export default async function check(page, { url, assets, serve }) {
  await page.navigate(await serve('cyberdeck'))
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Sunrise')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  // Any image does for the test: the background's picture stands in for the illustration's too.
  await page.setFiles('.drop-zone .file-input', [`${assets}/Rooftop.svg`])
  await pause(800)
  page.check('Cast & files lists the illustrations', await page.evaluate(`[...document.querySelectorAll('.section-title')].map(title => title.textContent)`).then(titles => titles.includes('Illustrations')), true)
  const archive = await exportGame(page, 'Sunrise.zip')

  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)
  page.check('the card counts the illustrations seen', (await page.evaluate(`document.querySelector('.chapters')?.textContent`))?.includes('illustrations seen: 0 of 2'), true)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport')
  await pause(600)
  await page.press(' ')
  await page.press(' ')
  await pause(900)
  page.check('the illustration covers the stage', [await shownStep(page), await page.evaluate(`document.querySelector('.viewport .illustration .illustration-label')?.textContent`)], ['The sun came up over the city.', 'Rooftop sunrise'])
  await page.screenshot('illustration')
  await page.press('Escape')
  await pause(800)
  page.check('back in the library, one is seen', (await page.evaluate(`document.querySelector('.chapters')?.textContent`))?.includes('illustrations seen: 1 of 2'), true)

  await page.clickButton('Gallery', '.button')
  await page.waitFor('.gallery')
  page.check('the gallery shows the one seen, the other locked', await page.evaluate(`[...document.querySelectorAll('.gallery .tiles li')].map(tile => tile.querySelector('.locked') !== null ? 'locked' : tile.textContent.trim())`), ['Rooftop sunrise', 'locked'])
  await page.screenshot('gallery')
  await page.evaluate(`document.querySelector('.gallery .tile').click()`)
  await pause(200)
  page.check('a seen one opens on the whole screen', await page.evaluate(`document.querySelector('.gallery .shown') !== null`), true)
  await page.press('Escape')
  await page.press('Escape')
  await pause(300)
  page.check('Escape goes back to the library', await page.evaluate(`document.querySelector('.gallery') === null && document.querySelector('.games') !== null`), true)
}
