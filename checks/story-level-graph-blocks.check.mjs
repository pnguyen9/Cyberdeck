// What 1.4 adds to the editor: the story as the storyboard's first level, a route's condition
// written once for its chapters; blocks made and edited from the storyboard; stepping into a tag with
// the keyboard; the graph of the whole story and what it adds; the Index found by a value; the
// preview's state of the story.
import { createProjectWithStory, focusStoryCard, pause } from './harness.mjs'

const STORY = `# Prologue
[choice: Pairing]
> Marie = Marie
> Jules = Jules
[counter: Trust]
[add: Trust 2]
# Marie, one
Marie waits.
# Marie, two
Marie smiles.
# Epilogue
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Routes', STORY)
  await page.waitFor('.story-level')
  page.check('an import lands on the story, its chapters as cards', await page.evaluate(`[...document.querySelectorAll('.story-level .chapter .title')].map(title => title.textContent)`), ['Prologue', 'Marie, one', 'Marie, two', 'Epilogue'])

  // A route: two chapters under one condition, written once.
  await focusStoryCard(page, 'Marie, one')
  await page.setValue('.story-level .condition input', 'Pairing is Marie')
  await pause(300)
  await page.clickButton('Apply to this chapter', '.story-level .condition .button')
  await pause(400)
  await focusStoryCard(page, 'Marie, two')
  await page.setValue('.story-level .condition input', 'Pairing is Marie')
  await pause(300)
  await page.clickButton('Apply to this chapter', '.story-level .condition .button')
  await pause(400)
  page.check('chapters following one another under one condition form a route', await page.evaluate(`[...document.querySelectorAll('.story-level .route')].map(route => [route.querySelector('.route-heading')?.textContent.trim() ?? '—', route.querySelectorAll('.card').length].join(' '))`), ['— 1', 'Played only if Pairing is Marie 2', '— 1'])
  await page.setValue('.story-level .condition input', 'Pairing is Jules')
  await pause(300)
  await page.clickButton('Apply to its route, 2 chapters', '.story-level .condition .button')
  await pause(500)
  page.check('and the route\'s condition changes for all its chapters at once', await page.evaluate(`document.querySelector('.story-level .route-heading')?.textContent.trim()`), 'Played only if Pairing is Jules')
  await page.screenshot('story')

  // A chapter removed from the keyboard, and put back.
  const titles = `[...document.querySelectorAll('.story-level .chapter:not(.scene) .title')].map(title => title.textContent)`
  await focusStoryCard(page, 'Epilogue')
  await page.press('Delete')
  await pause(200)
  page.check('removing an imported chapter says its text is not touched', await page.evaluate(`document.querySelector('.story-level .confirmation p').textContent.includes('The text you imported it from is not touched.')`), true)
  await page.clickButton('Remove', '.story-level .confirmation .button')
  await pause(500)
  page.check('removing a chapter says how to put it back', await page.evaluate(`document.querySelector('.message[role=status]')?.textContent.includes('Ctrl+Z puts it back')`), true)
  await page.evaluate(`document.querySelector('.story-board').focus()`)
  await page.press('z', { ctrl: true })
  await pause(500)
  page.check('and Ctrl+Z on the story puts it back', await page.evaluate(titles), ['Prologue', 'Marie, one', 'Marie, two', 'Epilogue'])

  // Into a chapter, a new block, then its own text edited from the keyboard.
  await focusStoryCard(page, 'Epilogue')
  await page.press('Enter')
  await page.waitFor('.grid')
  await pause(300)
  await page.evaluate(`document.querySelector('.grid').closest('.board')?.focus() ?? document.querySelector('.board').focus()`)
  await page.press('b')
  await pause(400)
  page.check('a new block opens as text to complete', await page.evaluate(`document.querySelector('.edit textarea')?.value`), '[if: ]\n\n[else]\n\n[end]')
  await page.evaluate(`document.querySelector('.edit textarea').focus()`)
  await page.setValue('.edit textarea', '[if: Trust >= 2]\nTrusted.\n[else]\nNot yet.\n[end]')
  await pause(400)
  await page.press('Enter', { ctrl: true })
  await pause(600)
  await page.press('Escape')
  await page.evaluate(`[...document.querySelectorAll('.grid .element')].find(element => element.classList.contains('block'))?.click()`)
  await pause(200)
  await page.press('e')
  await pause(400)
  page.check('E edits a block\'s own text, conditions and branches', (await page.evaluate(`document.querySelector('.edit textarea')?.value`))?.startsWith('[if: Trust >= 2]\nTrusted.\n[else]'), true)

  // Beside a tag, Alt+← steps into it.
  await page.evaluate(`(() => { const field = document.querySelector('.edit textarea'); field.focus(); field.setSelectionRange(16, 16); field.dispatchEvent(new KeyboardEvent('keyup')) })()`)
  await pause(200)
  page.check('a line says how to step into a tag', await page.evaluate(`document.querySelector('.tag-hint')?.textContent.trim()`), 'A tag is one piece: Alt+← steps into it to change what it says.')
  await page.press('ArrowLeft', { alt: true })
  await pause(100)
  page.check('and Alt+← puts the caret at the end of what it says', await page.evaluate(`document.querySelector('.edit textarea').selectionStart`), 15)
  await page.press('Escape')
  await pause(300)

  // The graph of the whole story, and an option added from it.
  await page.clickButton('Graph', '.view-switch .button')
  await page.waitFor('.graph-view')
  await pause(400)
  page.check('the graph draws every chapter, the fork and its branches', await page.evaluate(`[...document.querySelectorAll('.graph .box')].filter(box => ['chapter', 'fork', 'branch', 'choice'].some(kind => box.classList.contains(kind))).map(box => box.querySelector('.label').textContent)`), [
    'Prologue', 'Choice: Pairing', 'Marie, one', 'Marie, two', 'Epilogue', 'if Trust >= 2', 'if Trust >= 2', 'else',
  ])
  await page.screenshot('graph')
  page.check('the graph says which keys work on it', await page.evaluate(`document.querySelector('.toolbar .keys').textContent.trim()`), 'Tab goes from box to box, Enter selects one and moves to its panel, Esc goes back to the box; the arrows move the map, + and − zoom.')
  await page.evaluate(`document.querySelector('.graph .box.choice').focus()`)
  await page.press('Enter')
  await pause(200)
  page.check('a box reached with the keyboard is selected with Enter', await page.evaluate(`document.querySelector('.graph-panel h3')?.textContent`), 'Choice: Pairing')
  page.check('and Enter moves to its panel', await page.evaluate(`document.activeElement?.textContent.trim()`), 'Open in the grid')
  await page.press('Escape')
  await pause(100)
  page.check('from which Esc comes back to the box', await page.evaluate(`document.activeElement?.classList.contains('choice')`), true)
  await page.evaluate(`document.querySelector('.graph-viewport').scrollIntoView({ block: 'start' })`)
  await page.clickAt('.graph .box.chapter rect')
  await pause(200)
  page.check('a click on a box selects it too', await page.evaluate(`document.querySelector('.graph-panel h3')?.textContent`), 'Prologue')
  await page.evaluate(`document.querySelector('.graph .box.choice').focus()`)
  await page.press('Enter')
  await pause(200)
  await page.clickButton('Add an option', '.graph-panel .button')
  await pause(500)
  page.check('adding an option opens the choice with a new line for it', (await page.evaluate(`document.querySelector('.edit textarea')?.value`))?.endsWith('\n> '), true)
  await page.press('Escape')
  await pause(300)

  await page.clickButton('Index', '.tab')
  await page.waitFor('.index')
  await page.setValue('.index .filter input', 'Jule')
  await pause(300)
  page.check('the Index finds a decision by one of its values', await page.evaluate(`[...document.querySelectorAll('.name-title')].map(title => title.textContent.trim())`), ['Pairing · value Jules'])
  await page.screenshot('index')

  // The preview's state of the story.
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await pause(800)
  await page.evaluate(`[...document.querySelectorAll('.viewport .quick-button')].find(button => button.textContent.trim() === 'State').click()`)
  await pause(300)
  page.check('the preview shows the state of the story beside the stage', await page.evaluate(`[...document.querySelectorAll('.state-panel dt')].map(term => term.textContent + '=' + term.nextElementSibling.textContent)`), ['Pairing=none', 'Trust=0'])
  await page.screenshot('state')
}
