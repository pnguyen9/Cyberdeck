// Scrollbars, the same in every screen: thin, the thumb tinted, the track see-through. The editor's
// follow its look, a light one included; the stage, a game's, keeps its own cyan, and the map, dark
// whatever the look, a thumb that shows over it.
import { advanceUntil, createProjectWithStory, pause } from './harness.mjs'

const STORY = `The crossroads.
[choice: Road]
${Array.from({ length: 10 }, (_, index) => `> Road number ${index + 1} = Road${index + 1}`).join('\n')}
The road goes on.`

const scrollbarOf = selector => `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).scrollbarColor`
const widthOf = selector => `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).scrollbarWidth`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Roads', STORY)
  page.check('the editor\'s scrollbars are thin, tinted with the accent', await page.evaluate(`[${widthOf('.editor-page')}, ${scrollbarOf('.editor-page')}]`), ['thin', 'color(srgb 0.619608 0.917647 1 / 0.4) rgba(0, 0, 0, 0)'])
  await page.press('?')
  await pause(300)
  await page.screenshot('editor-default')
  await page.press('Escape')
  await pause(300)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await advanceUntil(page, step => step === 'CHOICE')
  await page.waitFor('.viewport .choice-menu')
  await pause(400)
  page.check('ten options overflow the menu', await page.evaluate(`(() => { const menu = document.querySelector('.choice-menu'); return menu.scrollHeight > menu.clientHeight })()`), true)
  page.check('the stage\'s scrollbar keeps its cyan', await page.evaluate(scrollbarOf('.choice-menu')), 'color(srgb 0.470588 0.862745 1 / 0.4) rgba(0, 0, 0, 0)')
  await page.screenshot('choice-menu')
  await page.press('Escape')
  await pause(300)

  // A light look: the editor's thumb takes its dark accent; the map, dark still, the default look's.
  await page.evaluate(`localStorage.setItem('cyberdeck:look', JSON.stringify({ borderColour: '#b9b0a0', borderKind: 'solid', backgroundKind: 'colour', backgroundColour: '#f7f4ec', corners: ['#f7f4ec', '#f7f4ec', '#f7f4ec', '#f7f4ec'], font: 'serif', textColour: '#1f2328', accentColour: '#1a5296', readableBox: false }))`)
  await page.reload()
  await page.waitFor('.page-header')
  await pause(300)
  page.check('a light look tints the editor\'s scrollbars with its accent', await page.evaluate(`[document.documentElement.dataset.look, ${scrollbarOf('.app-screen')}]`), ['paper', 'color(srgb 0.101961 0.321569 0.588235 / 0.4) rgba(0, 0, 0, 0)'])
  await page.press('?')
  await pause(300)
  await page.screenshot('editor-paper')
  await page.press('Escape')
  await pause(300)

  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  page.check('the stage keeps its cyan under a light look', await page.evaluate(scrollbarOf('.viewport')), 'color(srgb 0.470588 0.862745 1 / 0.4) rgba(0, 0, 0, 0)')
  await page.clickButton('Map', '.viewport .quick-button')
  await page.waitFor('.map-screen .node')
  await pause(600)
  page.check('the map, dark under a light look, has a light thumb', await page.evaluate(scrollbarOf('.map-screen')), 'color(srgb 0.619608 0.917647 1 / 0.4) rgba(0, 0, 0, 0)')
  await page.screenshot('map-paper')
}
