// A picture shown for the first time is drawn the moment it is needed: an expression never seen
// replaces the one before without an empty instant, and a new background is drawn as soon as it is
// there. Watched on every animation frame, with large pictures that take a moment to decode, made by
// ffmpeg rather than kept in the repository.
import { execFileSync } from 'node:child_process'
import { advanceUntil, createProjectWithStory, pause } from './harness.mjs'

const STORY = `[enter: mika normal]
Mika waits by the door.
She checks the time.
[mika: smile]
Mika smiles.
[bg: park]
They walk to the park.`

/** Noise, which PNG cannot squeeze: a large file, slow to decode. */
function noisePicture(path, size) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', `nullsrc=size=${size},geq=random(1)*255:random(2)*255:random(3)*255`, '-frames:v', '1', '-y', path])
}

/** Notes, frame by frame, whether the character and the background are drawn, until `stopWatching()`. */
const WATCH = `(() => {
  window.watchedFrames = []
  window.isWatching = true
  const isDrawn = picture => picture != null && getComputedStyle(picture).visibility !== 'hidden'
    && (picture.tagName === 'CANVAS' || (picture.complete && picture.naturalWidth > 0))
  const watch = () => {
    const sprite = document.querySelector('.viewport .character .sprite')
    const background = [...document.querySelectorAll('.viewport .background')].at(-1)?.querySelector('img, canvas')
    window.watchedFrames.push({ sprite: sprite?.getAttribute('alt') ?? null, isSpriteDrawn: isDrawn(sprite), background: background?.getAttribute('src') ?? null, isBackgroundDrawn: isDrawn(background) })
    if (window.isWatching) {
      requestAnimationFrame(watch)
    }
  }
  requestAnimationFrame(watch)
})()`

export default async function check(page, { url, output }) {
  noisePicture(`${output}/mika.png`, '900x1500')
  noisePicture(`${output}/mika-smile.png`, '900x1500')
  noisePicture(`${output}/park.png`, '2400x1350')

  await createProjectWithStory(page, url, 'Ready', STORY)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', ['mika.png', 'mika-smile.png', 'park.png'].map(fileName => `${output}/${fileName}`))
  await page.waitFor('.message[role=status]', 30000)
  await pause(600)
  page.check('every picture finds its entry', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .sprite:not(.pending)', 10000)
  await pause(300)

  // The smile is two pages ahead: read at an ordinary pace, it is ready when its page comes.
  await page.evaluate(WATCH)
  await advanceUntil(page, shown => shown.includes('checks the time'))
  await pause(700)
  await advanceUntil(page, shown => shown.includes('smiles'))
  await pause(1200)
  const atSmile = await page.evaluate(`(() => { window.isWatching = false; return window.watchedFrames })()`)
  page.check('the smile is shown', atSmile.at(-1)?.sprite, 'mika, smile')
  page.check('and Mika is drawn on every frame, through the change', atSmile.filter(frame => !frame.isSpriteDrawn).length, 0)

  await page.evaluate(WATCH)
  await advanceUntil(page, shown => shown.includes('park'))
  await pause(1200)
  const atPark = await page.evaluate(`(() => { window.isWatching = false; return window.watchedFrames })()`)
  const parkFrames = atPark.filter(frame => frame.background !== null)
  page.check('the park is shown', parkFrames.length > 0, true)
  page.check('and drawn from the first frame it is there', parkFrames.filter(frame => !frame.isBackgroundDrawn).length, 0)
}
