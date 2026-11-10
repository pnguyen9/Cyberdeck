// A number asked of the player, for a counter with decimals: the field reads a comma or a point, says
// what it understood or why it cannot take it, keeps the number within its bounds (one of them what
// another counter holds), and the story shows it as the game's language writes numbers.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[counter: Money = 100.00]
[ask number: Bet = 10.00, from 0.50 to {Money}]
[add: Money -1]
You bet {Bet}, and have {Money} left.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Bets', STORY)
  page.check('the story imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport #asked-number')
  await pause(500)
  const field = () => page.evaluate(`[
    document.querySelector('.viewport .ask-bounds')?.textContent.trim(),
    document.querySelector('.viewport .ask-note').textContent.trim(),
    document.querySelector('.viewport .ask-button').disabled,
  ]`)
  const type = async typed => {
    await page.setValue('.viewport #asked-number', typed)
    await pause(150)
  }
  page.check('the field says its bounds, and what nothing typed gives', await field(), ['From 0.50 to 100.00', '10.00 if you type nothing', false])
  await type('13,37')
  page.check('a comma reads as the decimal sign', await field(), ['From 0.50 to 100.00', 'Read as 13.37', false])
  await type('1 000')
  page.check('more than the money held is refused', await field(), ['From 0.50 to 100.00', 'At most 100.00', true])
  await type('0,505')
  page.check('more decimals than kept are refused', (await field()).slice(1), ['At most 2 decimals', true])
  await type('-5')
  page.check('below the lowest bound is refused', (await field()).slice(1), ['At least 0.50', true])
  await page.screenshot('refused')
  await type('25.5')
  await page.press('Enter')
  await pause(800)
  page.check('the bet given shows in the story', await shownStep(page), 'You bet 25.50, and have 99.00 left.')
}
