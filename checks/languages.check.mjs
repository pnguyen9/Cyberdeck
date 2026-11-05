// A story in two languages: written in English, a French text laid over it, chapters matched by their
// place and the one not translated yet hollow; the language shown switched in the editor; the game
// exported with both once complete, then played in French in Datajack, its ending named in French.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, showStory, shownStep } from './harness.mjs'

const ENGLISH = `[import: story en]
# The Letter
The classroom was empty.
# The Roof
The wind was cold.
[ending: The Empty Room]`

const FRENCH = `[import: story fr]
# La Lettre
La salle était vide.`

const FRENCH_ROOF = `[import: chapter fr]
# Le Toit
Le vent était froid.
[ending: The Empty Room = La Chambre vide]`

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Letter', ENGLISH)
  const cards = () => page.evaluate(`[...document.querySelectorAll('.story-level .card.chapter')].map(card => card.querySelector('.title').textContent + (card.classList.contains('hollow') ? ' (hollow)' : ''))`)
  await showStory(page)
  page.check('the story is in English', await cards(), ['The Letter', 'The Roof'])

  // A French text, imported as the Import tab says it is: its chapter takes the first place.
  await page.clickButton('Import', '.tab')
  await page.waitFor('.import .source')
  await page.setValue('.import .source', FRENCH)
  await pause(600)
  page.check('the text says its own language', await page.evaluate(`[...document.querySelectorAll('.said-language > span')].map(span => span.textContent.replace(/\\s+/g, ' ').trim())`), ['Language of the text', 'French — français (fr) · as its first line says'])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await showStory(page)
  page.check('the story is now shown in French, the roof hollow, its English title standing in', await cards(), ['La Lettre', 'The Roof (hollow)'])
  page.check('and the header says which language is shown', await page.evaluate(`document.querySelector('.story-language .button.primary')?.textContent.trim()`), 'French')
  page.check('and that the story is now shown in it', (await page.statusText()).endsWith('The story is now shown in French.'), true)
  await page.screenshot('french')

  // Exporting: French cannot go while a chapter is hollow in it.
  await page.clickButton('Export', '.tab')
  await page.waitFor('.export')
  page.check('the Export tab says which chapter French still lacks', await page.evaluate(`[...document.querySelectorAll('.export .chapter')].map(label => label.textContent.replace(/\\s+/g, ' ').trim()).filter(text => text.includes('français'))`), ['French — français (fr) · not written yet in it: The Roof. Translate it, or untick it above, for this language to go'])

  await page.clickButton('Import', '.tab')
  await page.waitFor('.import .source')
  await page.setValue('.import .source', FRENCH_ROOF)
  await pause(600)
  await page.evaluate(`(() => { const select = [...document.querySelectorAll('.destination select')][0]; select.value = 'replaceChapter'; select.dispatchEvent(new Event('change')) })()`)
  await pause(200)
  await page.evaluate(`(() => { const select = [...document.querySelectorAll('.destination select')][1]; select.value = [...select.options].find(option => option.textContent === 'The Roof').value; select.dispatchEvent(new Event('change')) })()`)
  await pause(400)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
  await showStory(page)
  page.check('the roof translated in its place', await cards(), ['La Lettre', 'Le Toit'])

  // Back to English: nothing of French shows.
  await page.clickButton('English', '.story-language .button')
  await pause(600)
  page.check('switching back shows the English chapters as they were', await cards(), ['The Letter', 'The Roof'])

  // A language added from the header, every chapter waiting for its text, then taken out again.
  await page.clickButton('Add a language…', '.story-language .link-button')
  await pause(300)
  page.check('adding a language opens a field to pick it, ready to type in', await page.evaluate(`document.activeElement?.closest('.add-language') !== null`), true)
  await page.typeText('Spanish — español (es)')
  await pause(200)
  await page.clickButton('Add this language', '.add-language .button')
  await pause(600)
  page.check('the story is shown in it, every chapter hollow', [await page.evaluate(`document.querySelector('.story-language .button.primary')?.textContent.trim()`), await cards()], ['Spanish', ['The Letter (hollow)', 'The Roof (hollow)']])
  await page.clickButton('Remove this language', '.story-language .link-button')
  await pause(600)
  page.check('a language with no text yet can be taken out again', await page.evaluate(`[...document.querySelectorAll('.story-language .button')].map(button => button.textContent.trim())`), ['English', 'French'])

  const archive = await exportGame(page, 'letter.zip')

  await createProfile(page, await serve('datajack'), 'Pascal')
  await installGame(page, archive)
  page.check('the library offers both languages', await page.evaluate(`[...document.querySelectorAll('.story-language option')].map(option => option.textContent)`), ['English', 'français'])
  await page.evaluate(`(() => { const select = document.querySelector('.story-language select'); select.value = 'fr'; select.dispatchEvent(new Event('change')) })()`)
  await pause(200)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('the game plays in French', await shownStep(page), 'La salle était vide.')
  for (let press = 0; press < 3; press++) {
    await page.press(' ')
    await pause(500)
  }
  page.check('its ending named in French', (await shownStep(page)).includes('La Chambre vide'), true)
}
