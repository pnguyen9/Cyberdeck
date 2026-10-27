// Characters entering, sliding, leaving and moving, with sprites facing the way they are drawn:
// the sample story with the test assets, in Cyberdeck's preview.
import { readdirSync } from 'node:fs'
import { advanceUntil, createProjectWithSample, pause, shownStep, visibleText } from './harness.mjs'

export default async function check(page, { url, assets }) {
  const characterLayout = () => page.evaluate(`[...document.querySelectorAll('.viewport .character')].map(character => ({
    name: character.querySelector('img')?.alt ?? character.textContent.trim(),
    left: character.style.left,
    mirrored: !!character.querySelector('.mirrored'),
  }))`)

  await createProjectWithSample(page, url, 'Animations')
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
  await pause(1000)
  // Every sprite is drawn looking right: Jules, standing on the right, must be mirrored to face Marie.
  await page.evaluate(`[...document.querySelectorAll('.drawn-facing select')].forEach(select => { select.value = 'right'; select.dispatchEvent(new Event('change')) })`)
  await pause(500)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')

  await advanceUntil(page, step => step === 'You came after all.')
  await pause(600)
  await page.screenshot('marie-enters-left')
  page.check('Marie enters on the left, not mirrored, being drawn looking right', await characterLayout(), [{ name: 'Marie, normal', left: '25%', mirrored: false }])

  for (let press = 0; press < 30 && !(await shownStep(page)).startsWith('The wind on the rooftop'); press++) {
    if (await shownStep(page) === 'CHOICE') {
      await pause(500)
      await page.evaluate(`document.querySelectorAll('.viewport .option')[0].click()`)
      await pause(300)
    } else {
      await page.press(' ')
    }
  }
  await page.press(' ')
  await page.press(' ')
  await page.screenshot('jules-sliding-in')
  page.check('the text waits while Jules slides in', await visibleText(page), '')
  await pause(1200)
  await page.screenshot('jules-in-place')
  page.check('Jules stands on the right, mirrored to face Marie', (await characterLayout()).find(character => character.name.startsWith('Jules'))?.mirrored, true)
  page.check('the text starts after the slide', (await shownStep(page)).startsWith('So this is where'), true)

  await advanceUntil(page, step => step.startsWith('He never could'), 10)
  await page.screenshot('jules-leaving-marie-moving')
  await pause(1200)
  page.check('Jules leaves and Marie moves to the center', await characterLayout(), [{ name: 'Marie, surprised', left: '50%', mirrored: false }])
  await page.screenshot('marie-center')
}
