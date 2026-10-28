// Exporting as text: a chapter edited as text replaces itself; the whole story imports as a new
// project that exports to the same text.
import { createProject, createProjectWithSample, pause } from './harness.mjs'

export default async function check(page, { url }) {
  const lastDownload = `[...document.querySelectorAll('.download')].at(-1)`
  const downloadedText = () => page.evaluate(`fetch(${lastDownload}.href).then(response => response.text())`)
  const chapterTitles = () => page.evaluate(`[...document.querySelectorAll('.chapter .title')].map(title => title.textContent).join(' | ')`)
  const exportStoryText = async () => {
    await page.clickButton('Export', '.tab')
    await pause(300)
    await page.clickButton('Export the story as text', '.button')
    await pause(300)
  }

  await createProjectWithSample(page, url, 'Letters')
  await page.watchViolations()
  await page.clickButton('Export as text', '.link-button')
  await pause(400)
  page.check('a chapter is offered as a text file', await page.evaluate(`${lastDownload}?.getAttribute('download')`), 'Chapter 1 — The Letter.txt')
  const chapterText = await downloadedText()
  page.check('the text starts as written', chapterText.replace('﻿', '').startsWith('[import: chapter]\n# Chapter 1 — The Letter\n'), true)
  page.check('the file is marked UTF-8 for Word', await page.evaluate(`fetch(${lastDownload}.href).then(response => response.arrayBuffer()).then(buffer => [...new Uint8Array(buffer).slice(0, 3)].join())`), '239,187,191')
  page.check('directives are written in the syntax', chapterText.includes('[enter: Jules slide-from-right 0.8s wait]'), true)

  await page.clickButton('Import', '.tab')
  await pause(300)
  await page.setValue('.source', chapterText.replace('﻿', '').replace('Marie: You came after all.', 'Marie: You came, after all this time.'))
  await pause(500)
  page.check('a chapter titled like one replaces it by default', await page.evaluate(`document.querySelector('.destination select').value`), 'replaceChapter')
  page.check('its labels are not taken for duplicates', await page.evaluate(`document.querySelectorAll('.problems li.error').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  page.check('replacing is reported', /^Chapter 1 — The Letter was replaced by the text imported: \d+ pages\.$/.test(await page.statusText() ?? ''), true)
  page.check('the chapter keeps its place, alone', await chapterTitles(), 'Chapter 1 — The Letter')
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  page.check('the edit is in the storyboard', await page.evaluate(`[...document.querySelectorAll('.grid .element.card .text')].some(text => text.textContent === 'You came, after all this time.')`), true)

  await exportStoryText()
  page.check('the whole story is offered as text', await page.evaluate(`${lastDownload}?.getAttribute('download')`), 'Letters.txt')
  const storyText = await downloadedText()
  page.check('a decision made by its choice is not declared: the choice makes it again', [storyText.includes('[decision: Answer'), storyText.includes('[choice: Answer]')], [false, true])
  page.check('no content security violation', await page.violations(), '[]')

  await createProject(page, url, 'Letters again')
  await page.setValue('.source', storyText.replace('﻿', ''))
  await pause(500)
  page.check('the story text imports without an error', await page.evaluate(`document.querySelectorAll('.problems li.error').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  page.check('into the same chapters', await chapterTitles(), 'Chapter 1 — The Letter')
  await exportStoryText()
  page.check('exporting it again gives the same text', await downloadedText() === storyText, true)
}
