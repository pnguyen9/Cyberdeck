// Editing in the storyboard: a page opened as its text, saved and undone; new pages, their problems
// listed as they are typed, their page count, and a new speaker becoming a character.
import { createProjectWithSample, pause } from './harness.mjs'

export default async function check(page, { url }) {
  const cardSelector = '.grid .lane > .elements > .element.card'
  const typeInEditor = text => page.evaluate(`(() => { const editor = document.querySelector('.tag-editor .field'); editor.value = ${JSON.stringify(text)}; editor.dispatchEvent(new Event('input')); editor.focus(); return true })()`)
  const cardTexts = () => page.evaluate(`[...document.querySelectorAll(${JSON.stringify(cardSelector)})].map(card => card.querySelector('.number').textContent + ' ' + (card.querySelector('.speaker')?.textContent ?? '') + '|' + (card.querySelector('.text')?.textContent ?? 'choice'))`)
  const openStoryboard = async () => {
    await page.clickButton('Storyboard', '.tab')
    await page.waitFor('.grid')
  }

  await createProjectWithSample(page, url, 'Edits')
  await openStoryboard()
  await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(cardSelector)})][2].click()`)
  await pause(200)
  await page.press('Enter')
  await pause(200)
  page.check('Enter opens the page as its text, the directives above it included', await page.evaluate(`document.querySelector('.tag-editor .field')?.value`), '[enter: Marie]\n— Marie: You came after all.')
  await page.screenshot('editing')
  await typeInEditor('[enter: Marie]\n— Marie: You came, at last. [marie: smile]')
  await pause(300)
  await page.press('Enter', { ctrl: true })
  await pause(400)
  page.check('saving shows the new text in the same place', (await cardTexts())[2], '3 Marie|You came, at last.')
  page.check('and says how to undo', (await page.statusText())?.startsWith('Saved. Ctrl+Z'), true)
  await page.press('z', { ctrl: true })
  page.check('Ctrl+Z puts the old text back', (await cardTexts())[2], '3 Marie|You came after all.')

  await page.press('n')
  await pause(200)
  page.check('N opens a new page after the focused card', await page.evaluate(`document.querySelector('.edit h3')?.textContent`), 'New pages')
  await typeInEditor('[if: Mood is Sad]\nHm.\n[end]')
  await pause(300)
  page.check('problems are listed as they are typed', (await page.evaluate(`document.querySelector('.edit .problems li')?.textContent`))?.length > 0, true)
  page.check('and saving waits for them', await page.evaluate(`[...document.querySelectorAll('.edit .button')].find(button => button.textContent.startsWith('Save')).disabled`), true)
  await typeInEditor('The wind did not stop. It never stops up here, and nobody ever came to see why that might be. '.repeat(3).trim())
  await pause(300)
  page.check('a long text says how many pages it becomes', /^Becomes [2-9] pages\.$/.test(await page.evaluate(`document.querySelector('.edit p.muted')?.textContent`) ?? ''), true)
  await typeInEditor("— ???: Who's there?")
  await pause(300)
  await page.press('Enter', { ctrl: true })
  await pause(400)
  const afterAdding = await cardTexts()
  page.check('the new page comes right after, spoken by ???', afterAdding[3], "4 ???|Who's there?")
  page.check('the next cards are numbered on', afterAdding[4]?.startsWith('5 '), true)
  page.check('the new page is selected', await page.evaluate(`document.querySelector('.grid .element.selected .text')?.textContent`), "Who's there?")

  await page.press('Escape')
  await page.reload()
  await page.waitFor('.open-project')
  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(800)
  await openStoryboard()
  page.check('the new page is kept after a reload', (await cardTexts())[3], "4 ???|Who's there?")
  await page.clickButton('Cast & files', '.tab')
  await pause(400)
  page.check('??? is a character like the others', await page.evaluate(`[...document.querySelectorAll('.group-name')].map(name => name.childNodes[0].textContent.trim()).join(', ')`), 'Marie, Theo, Jules, ???')
}
