// Both applications in French: Cyberdeck once its language is chosen, the editor's own words around
// the story syntax, which stays as written; then Datajack, its screens in the player's language and
// the game's own words in the story's.
import { createProfile, exportGame, installGame, pause, shownStep } from './harness.mjs'

const STORY = `# Chapitre 1
[decision multi: Indices = Lettre | Clé]
[loop]
[choice: Lieu]
> La bibliothèque = Bibliothèque
> Rentrer = Maison
[if: Lieu is Maison]
[break]
[end]
[end]
— Marie : Bonne nuit.
[ending: Seule]`

export default async function check(page, { url, serve }) {
  const choose = (selector, value) => page.evaluate(`(() => {
    const select = document.querySelector(${JSON.stringify(selector)})
    select.value = ${JSON.stringify(value)}
    select.dispatchEvent(new Event('change'))
    return true
  })()`)
  const tabs = () => page.evaluate(`[...document.querySelectorAll('.tab')].map(tab => tab.textContent.trim())`)

  // A story written in French: its own words, on its end screen, are French.
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await choose('.new-project select', 'fr')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Nuit')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  await choose('.language-select', 'fr')
  await pause(300)
  page.check('Cyberdeck speaks French once chosen, and keeps the choice', [await tabs(), await page.evaluate(`[document.documentElement.lang, localStorage.getItem('cyberdeck:language')]`)], [
    ['Chapitres', 'Storyboard', 'Import', 'Personnages et fichiers', 'Définitions', 'Index', 'Détails', 'Export'],
    ['fr', 'fr'],
  ])

  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await pause(300)
  page.check('the storyboard says its own words in French, the syntax as written', await page.evaluate(`[...document.querySelectorAll('.grid .element')].map(element => element.textContent.replace(/\\s+/g, ' ').trim()).find(text => text.startsWith('◇'))`), '◇ Indices (plusieurs) : Lettre | Clé')
  await page.screenshot('storyboard')

  await page.clickButton('Index', '.tab')
  await page.waitFor('.index')
  await pause(300)
  page.check('places are named in French', await page.evaluate(`[...document.querySelectorAll('.name-header')].map(header => header.textContent.replace(/\\s+/g, ' ').trim()).find(text => text.startsWith('Indices'))?.includes('Chapitre 1 · au début')`), true)
  await page.screenshot('index')

  // The export helper presses the English buttons.
  await choose('.language-select', 'en')
  await pause(300)
  const archive = await exportGame(page, 'nuit.zip')
  await createProfile(page, await serve('datajack'), 'Alex')
  await choose('.language-select', 'fr')
  await pause(300)
  await installGame(page, archive)
  page.check('Datajack speaks French once chosen', await page.evaluate(`document.querySelector('.game .button.primary')?.textContent.trim()`), 'Jouer')
  await page.evaluate(`document.querySelector('.game .button.primary').click()`)
  await page.waitFor('.viewport')
  await pause(600)
  page.check("the game's menu too", await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].map(button => button.textContent.trim()).slice(1, 3)`), ['Historique', 'Sauvegarder'])
  for (let press = 0; press < 12 && await page.evaluate(`!document.querySelector('.viewport .option')`); press++) {
    await page.press(' ')
    await pause(150)
  }
  await pause(500)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes('Rentrer')).click()`)
  for (let press = 0; press < 12 && await page.evaluate(`!document.querySelector('.viewport .end-screen')`); press++) {
    await page.press(' ')
    await pause(150)
  }
  await pause(400)
  page.check("the end screen says the game's words, in its language", (await shownStep(page))?.startsWith('Seule'), true)
  page.check('and how many endings were reached', await page.evaluate(`document.querySelector('.viewport .endings-count')?.textContent.trim()`), 'Fins atteintes : 1 sur 1')
  await page.screenshot('ending')
}
