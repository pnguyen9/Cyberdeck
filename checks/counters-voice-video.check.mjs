// Counters, voices and videos: a counter counts up in a loop and decides the page after it, the
// storyboard and the Index show it; a video plays over the whole screen, the text waiting until the
// player passes it; a voice plays at its own volume and stops as the player moves on. The video is
// made by ffmpeg, which most Linux systems have, rather than kept in the repository.
import { execFileSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter: Trust = 1]
[loop]
[add: Trust]
[if: Trust >= 3]
[break]
[end]
[end]
[video: Opening]
[voice: hello-line]— Marie: Hello.
[if: Trust is 3]
She trusts you.
[else]
She does not.
[end]
The end.`

export default async function check(page, { url, assets, output }) {
  const video = `${output}/Opening.webm`
  execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x180:rate=15', '-c:v', 'libvpx', '-y', video])
  const voice = `${output}/hello-line.wav`
  copyFileSync(`${assets}/door.wav`, voice)

  await createProjectWithStory(page, url, 'Counted', STORY)
  page.check('the story imports without problems', await page.evaluate(`document.querySelectorAll('.import .problems li').length`), 0)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [video, voice])
  await pause(1200)
  page.check('the video and the voice get their files', await page.statusText(), '2 files added: Opening.webm → Video Opening, hello-line.wav → Sound hello-line.')
  page.check('Cast & files lists the video', await page.evaluate(`[...document.querySelectorAll('.section-title')].map(title => title.textContent.trim()).includes('Videos')`), true)

  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await pause(400)
  page.check('the storyboard shows what the counter does', await page.evaluate(`[...document.querySelectorAll('.grid .element')].map(element => element.textContent.replace(/\\s+/g, ' ').trim()).filter(text => text.startsWith('◇') || text.startsWith('±'))`), ['◇ Trust: starts at 1'])
  await page.screenshot('storyboard')

  await page.clickButton('Index', '.tab')
  await page.waitFor('.index')
  await pause(300)
  page.check('the Index lists the counter, where it is declared', await page.evaluate(`[...document.querySelectorAll('.name-header')].map(header => [...header.children].map(part => part.textContent.trim()).join(' | ')).find(text => text.startsWith('Trust'))`), 'Trust | declared in Untitled chapter · at the start | declared · changed · tested')
  await page.screenshot('index')

  // Every voice the page starts is noted, with its volume, and whether it was stopped.
  await page.evaluate(`(() => {
    window.voices = []
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !this.loop) {
        window.voices.push(this)
      }
      return play.call(this).catch(() => undefined)
    }
  })()`)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(800)
  page.check('the video plays over the whole screen, the text and the menu hidden', await page.evaluate(`[!!document.querySelector('.viewport .video-screen video'), !!document.querySelector('.viewport .textbox'), !!document.querySelector('.viewport .quick-menu')]`), [true, false, false])
  page.check('the voice of the page waits for the video', await page.evaluate(`window.voices.length`), 0)
  await page.screenshot('video')

  await page.press(' ')
  await pause(1200)
  page.check('moving on passes the video: the page and its line come', [await page.evaluate(`!!document.querySelector('.viewport .video-screen')`), await shownStep(page)], [false, 'Hello.'])
  page.check('the line plays at the voices volume', await page.evaluate(`window.voices.map(voice => voice.volume)`), [1])

  await page.press(' ')
  await pause(800)
  page.check('the counter decides the page after the loop', await shownStep(page), 'She trusts you.')
  page.check('moving on stops the line', await page.evaluate(`window.voices[0].paused`), true)

  await page.press('ArrowLeft')
  await pause(600)
  page.check('coming back to the page plays its line again', await page.evaluate(`window.voices.length`), 2)
}
