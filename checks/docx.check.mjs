// Importing a Word document made by a word processor: chapters, dialogue from list items, runs joined.
// fixtures/story.docx is fixtures/story.html saved by LibreOffice: `soffice --headless --convert-to docx story.html`.
import { pause } from './harness.mjs'

export default async function check(page, { url, fixtures }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('From Word')
  await page.clickButton('Create')
  await page.waitFor('.import .file-button input[type=file]')
  await page.setFiles('.import .file-button input[type=file]', [`${fixtures}/story.docx`])
  await pause(1200)
  const text = await page.evaluate(`document.querySelector('.source').value`)
  page.check('the document is shown as text', text.startsWith('# Chapter 1 — The Letter\n'), true)
  page.check('list items get their bullet back', text.includes('• Marie: You came after all.'), true)
  page.check('runs are joined', text.includes('The classroom was empty, and the dust floated in the light.'), true)
  page.check('it says to check before importing', await page.statusText(), 'story.docx is shown as text: check it, then import it.')
  page.check('the import sees two chapters', (await page.evaluate(`[...document.querySelectorAll('.import p.muted')].map(paragraph => paragraph.textContent).join()`))?.includes('2 chapters (Chapter 1 — The Letter, Chapter 2 — Rooftop)'), true)
  page.check('without a problem', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  page.check('the chapters are imported', await page.evaluate(`[...document.querySelectorAll('.chapter .title')].map(title => title.textContent).join(' | ')`), 'Chapter 1 — The Letter | Chapter 2 — Rooftop')
  page.check('they say where they came from', (await page.evaluate(`document.querySelector('.chapter .details')?.textContent`))?.includes('Imported from story.docx'), true)
  await page.clickButton('Storyboard', '.tab')
  await pause(500)
  page.check('the list items are dialogue', await page.evaluate(`[...document.querySelectorAll('.element.card .speaker')].map(speaker => speaker.textContent).join(', ')`), 'Marie, Theo, Marie')
}
