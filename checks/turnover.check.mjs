// A picture turning over, `[card: ace flip 1s]`: the old one narrows to nothing, then the new one widens
// from it; and a `[wait]` before the text holding back the tags written after it, which play once it ends.
import { pause } from './harness.mjs'

const STORY = `[enter: card center back]
Dealt.
[card: ace flip 1s]
Turned over.
[card: edge]
[wait: 0.8]
[card: king]
Held back.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Turnover')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts flip and wait', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character')
  await pause(1200)
  const card = () => page.evaluate(`(() => {
    const turn = document.querySelector('.viewport .character .turn')
    return [turn.querySelector('.placeholder-label').textContent.split('· ')[1], [...turn.classList].filter(name => name.startsWith('turning')).join(' ')].join(' ').trim()
  })()`)
  page.check('the card is dealt face down', await card(), 'back')

  await page.press(' ')
  await pause(200)
  page.check('turning over, the back narrows first', await card(), 'back turning-out')
  await pause(500)
  page.check('then the face widens from its edge', await card(), 'ace turning-in')
  await pause(800)
  page.check('and stays, the turn over', await card(), 'ace')

  await page.press(' ')
  await pause(300)
  page.check('a wait before the text holds back what follows it', await card(), 'edge')
  await pause(1000)
  page.check('which plays once the wait is over', await card(), 'king')
}
