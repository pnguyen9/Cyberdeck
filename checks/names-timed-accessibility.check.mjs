// What 1.3 adds to playing: the player types a name, which the story then shows, their keys not taken
// for the player's own (S skips, O opens the settings); a timed choice takes its hidden option when
// time runs out, unless the player asked choices to wait; and the accessibility settings: larger
// text in a taller box, a plainer font, stronger contrast, pages read aloud; and screen readers
// given each page whole rather than as it is typed.
import { createProjectWithStory, pause, shownStep } from './harness.mjs'

const STORY = `[ask: Hero = Alex]
— {Hero}: My name is {Hero}.
[choice: Answer 1.5s]
> Speak up = Speak
> … = Silent [timeout]
[if: Answer is Silent]
You said nothing.
[else]
You spoke.
[end]
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Named', STORY)
  page.check('the story imports without problems', await page.evaluate(`document.querySelectorAll('.import .problems li').length`), 0)

  // Every line read aloud is noted rather than spoken.
  await page.evaluate(`(() => {
    window.spoken = []
    speechSynthesis.speak = utterance => window.spoken.push(utterance.text)
  })()`)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .ask-input')
  await pause(400)
  page.check('the player is asked for the name, its default shown', await page.evaluate(`[document.querySelector('.viewport .ask-label').textContent, document.querySelector('.viewport .ask-input').placeholder, document.activeElement?.className]`), ['Hero', 'Alex', 'ask-input'])
  for (const key of ['S', 'o', 'l', 'o', ' ']) {
    await page.press(key)
  }
  page.check('typing is not playing: S and O stay letters', [await page.evaluate(`document.querySelector('.viewport .ask-input').value`), await page.evaluate(`document.querySelector('.overlay') === null`)], ['Solo ', true])
  await page.screenshot('ask')
  await page.press('Enter')
  await pause(150)
  page.check('a screen reader hears the page whole while it is typed, the typing kept from it', await page.evaluate(`[
    document.querySelector('.viewport .announcement').textContent,
    document.querySelector('.viewport .textbox').getAttribute('aria-hidden'),
    document.querySelector('.viewport .announcement').getAttribute('aria-live'),
  ]`), ['Solo: My name is Solo.', 'true', 'polite'])
  await pause(850)
  page.check('the name speaks and is spoken of', [await page.evaluate(`document.querySelector('.viewport .speaker')?.textContent`), await shownStep(page)], ['Solo', 'My name is Solo.'])

  await page.press(' ')
  await pause(700)
  page.check('a timed choice shows its time running out, not the option of the timeout', await page.evaluate(`[[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim()), !!document.querySelector('.viewport .time-left')]`), [['Speak up'], true])
  await page.screenshot('timed-choice')
  await pause(1600)
  page.check('when time runs out, the option of the timeout is taken', await shownStep(page), 'You said nothing.')

  await page.press('ArrowLeft')
  await pause(400)
  await page.press('o')
  await page.evaluate(`[...document.querySelectorAll('.overlay .category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
  await pause(100)
  const tick = label => page.evaluate(`[...document.querySelectorAll('.overlay .check')].find(check => check.textContent.includes(${JSON.stringify(label)})).querySelector('input').click()`)
  await tick('Choices wait for me')
  await page.screenshot('accessibility')
  await page.press('Escape')
  await pause(2000)
  page.check('choices wait for a player who asked them to', [await shownStep(page), await page.evaluate(`!!document.querySelector('.viewport .time-left')`)], ['CHOICE', false])
  await page.evaluate(`document.querySelector('.viewport .option').click()`)
  await pause(800)
  page.check('and the option picked is taken', await shownStep(page), 'You spoke.')

  const textBox = () => page.evaluate(`(() => {
    const text = document.querySelector('.viewport .textbox .text')
    const style = getComputedStyle(text)
    return { height: text.getBoundingClientRect().height, fontFamily: style.fontFamily, background: getComputedStyle(document.querySelector('.viewport .textbox')).backgroundColor }
  })()`)
  const before = await textBox()
  await page.press('o')
  await page.evaluate(`[...document.querySelectorAll('.overlay .category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
  await pause(100)
  await page.evaluate(`[...document.querySelectorAll('.overlay .choice-button')].find(button => button.textContent.trim() === '150 %').click()`)
  await tick('plainer, more readable font')
  await tick('Stronger contrast')
  await tick('Read the pages')
  await page.press('Escape')
  await pause(300)
  const after = await textBox()
  page.check('larger text makes the box taller, in a plainer font, on a black ground', [after.height > before.height * 1.4, after.fontFamily.startsWith('Verdana'), after.background], [true, true, 'rgb(0, 0, 0)'])
  await page.press(' ')
  await pause(600)
  page.check('pages are read aloud', await page.evaluate(`window.spoken.at(-1)`), 'The end.')
  await page.screenshot('larger-text')
}
