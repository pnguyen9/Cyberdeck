// Title cards: when the project shows them, each chapter's title comes over the stage as it starts,
// before its text, styled by the style `chapter title`; moving on passes it, or it goes by itself. The
// ending's name takes the style `ending`, here from the CSS.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[style: Chapter title = gold, large, fade-in]
# Chapter 1 — The Letter
The first page.
# Chapter 2 — Rooftop
The wind on the roof.
[ending: Alone]`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Titles', STORY)
  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions .check input')
  await page.evaluate(`document.querySelector('.definitions .check input').click()`)
  await pause(300)
  page.check('turning them on is confirmed', await page.statusText(), 'Each chapter now shows its title as it starts.')
  await page.setValue('.definitions textarea.css', '.ending { color: rgb(255, 120, 120) }')
  await page.clickButton('Save the CSS', '.button')
  await pause(300)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .title-card')
  const card = () => page.evaluate(`(() => {
    const title = document.querySelector('.viewport .title-card-text')
    return title === null ? null : [title.textContent, title.className.split(' ').filter(name => name.startsWith('style-') || name.startsWith('author-')).join(' ')]
  })()`)
  page.check('the first chapter opens on its title, in its style', await card(), ['Chapter 1 — The Letter', 'style-gold style-large style-fade-in author-chapter-title'])
  page.check('its text waits, the menu too', await page.evaluate(`[document.querySelector('.viewport .textbox'), document.querySelector('.viewport .quick-menu')].every(element => element === null)`), true)
  await pause(700)
  await page.screenshot('title-card')
  await page.press(' ')
  await pause(800)
  page.check('moving on passes the title, and nothing more', [await card(), await shownStep(page)], [null, 'The first page.'])

  // The first page is typed by now: one press moves on.
  await page.press(' ')
  await pause(300)
  page.check('the next chapter shows its own', (await card())?.[0], 'Chapter 2 — Rooftop')
  await pause(3200)
  page.check('a title goes by itself, the text then typed', [await card(), await shownStep(page)], [null, 'The wind on the roof.'])

  await page.press(' ')
  await page.press(' ')
  await pause(600)
  page.check('the ending takes the style ending, from the CSS', await page.evaluate(`(() => {
    const name = document.querySelector('.viewport .end-screen .ending-name')
    return [name?.textContent, getComputedStyle(name).color]
  })()`), ['Alone', 'rgb(255, 120, 120)'])
  await page.screenshot('ending')
}
