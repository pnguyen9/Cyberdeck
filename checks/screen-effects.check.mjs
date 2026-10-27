// Screen effects in the preview: a tint that lasts until changed, a fade out that leaves the text on
// black until a fade in, and a shake and a flash played as the text reaches them.
import { pause, shownStep } from './harness.mjs'

const STORY = `[tint: sepia]
A memory.
[fade out: 0.4s]
In the dark.
[transition: black 0.6s] [bg: rooftop]
[fade in: 0.4s] [tint: none]
Back on the roof. [shake: strong 0.3s] It shook. [flash: red 0.2s]`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Effects')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts every effect', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  // Every animation the player starts is noted: the element it moves, and how long it lasts.
  await page.evaluate(`(() => {
    window.animations = []
    const animate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      window.animations.push(this.className + ' ' + (typeof options === 'number' ? options : options?.duration))
      return animate.call(this, keyframes, options)
    }
  })()`)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(600)
  const coverOpacity = () => page.evaluate(`document.querySelector('.viewport .cover').style.opacity`)
  page.check('the tint colours the stage', await page.evaluate(`document.querySelector('.viewport .stage').classList.contains('tint-sepia')`), true)
  await page.screenshot('tinted')

  const nextPage = async () => {
    const before = await shownStep(page)
    for (let press = 0; press < 4 && await shownStep(page) === before; press++) {
      await page.press(' ')
      await pause(250)
    }
    await pause(700)
  }
  await nextPage()
  page.check('a fade out covers the screen', [await shownStep(page), await coverOpacity()], ['In the dark.', '1'])
  await page.screenshot('dark')
  await nextPage()
  page.check('a fade in uncovers it, the tint gone too', [await coverOpacity(), await page.evaluate(`document.querySelector('.viewport .stage').classList.length`)], ['0', 1])
  await pause(1500)
  page.check('the shake and the flash play as the text reaches them', await page.evaluate(`window.animations.filter(animation => /^(scene|flash) /.test(animation))`), ['scene 300', 'flash 200'])
}
