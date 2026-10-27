// The library of Datajack's desktop build: games installed as files, their assets stored by content
// and served to the page, played, resumed after a restart, removed with their files but not the saves.
import { existsSync, readdirSync } from 'node:fs'
import { exportSampleGame, installGame, pause } from './harness.mjs'

export const app = 'datajack-desktop'

export default async function check(page, { home, output, assets, serve }) {
  const archive = await exportSampleGame(`${output}/cyberdeck`, await serve('cyberdeck'), assets)
  const libraryFolder = `${home}/.config/Datajack/library`
  const shownText = () => page.evaluate(`document.querySelector('.viewport .text')?.textContent`)

  await page.typeText('Pascal')
  await pause(300)
  await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
  await pause(800)
  await installGame(page, archive)
  page.check('installing reports the game', await page.statusText(), 'The Letter 1.0 installed.')
  page.check('the cover is served from the installed files', await page.evaluate(`(() => { const image = document.querySelector('.cover img'); return image !== null && image.src.startsWith('datajack://app/installed-assets/') && image.naturalWidth > 0 })()`), true)
  const games = readdirSync(`${libraryFolder}/games`)
  page.check('one folder per installed game', games.length, 1)
  page.check('the manifest and the chapter are files', existsSync(`${libraryFolder}/games/${games[0]}/game.json`) && readdirSync(`${libraryFolder}/games/${games[0]}/chapters`).length === 1, true)
  page.check('assets are stored by content', readdirSync(`${libraryFolder}/assets`).every(name => /^[0-9a-f]{64}\.(svg|wav)$/.test(name)), true)
  page.check('an installed asset outside the assets path is refused', await page.evaluate(`fetch('datajack://app/installed-assets/..%2Fgames').then(response => response.status)`), 404)

  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(500)
  page.check('the game starts', (await shownText())?.startsWith('The classroom was empty'), true)
  page.check('the background is the installed file', await page.evaluate(`[...document.querySelectorAll('.viewport .background')].some(element => getComputedStyle(element).backgroundImage.includes('datajack://app/installed-assets/'))`), true)
  for (let press = 0; press < 3; press++) {
    await page.press(' ')
  }
  await pause(800)
  const textBeforeLeaving = await shownText()
  await page.screenshot('desktop-playing')

  await page.restart()
  page.check('the library is there after a restart', await page.evaluate(`document.querySelector('.game h2')?.textContent`), 'The Letter 1.0')
  await page.clickButton('Continue', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('Continue resumes the same page', await shownText(), textBeforeLeaving)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.clickButton('Remove', '.link-button')
  await pause(200)
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(1000)
  page.check('removing deletes the game and its files', readdirSync(`${libraryFolder}/games`).length === 0 && readdirSync(`${libraryFolder}/assets`).length === 0, true)
  page.check('the saves stay', existsSync(`${home}/Documents/Datajack/Pascal`) && readdirSync(`${home}/Documents/Datajack/Pascal`).length === 1, true)
}
