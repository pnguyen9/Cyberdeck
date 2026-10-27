// The library of Datajack's web build: a game made in Cyberdeck with its details, cover and files,
// installed, played, resumed after a reload, started over, removed; files that are not games refused.
import { readdirSync } from 'node:fs'
import { createProfile, createProjectWithSample, exportGame, installGame, pause, shownStep } from './harness.mjs'

export const app = 'datajack'

export default async function check(page, { url, assets, serve }) {
  const buttonShown = text => page.evaluate(`[...document.querySelectorAll('.button')].some(button => button.textContent.trim() === ${JSON.stringify(text)})`)

  await createProjectWithSample(page, await serve('cyberdeck'), 'The Letter')
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
  await pause(1000)
  await page.clickButton('Details', '.tab')
  await page.waitFor('.details textarea')
  for (const [index, text] of ['An empty classroom, a letter, and a choice.', 'Story: Pascal\nTest art: drawn by a script'].entries()) {
    await page.evaluate(`(() => {
      const field = document.querySelectorAll('.details textarea')[${index}]
      field.value = ${JSON.stringify(text)}
      field.dispatchEvent(new Event('input'))
      field.dispatchEvent(new Event('change'))
    })()`)
    await pause(300)
  }
  await page.setFiles('.cover-actions input[type=file]', [`${assets}/Rooftop.svg`])
  await pause(800)
  const archive = await exportGame(page, 'The Letter 1.0.zip')

  await createProfile(page, url, 'Pascal')
  await page.watchViolations()
  page.check('the library starts empty', (await page.evaluate(`document.querySelector('.empty')?.textContent.trim()`))?.startsWith('No games yet'), true)
  await installGame(page, archive)
  page.check('installing reports the game', await page.statusText(), 'The Letter 1.0 installed.')
  page.check('the card shows the description', await page.evaluate(`document.querySelector('.description')?.textContent`), 'An empty classroom, a letter, and a choice.')
  page.check('and the chapters', await page.evaluate(`document.querySelector('.chapters')?.textContent.trim()`), '1 chapter')
  page.check('the cover is shown from the installed file', await page.evaluate(`(() => { const image = document.querySelector('.cover img'); return image !== null && image.complete && image.naturalWidth > 0 })()`), true)
  await page.clickButton('Credits', '.link-button')
  await pause(200)
  page.check('credits keep their lines', await page.evaluate(`document.querySelector('.credits')?.innerText`), 'Story: Pascal\nTest art: drawn by a script')
  await page.screenshot('library-card')

  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  page.check('the game starts from the library', (await shownStep(page)).startsWith('The classroom was empty'), true)
  page.check('the background comes from the installed file', await page.evaluate(`[...document.querySelectorAll('.viewport .background')].some(element => getComputedStyle(element).backgroundImage.includes('blob:'))`), true)
  for (let press = 0; press < 4; press++) {
    await page.press(' ')
  }
  await pause(400)
  const textBeforeLeaving = await shownStep(page)
  page.check('the leave button names the library', await page.evaluate(`document.querySelector('.leave-button')?.textContent.trim()`), '← Library Esc')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  page.check('Continue is offered after playing', await buttonShown('Continue'), true)

  await page.reload()
  await page.waitFor('.game h2')
  await page.watchViolations()
  page.check('the installed game is still there after a reload', await page.evaluate(`document.querySelector('.game h2')?.textContent`), 'The Letter 1.0')
  await page.clickButton('Continue', '.button')
  await page.waitFor('.viewport .text')
  await pause(300)
  page.check('Continue resumes the same page', await shownStep(page), textBeforeLeaving)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  await page.clickButton('New game', '.button')
  await pause(300)
  page.check('starting over asks first when there is an autosave', (await page.evaluate(`document.querySelector('.confirmation p')?.textContent`))?.startsWith('Start over?'), true)
  await page.clickButton('Cancel', '.button')
  await pause(200)
  await page.clickButton('Remove', '.link-button')
  await pause(200)
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(800)
  page.check('removing empties the library', (await page.evaluate(`document.querySelector('.empty')?.textContent.trim()`))?.startsWith('No games yet'), true)

  await installGame(page, `${assets}/calm.wav`)
  page.check('a file that is not a game is refused clearly', await page.evaluate(`document.querySelector('.error')?.textContent`), 'calm.wav: This file is not a ZIP archive')
  page.check('no content security violation', await page.violations(), '[]')

  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 700, deviceScaleFactor: 1, mobile: true })
  await installGame(page, archive)
  page.check('no horizontal scroll at phone width', await page.evaluate(`document.documentElement.scrollWidth <= 375`), true)
  await page.screenshot('library-phone')
}
