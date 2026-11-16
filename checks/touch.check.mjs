// Datajack on a phone, with the computer first: a tap moves on as a click does, a long press hides the
// text as a right click does and does not also move on, swipes go back and move on; the leave label is
// shown without a mouse to point at it; held upright, the device is asked to turn, and sideways, offered
// full screen. In Cyberdeck's preview of the Minesweeper sample, tapping a tile opens it and a long
// press flags one, neither taken for a swipe.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProfile, createProject, createProjectWithSample, exportGame, installGame, pause, shownStep } from './harness.mjs'

export const app = 'datajack'

const minesweeper = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'minesweeper')

/** A phone of 844 × 390 CSS pixels, sideways or upright, whose screen is touched rather than pointed at. */
async function emulatePhone(page, orientation) {
  const isLandscape = orientation === 'landscape'
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: isLandscape ? 844 : 390,
    height: isLandscape ? 390 : 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: isLandscape ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 },
  })
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' }, { name: 'any-pointer', value: 'coarse' }] })
  await pause(400)
}

/** A finger as the touch screen sends it: down, along the points, and lifted. */
async function touch(page, points, holdMilliseconds = 40) {
  const [first, ...rest] = points
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x, y: first.y, id: 1 }] })
  for (const point of rest) {
    await pause(16)
    await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y, id: 1 }] })
  }
  await pause(holdMilliseconds)
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await pause(400)
}

const tap = (page, x, y) => touch(page, [{ x, y }])
const longPress = (page, x, y) => touch(page, [{ x, y }], 800)
/** Across the screen, in a few steps: `dx` positive to the right. */
const swipe = (page, x, y, dx) => touch(page, Array.from({ length: 6 }, (_, step) => ({ x: x + dx * step / 5, y: y + step })))

const middleOf = (page, selector) => page.evaluate(`(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()`)

