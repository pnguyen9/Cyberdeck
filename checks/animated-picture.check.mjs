// An animated picture that plays once, the guide's falling example: Kai's fall plays when shown, and
// again the second time, and in a new preview, rather than showing its last frame at once; `[wait]` holds
// the picture after it. In Firefox too, which plays a picture left to it once per page only.
import { join } from 'node:path'
import { copyFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createProject, pause } from './harness.mjs'

/** Firefox plays an animated picture once per page: the stage must play it itself there. */
export const firefox = true

const example = fileURLToPath(new URL('../docs/guide/examples/falling/', import.meta.url))

export default async function check(page, { url, output }) {
  await createProject(page, url, 'Falling')
  await page.setValue('.import .source', readFileSync(join(example, 'falling.txt'), 'utf8'))
  await pause(800)
  page.check('the example imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', ['kai-standing.webp', 'kai-falling.webp', 'kai-lying.webp'].map(fileName => join(example, fileName)))
  await page.waitFor('.message[role=status]', 30000)
  await pause(600)
  page.check('every picture finds its entry', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .sprite')
  await pause(1500)
  // A few pixels at the middle of Kai's head as drawn standing: skin while upright, the background once tipped over.
  const sprite = async () => {
    const head = await page.evaluate(`(() => {
      const box = document.querySelector('.viewport .character .sprite').getBoundingClientRect()
      return { x: box.x + box.width * 0.5 - 3, y: box.y + box.height * 250 / 1500 - 3, width: 6, height: 6 }
    })()`)
    return { name: await page.evaluate(`(() => { const sprite = document.querySelector('.viewport .character .sprite'); return sprite.getAttribute('alt') ?? sprite.getAttribute('aria-label') })()`), frame: await page.capture(head) }
  }
  const standing = await sprite()

  // While the falling picture shows, and a moment after, samples as often as screenshots allow: upright at
  // first, tipped over at some point, and never upright again once tipped, not even for an instant.
  const fall = async () => {
    await page.press(' ')
    await pause(100)
    const start = await sprite()
    let hasTipped = false
    let stoodUpAgain = false
    for (let sample = 0, afterFall = 0; sample < 80 && afterFall < 12; sample++) {
      const now = await sprite()
      const isUpright = now.frame === standing.frame
      stoodUpAgain ||= hasTipped && isUpright
      hasTipped ||= !isUpright
      afterFall += now.name === 'Kai, falling' ? 0 : 1
      await pause(20)
    }
    return [start.name, start.frame === standing.frame, hasTipped, stoodUpAgain]
  }
  page.check('the fall starts upright, then tips over, and stays down', await fall(), ['Kai, falling', true, true, false])
  const after = await sprite()
  page.check('the wait over, Kai lies on the ground', [after.name, after.frame === standing.frame], ['Kai, lying', false])

  await page.press(' ')
  await pause(1500)
  page.check('the second fall plays again from the start', await fall(), ['Kai, falling', true, true, false])

  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .sprite')
  await pause(1500)
  page.check('and the first fall of a new preview too', await fall(), ['Kai, falling', true, true, false])

  // Backgrounds and illustrations too: an animated one is played by the stage, a still one stays a picture.
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  copyFileSync(join(example, 'kai-falling.webp'), join(output, 'pond.webp'))
  copyFileSync(join(example, 'kai-standing.webp'), join(output, 'shore.webp'))
  copyFileSync(join(example, 'kai-falling.webp'), join(output, 'memory.webp'))
  await createProject(page, url, 'Backgrounds')
  await page.setValue('.import .source', '[bg: pond]\nOn the ice.\n[bg: shore]\nOn the shore.\n[illustration: memory]\nA memory.')
  await pause(800)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(output, 'pond.webp'), join(output, 'shore.webp'), join(output, 'memory.webp')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(600)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .background')
  await pause(1500)
  const drawnAs = selector => page.evaluate(`document.querySelector('.viewport ${selector} .fill')?.tagName.toLowerCase() ?? null`)
  const background = [await drawnAs('.background')]
  await page.press(' ')
  await pause(1200)
  background.push(await drawnAs('.background'))
  await page.press(' ')
  await pause(1500)
  page.check('an animated background or illustration is played by the stage, a still one stays a picture', [...background, await drawnAs('.illustration')], ['canvas', 'img', 'canvas'])
}
