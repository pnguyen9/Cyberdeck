// Definitions and the Index: decisions and styles declared above the chapters live in Definitions,
// those written in a chapter stay there as cards; moving one, editing the project's own, and the
// Index of every decision and memory with what looks forgotten, reached from "In this view" too.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `[import: story]
[decision: Route = Marie | Jules]
[style: Whisper = italic, grey]
# Chapter 1
[decision multi: Clues = Letter | Key]
[choice: Answer]
> Yes = Yes
> No = No
[if: Route is Marie and Answer is Yes]
— Marie: [style: whisper]Come.[style: none]
[end]
[set: Clues = Letter]
[remember: The letter]
# Chapter 2
[if: Clues is Key]
A key.
[end]
[ending: Gone]`

/** An element's text, its parts apart: Vue leaves no space between elements. */
const TEXT_OF = `element => [...element.childNodes].map(child => child.textContent.replace(/\\s+/g, ' ').trim()).filter(part => part !== '').join(' ')`

export default async function check(page, { url }) {
  const field = () => page.evaluate(`document.querySelector('.definitions .tag-editor .field').value`)
  await createProjectWithStory(page, url, 'Definitions', STORY)

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions')
  page.check('the definitions above the chapters are here', await field(), '[decision: Route = Marie | Jules]\n[style: Whisper = italic, grey]')
  page.check('one declared in a chapter is listed with its place', await page.evaluate(`[...document.querySelectorAll('.entries')[0].querySelectorAll('.entry')].map(${TEXT_OF})`), ['Clues (several): Letter | Key Chapter 1 · at the start ShowUsesMove to Definitions'])
  page.check('a decision made by its choice is told apart', await page.evaluate(`document.querySelectorAll('.entries')[1]?.textContent.includes('Answer: Yes | No')`), true)
  await page.screenshot('definitions')

  await page.clickButton('Show', '.entry-actions .link-button')
  await page.waitFor('.grid')
  await pause(400)
  page.check('Show opens the storyboard on the definition, a card of its chapter', await page.evaluate(`(${TEXT_OF})(document.querySelector('.grid .element.focused'))`), '◇ Clues (several): Letter | Key')
  await page.press('Enter')
  await pause(300)
  await page.evaluate(`(() => { const field = document.querySelector('.tag-editor .field'); field.value = '[decision multi: Clues = Letter]'; field.dispatchEvent(new Event('input')) })()`)
  await pause(300)
  page.check('a value still used elsewhere cannot go', await page.evaluate(`document.querySelector('.inspector .problems li')?.textContent`), '"Key" is still used elsewhere as a value of Clues: keep it in the list, or change those places first (the Index shows them).')
  await page.press('Escape')
  await pause(200)
  await page.clickButton('Discard', '.pending .button')
  await pause(200)

  page.check('"In this view" lists the decisions and memories of the cards shown', await page.evaluate(`[...document.querySelectorAll('.in-view li')].map(${TEXT_OF})`), [
    'Route tested Marie',
    'Clues declared · given Letter',
    'Answer given Yes, No · tested Yes',
    'The letter memory · remembered',
  ])
  await page.screenshot('in-view')
  await page.evaluate(`[...document.querySelectorAll('.in-view .name-link')].find(link => link.textContent === 'Clues').click()`)
  await page.waitFor('.index')
  await pause(400)
  page.check('a name there opens in the Index, with every place', await page.evaluate(`[...document.querySelectorAll('.name-entry.open .uses li')].map(${TEXT_OF})`), [
    'Chapter 1 · at the start declared',
    'Chapter 1 · after 2a given Letter by [set]',
    'Chapter 2 · at the start tested Key',
  ])
  page.check('what looks forgotten is listed first', await page.evaluate(`[...document.querySelectorAll('.warnings li')].map(item => item.className + ' ' + (${TEXT_OF})(item))`), [
    'warning Decision Route tested, but no choice or [set] gives it a value: those conditions never hold.',
    'warning Decision Clues Key is tested, but no choice or [set] gives it: those conditions never hold.',
    'notice Memory The letter remembered, but never tested.',
  ])
  await page.screenshot('index')

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions')
  await page.clickButton('Move to Definitions', '.entry-actions .link-button')
  await pause(400)
  page.check('moved, it joins the text here', (await field()).includes('[decision multi: Clues = Letter | Key]'), true)
  await page.evaluate(`(() => { const field = document.querySelector('.definitions .tag-editor .field'); field.value += '\\n[decision: Mood = Calm | Angry]'; field.dispatchEvent(new Event('input')) })()`)
  await pause(300)
  await page.clickButton('Index', '.tab')
  await pause(300)
  page.check('leaving with changes asks first', await page.evaluate(`document.querySelector('.pending p')?.textContent`), 'Your changes to the definitions are not saved.')
  await page.clickButton('Save', '.pending .button')
  await page.waitFor('.index')
  await pause(300)
  page.check('saved, a new decision is in the Index, used nowhere yet', await page.evaluate(`[...document.querySelectorAll('.warnings li')].some(item => item.textContent.includes('Mood') && item.textContent.includes('declared, but nothing gives it a value or tests it.'))`), true)
}