export default async function check(page, { url, assets, serve }) {
  await createProjectWithSample(page, await serve('cyberdeck'), 'The Letter')
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
  await pause(1000)
  const archive = await exportGame(page, 'The Letter 1.0.zip')
  await createProfile(page, url, 'Pascal')
  await installGame(page, archive)

  await emulatePhone(page, 'portrait')
  page.check('the phone is a screen without a mouse', await page.evaluate(`matchMedia('(hover: none) and (pointer: coarse)').matches`), true)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(400)
  const offer = () => page.evaluate(`document.querySelector('.landscape-offer')?.innerText.replace(/\\s+/g, ' ').trim() ?? null`)
  page.check('held upright, the device is asked to turn', await offer(), 'Turn your device sideways: the game is played in landscape. Play in full screen Not now')
  await page.screenshot('upright')
  await emulatePhone(page, 'landscape')
  page.check('sideways, full screen is offered', await offer(), 'The game is best played in full screen. Play in full screen Not now')
  await page.screenshot('sideways-offer')
  await page.clickButton('Not now', '.landscape-offer .button')
  await pause(200)
  page.check('not now leaves the game alone', await offer(), null)
  await emulatePhone(page, 'portrait')
  page.check('and holds for this game', await offer(), null)
  await emulatePhone(page, 'landscape')

  page.check('the leave label is shown without a mouse to point at it', await page.evaluate(`getComputedStyle(document.querySelector('.leave-label')).display`), 'inline')
  const stage = await middleOf(page, '.viewport .screen')
  const startsWith = async prefix => (await shownStep(page)).startsWith(prefix)
  await tap(page, stage.x, stage.y - 60)
  await tap(page, stage.x, stage.y - 60)
  page.check('a tap shows the whole page, a second moves on', await startsWith('Somewhere'), true)
  await swipe(page, stage.x - 150, stage.y - 60, 300)
  page.check('swiping right goes back', await startsWith('The classroom'), true)
  await swipe(page, stage.x + 150, stage.y - 60, -300)
  page.check('swiping left moves on', await startsWith('Somewhere'), true)

  await longPress(page, stage.x, stage.y - 60)
  page.check('a long press hides the text, as a right click does', await page.evaluate(`document.querySelector('.viewport .textbox') === null`), true)
  await page.screenshot('long-press-hides-text')
  await tap(page, stage.x, stage.y - 60)
  page.check('a tap shows the text again, the long press having moved nothing on', [await page.evaluate(`document.querySelector('.viewport .textbox') !== null`), await startsWith('Somewhere')], [true, true])

  // The buttons are fingers' too: a tap on Settings opens them, and a drag scrolls them, not the stage.
  const settingsButton = await page.evaluate(`(() => { const rect = [...document.querySelectorAll('.quick-button')].find(button => button.textContent.trim() === 'Settings').getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()`)
  await tap(page, settingsButton.x, settingsButton.y)
  page.check('a tap on a button presses it', await page.evaluate(`!!document.querySelector('.viewport .overlay[role=dialog]')`), true)
  await page.evaluate(`[...document.querySelectorAll('.viewport button')].find(button => button.textContent.trim() === 'Controls')?.click()`)
  await pause(300)
  page.check('the controls tell what fingers do', await page.evaluate(`[...document.querySelectorAll('.touch-help')].map(help => getComputedStyle(help).display + ' ' + help.textContent)`), ['block On a touch screen, a tap is a left click and a long press a right click; swiping right goes back, swiping left moves on.'])
  const scroller = `[...document.querySelectorAll('.viewport *')].find(element => element.scrollHeight > element.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))`
  const settingsMiddle = await page.evaluate(`(() => { const rect = ${scroller}.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height * 0.7 } })()`)
  await touch(page, Array.from({ length: 8 }, (_, step) => ({ x: settingsMiddle.x, y: settingsMiddle.y - step * 20 })))
  await pause(400)
  page.check('a finger scrolls the settings', await page.evaluate(`${scroller}.scrollTop > 0`), true)
  await page.screenshot('controls-for-fingers')
  await page.press('Escape')
  await pause(300)
  page.check('and moves nothing on', await startsWith('Somewhere'), true)

  // Minesweeper in the preview: tiles are tapped and long pressed, never swiped.
  await page.send('Emulation.clearDeviceMetricsOverride')
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await page.send('Emulation.setEmulatedMedia', { features: [] })
  await createProject(page, await serve('cyberdeck'), 'Minesweeper')
  await page.setValue('.import .source', readFileSync(join(minesweeper, 'minesweeper.txt'), 'utf8'))
  await pause(1500)
  await page.clickButton('Import', '.import-actions .button')
  await pause(1500)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await emulatePhone(page, 'landscape')
  await pause(400)
  for (let press = 0; press < 6 && !(await page.evaluate(`!!document.querySelector('.viewport .option')`)); press++) {
    const screen = await middleOf(page, '.viewport .screen')
    await tap(page, screen.x, screen.y)
  }
  await pause(600)
  const beginner = await page.evaluate(`(() => { const rect = [...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim().startsWith('Beginner')).getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()`)
  await tap(page, beginner.x, beginner.y)
  await pause(1200)
  const tiles = () => page.evaluate(`[...document.querySelectorAll('.viewport .grid-menu .tile')].map(tile => tile.getAttribute('aria-label').split(': ')[1] ?? '')`)
  page.check('a tap on an option picks it', (await tiles()).length, 81)
  const tileAt = index => middleOf(page, `.viewport .grid-menu .tile:nth-child(${index + 1})`)
  const first = await tileAt(40)
  // A finger wanders a little as it taps: still a tap on the tile.
  await touch(page, [first, { x: first.x + 4, y: first.y + 3 }])
  await pause(1200)
  const opened = await tiles()
  page.check('a tap on a tile opens it, a little wandering and all', opened[40] !== 'hidden', true)
  const across = await tileAt(opened.indexOf('hidden'))
  await swipe(page, across.x, across.y, -200)
  await pause(800)
  page.check('a swipe over the tiles opens none, nor moves on', [JSON.stringify(await tiles()) === JSON.stringify(opened), await page.evaluate(`!!document.querySelector('.viewport .grid-menu')`)], [true, true])
  const hidden = opened.indexOf('hidden')
  const target = await tileAt(hidden)
  await longPress(page, target.x, target.y)
  await pause(800)
  page.check('a long press on a tile flags it, and does not open it', (await tiles())[hidden], 'flag')
  page.check('nor hides the text', await page.evaluate(`document.querySelector('.viewport .textbox') !== null`), true)
  await page.screenshot('minesweeper-flag-by-finger')
}
