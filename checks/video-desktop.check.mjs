// A video in Datajack's desktop build: installed as a file like the others, served to the page and
// played over the whole screen, then passed to the text after it. The video is made by ffmpeg.
import { execFileSync } from 'node:child_process'
import { createProjectWithStory, exportGame, installGame, openBrowser, pause, shownStep } from './harness.mjs'

export const app = 'datajack-desktop'

export default async function check(page, { output, serve }) {
  const video = `${output}/Opening.webm`
  execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=320x180:rate=15', '-c:v', 'libvpx', '-y', video])
  const browser = await openBrowser(`${output}/cyberdeck`, 9337)
  let archive
  try {
    await createProjectWithStory(browser, await serve('cyberdeck'), 'Filmed', '[video: Opening]\nAfter the film.')
    await browser.clickButton('Cast & files', '.tab')
    await browser.waitFor('.drop-zone .file-input')
    await browser.setFiles('.drop-zone .file-input', [video])
    await pause(1000)
    archive = await exportGame(browser, 'Filmed.zip')
  } finally {
    await browser.close()
  }

  await page.typeText('Pascal')
  await pause(300)
  await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
  await pause(800)
  await installGame(page, archive)
  page.check('the game with a video installs', await page.statusText(), 'Filmed 1.0 installed.')

  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .video-screen video')
  await pause(1500)
  page.check('the video is served from the installed files and plays', await page.evaluate(`(() => {
    const video = document.querySelector('.viewport .video-screen video')
    return [video.src.startsWith('datajack://app/installed-assets/'), video.videoWidth, video.currentTime > 0]
  })()`), [true, 320, true])
  await page.screenshot('desktop-video')
  await page.press(' ')
  await pause(800)
  page.check('moving on passes it to the text', await shownStep(page), 'After the film.')
}
