// A timed choice counts only while it is shown: a panel opened over it, the log or the settings, pauses
// the time left, and closing it goes on from there, rather than from the whole time again.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `Here it comes.
[choice: Answer 8s]
> Speak = Spoke
> Wait = Waited [timeout]
You {Answer}.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Timed', STORY)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.press(' ')
  await page.waitFor('.viewport .option')
  const panel = async label => {
    await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim().startsWith(${JSON.stringify(label)})).click()`)
    await pause(1500)
    await page.evaluate(`document.querySelector('.overlay .close-button, .settings-panel .close-button, [role=dialog] .close-button')?.click()`)
    await pause(200)
  }
  await pause(2000)
  await panel('Log')
  await pause(2000)
  await panel('Settings')
  const closedAt = Date.now()
  for (let waited = 0; waited < 12000 && (await shownStep(page)) === 'CHOICE'; waited += 100) {
    await pause(100)
  }
  const tookAfterClosing = (Date.now() - closedAt) / 1000
  page.check('after two panels, the time left goes on: about 4 s, not the whole 8 again', [await shownStep(page), tookAfterClosing > 2.5 && tookAfterClosing < 6], ['You Waited.', true])
}
