// The screenshots of the guide (docs/guide/): the sample story made into a game, from the projects
// page to Datajack's library. `npm run guide:images` runs it and copies the screenshots into the guide;
// `npm run checks` runs it too, leaving the guide as it is.
import { readdirSync } from 'node:fs'
import { advanceUntil, createProfile, createProject, exportGame, installGame, pause, shownStep } from './harness.mjs'

const HUB = `# Chapter 2 — The Fair
[style: Whisper = italic, small, grey]
[decision multi: Visited = Wheel | Stand]
[loop]
[choice: Where]
> The big wheel = Wheel [if: Visited is not Wheel]
> The candy stand = Stand [if: Visited is not Stand]
> Go home = Home
[if: Where is Wheel]
[set: Visited = Wheel]
From the top of the wheel, the whole city shone.
[else if: Where is Stand]
[set: Visited = Stand]
The candy floss stuck to her fingers.
[else]
[break]
[end]
[end]
— Marie: [style: whisper]Thank you for tonight.[style: none]
[ending: A Good Night]`

export default async function check(page, { url, assets, serve }) {
  /** Scrolls the page so that the element's bottom is at the bottom of the window. */
  const scrollTo = async selector => {
    await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'end' })`)
    await pause(200)
  }
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('The Letter')
  await page.screenshot('projects')

  await createProject(page, url, 'The Letter')
  await page.clickButton('Use the sample story')
  await pause(600)
  await scrollTo('.import-actions')
  await page.screenshot('import')
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await page.screenshot('chapters')

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
  await pause(1000)
  await page.screenshot('cast')

  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await pause(300)
  await scrollTo('.board')
  await page.screenshot('storyboard')
  await page.evaluate(`[...document.querySelectorAll('.grid .lane > .elements > .element.card')][2].click()`)
  await pause(200)
  await page.press('Enter')
  await pause(300)
  await page.evaluate(`(() => { const field = document.querySelector('.tag-editor .field'); field.focus(); field.setSelectionRange(field.value.length, field.value.length); field.dispatchEvent(new Event('click')); return true })()`)
  await page.typeText(' [Ma')
  await pause(300)
  await page.screenshot('page-edit')
  await page.press('Escape')
  await page.press('Escape')
  await pause(200)
  await page.clickButton('Discard', '.pending .button')
  await pause(200)
  await page.evaluate(`document.querySelector('.grid .element.block')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
  await pause(300)
  await page.screenshot('block')

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  await advanceUntil(page, step => step.startsWith('You came'))
  await page.press(' ')
  await pause(1200)
  await page.screenshot('preview')
  await advanceUntil(page, step => step === 'CHOICE')
  await pause(600)
  await page.screenshot('choice')
  await page.press('o')
  await pause(300)
  await page.screenshot('settings')
  await page.evaluate(`[...document.querySelectorAll('.overlay .category-button')].find(button => button.textContent.trim() === 'Accessibility').click()`)
  await pause(200)
  await page.screenshot('accessibility')
  await page.press('Escape')
  await page.press('Escape')
  await pause(400)

  await page.clickButton('Import', '.tab')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(HUB.replace('[set: Visited = Stand]', '[set: Visted = Stand]'))
  await pause(800)
  await scrollTo('.import-actions')
  await page.screenshot('problems')
  await page.setValue('.import .source', HUB)
  await pause(800)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  // The chapter of the fair, its loop holding three branches, in each view.
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.board')
  await page.evaluate(`(() => {
    const picker = document.querySelector('.chapter-picker select')
    picker.value = [...picker.options].find(option => option.textContent.includes('The Fair')).value
    picker.dispatchEvent(new Event('change'))
  })()`)
  await pause(400)
  await scrollTo('.board')
  await page.screenshot('fair-grid')
  await page.clickButton('Tree', '.view-switch .button')
  await page.waitFor('.board.tree')
  await pause(300)
  await scrollTo('.board')
  await page.screenshot('tree')
  await page.clickButton('Grid', '.view-switch .button')

  // Definitions with a style for title cards, which are turned on; the Index; a title card.
  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions .tag-editor .field')
  await page.evaluate(`(() => {
    const field = document.querySelector('.definitions .tag-editor .field')
    field.value = (field.value === '' ? '' : field.value + '\\n') + '[style: Chapter title = gold, large, fade-in]'
    field.dispatchEvent(new Event('input'))
  })()`)
  await pause(300)
  await page.clickButton('Save', '.definitions .actions .button')
  await pause(300)
  await page.evaluate(`document.querySelector('.definitions .check input').click()`)
  await pause(300)
  await page.evaluate(`window.scrollTo(0, 0)`)
  await page.screenshot('definitions')
  await page.clickButton('Index', '.tab')
  await page.waitFor('.index')
  await pause(300)
  await page.evaluate(`[...document.querySelectorAll('.name-header')].find(header => header.textContent.includes('Visited'))?.click()`)
  await pause(300)
  await page.screenshot('index')
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .title-card')
  await pause(900)
  await page.screenshot('title-card')
  await page.press('Escape')
  await pause(400)

  await page.clickButton('Details', '.tab')
  await page.waitFor('.cover-actions input[type=file]')
  await page.setFiles('.cover-actions input[type=file]', [`${assets}/Rooftop.svg`])
  await pause(800)
  await page.clickButton('Export', '.tab')
  await pause(300)
  await page.screenshot('export')
  const archive = await exportGame(page, 'The Letter 1.0.zip')

  await createProfile(page, await serve('datajack'), 'Alex')
  await installGame(page, archive)
  await page.screenshot('library')
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  await advanceUntil(page, step => step === 'CHOICE')
  await pause(800)
  await page.evaluate(`document.querySelector('.viewport .option').click()`)
  await pause(300)
  await advanceUntil(page, step => step.startsWith('The wind'))
  await page.press('l')
  await pause(400)
  await page.screenshot('log')
  page.check('the screenshots of the guide are taken', await shownStep(page) !== null, true)
}
