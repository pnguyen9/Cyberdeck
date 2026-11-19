// Depth in the preview: a character near is larger and in front, one far smaller and behind; a move
// may change the depth alone. Full body, sizes change around the feet, the lowest drawn row of the
// picture: two sprites with room under their feet, one near and one far, stand on the same line.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `[enter: marie left near] [enter: jules right far]
Both of them.
[move: marie far]
Marie steps back.`

/** A figure whose feet are at 600 of its 960 pixels, transparent below but for a stray speck. */
const PADDED_HEIGHT = 960
const PADDED_FEET = 600
const padded = body => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${PADDED_HEIGHT}">
  <ellipse cx="300" cy="200" rx="110" ry="120" fill="#f2c6a0"/>
  <path d="M 140 ${PADDED_FEET} Q 140 330 300 320 Q 460 330 460 ${PADDED_FEET} Z" fill="${body}"/>
  <rect x="80" y="900" width="2" height="2" fill="#000"/>
</svg>`

export default async function check(page, { url, output }) {
  const files = `${output}/padded`
  mkdirSync(files, { recursive: true })
  writeFileSync(`${files}/marie.svg`, padded('#3d5a80'))
  writeFileSync(`${files}/jules.svg`, padded('#6a994e'))

  await createProjectWithStory(page, url, 'Depth', STORY)
  page.check('the import accepts depths', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [`${files}/marie.svg`, `${files}/jules.svg`])
  await pause(1500)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .sprite')
  await pause(1500)
  const depths = () => page.evaluate(`[...document.querySelectorAll('.viewport .character')].map(character => [character.querySelector('.sprite').getAttribute('alt').split(',')[0], character.style.scale, character.style.zIndex].join(' '))`)
  page.check('near is larger and in front, far smaller and behind', await depths(), ['marie 1.25 3', 'jules 0.75 1'])
  page.check('characters stay under the menu', await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('.viewport .quick-button')].find(candidate => candidate.textContent === 'Load')
    const rect = button.getBoundingClientRect()
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === button
  })()`), true)
  /** Where each character's feet are drawn, in stage pixels from its top, from the picture's box as scaled. */
  const feet = () => page.evaluate(`(() => {
    const stage = document.querySelector('.viewport .stage').getBoundingClientRect()
    const scale = stage.height / 1080
    return Object.fromEntries([...document.querySelectorAll('.viewport .character')].map(character => {
      const box = character.querySelector('.sprite').getBoundingClientRect()
      return [character.querySelector('.sprite').getAttribute('alt').split(',')[0], Math.round((box.top + box.height * ${PADDED_FEET / PADDED_HEIGHT} - stage.top) / scale)]
    }))
  })()`)
  const before = await feet()
  // At the middle depth, the feet stand where the picture puts them: 360 pixels above the bottom.
  const line = 1080 - (PADDED_HEIGHT - PADDED_FEET)
  page.check('near and far, the feet stand on the same line, where the middle depth puts them', [before.marie, before.jules].map(at => Math.abs(at - line) <= 3 ? line : at), [line, line])
  await page.screenshot('depth')
  await page.press(' ')
  await page.press(' ')
  await pause(1500)
  page.check('a move to a depth alone', await depths(), ['marie 0.75 1', 'jules 0.75 1'])
  const after = await feet()
  page.check('stepping back, the feet stay on their line', Math.abs(after.marie - line) <= 3 ? line : after.marie, line)
}
