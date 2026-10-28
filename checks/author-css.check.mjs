// The CSS of the styles: written in Definitions, what is not about how text looks left out and said
// so, each class a style the text may use, drawn by the preview; and pages cut before a class grew
// larger pointed out.
import { pause } from './harness.mjs'

const STORY = `[style: Shine = glow]
— Marie: [style: ghost]Who is there?[style: none] [style: Shine]Nobody.[style: none]
[style: ghost]The house was quiet, and the wind went on whispering through the broken shutters of the old library.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Styled')
  await page.clickButton('Create')
  await page.waitFor('.import .source')

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions textarea.css')
  await page.setValue('.definitions textarea.css', '.ghost { color: rgb(136, 170, 255); position: fixed; animation: drift 2s infinite }\n@keyframes drift { 50% { opacity: 0.5 } }')
  await pause(300)
  page.check('what does not change how text looks is left out, and said why', await page.evaluate(`[...document.querySelectorAll('.definitions .problems li')].map(item => item.textContent.replace(/\\s+/g, ' ').trim())`), ['Left out: position: fixed — not a property of how text looks.'])
  page.check('each class is a style', await page.evaluate(`[...document.querySelectorAll('.definitions p.muted')].some(paragraph => paragraph.textContent.includes('Styles from the CSS: ghost.'))`), true)
  await page.clickButton('Save the CSS', '.button')
  await pause(400)
  page.check('saving says the parts left out stay out', await page.statusText(), 'The CSS is saved; the parts listed are left out.')
  await page.screenshot('css')

  await page.clickButton('Import', '.tab')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the text may use the class as a style', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .textbox')
  await page.press(' ')
  await pause(400)
  const run = text => page.evaluate(`(() => {
    const run = [...document.querySelectorAll('.viewport .textbox .text span')].find(candidate => candidate.textContent === ${JSON.stringify(text)})
    const style = run === undefined ? null : getComputedStyle(run)
    return style === null ? null : [run.className, style.color, style.position, style.animationName]
  })()`)
  page.check('the preview draws the class from the CSS, renamed, its animation too', await run('Who is there?'), ['author-ghost', 'rgb(136, 170, 255)', 'static', 'author-drift'])
  page.check('a style glows', (await run('Nobody.'))?.[3], 'style-glow')
  page.check('the player\'s own buttons keep their looks', await page.evaluate(`getComputedStyle(document.querySelector('.viewport .quick-button')).color`), 'rgb(158, 234, 255)')
  await page.screenshot('preview')
  await page.press('Escape')
  await pause(400)

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions textarea.css')
  await page.setValue('.definitions textarea.css', '.ghost { color: rgb(136, 170, 255); font-size: 1.5em }')
  await pause(400)
  page.check('pages cut before the class grew are pointed out', await page.evaluate(`document.querySelector('.definitions .problems p.warning')?.textContent.replace(/\\s+/g, ' ').trim()`), '1 page was cut before this CSS made its style larger, and no longer fits the text box. Edit it in the storyboard and save: the page is cut again.')
  await page.screenshot('too-long')
}
