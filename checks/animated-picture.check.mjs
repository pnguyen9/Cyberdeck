// An animated picture that plays once, the guide's falling example: Kai's fall plays when shown, and
// again the second time, rather than showing its last frame at once; `[wait]` holds the picture after it.
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createProject, pause } from './harness.mjs'

const example = fileURLToPath(new URL('../docs/guide/examples/falling/', import.meta.url))

export default async function check(page, { url }) {
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
    return { name: await page.evaluate(`document.querySelector('.viewport .character .sprite').alt`), frame: await page.capture(head) }
  }
  const standing = await sprite()

  // While the falling picture shows, samples every 100 ms: upright at first, tipped over at some point.
  const fall = async () => {
    await page.press(' ')
    await pause(100)
    const start = await sprite()
    let hasTipped = false
    for (let sample = 0; sample < 20 && (await sprite()).name === 'Kai, falling'; sample++) {
      hasTipped ||= (await sprite()).frame !== standing.frame
      await pause(100)
    }
    return [start.name, start.frame === standing.frame, hasTipped]
  }
  page.check('the fall starts upright, then tips over', await fall(), ['Kai, falling', true, true])
  await pause(300)
  const after = await sprite()
  page.check('the wait over, Kai lies on the ground', [after.name, after.frame === standing.frame], ['Kai, lying', false])

  await page.press(' ')
  await pause(1500)
  page.check('the second fall plays again from the start', await fall(), ['Kai, falling', true, true])
}
