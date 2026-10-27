// Sound effects: named in the text, given their file in Cast & files, played by the preview going
// forward, at the volume of the settings, and not again when going back.
import { pause } from './harness.mjs'

const STORY = `[sound: door]
Someone came in.
Then [sound: door] again.
Silence.`

export default async function check(page, { url, assets }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Sounds')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [`${assets}/door.wav`])
  await pause(800)
  page.check('the sound gets its file', await page.evaluate(`[...document.querySelectorAll('.entry')].map(entry => [...entry.children].map(part => part.textContent.trim()).join(' ')).find(text => text.startsWith('door'))`), 'door door.wav')

  // Every sound the page starts is noted, with its volume.
  await page.evaluate(`(() => {
    window.playedSounds = []
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (!this.loop) {
        window.playedSounds.push(this.volume)
      }
      return play.call(this).catch(() => undefined)
    }
  })()`)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  const played = () => page.evaluate(`window.playedSounds.length`)
  page.check('the sound before the first page plays', await played(), 1)
  await page.press(' ')
  await page.press(' ')
  await pause(1200)
  page.check('the one inside the text plays when the text reaches it', await played(), 2)
  await page.press('ArrowLeft')
  await pause(400)
  page.check('going back plays nothing', await played(), 2)

  await page.press('o')
  await page.setValue('.overlay input[aria-label="Sound effects volume"]', '30')
  await page.press('Escape')
  await page.press(' ')
  await pause(1200)
  page.check('going forward again plays it, at the volume chosen', await page.evaluate(`window.playedSounds.at(-1)`), 0.3)
}
