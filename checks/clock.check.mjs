// The clock's counters, in Cyberdeck's preview: the hour and the day of the week as the player's
// computer tells them, and a first time away of 0, with nothing declared.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `It is {hour} o'clock on day {weekday}, after {time away} minutes away.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Clock', STORY)
  page.check('the story imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(1500)
  const expected = await page.evaluate(`(() => { const now = new Date(); return "It is " + now.getHours() + " o'clock on day " + ((now.getDay() + 6) % 7 + 1) + ", after 0 minutes away." })()`)
  page.check('the clock tells the hour and the day, the first time away 0', await shownStep(page), expected)
}
