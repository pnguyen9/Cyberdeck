// The shortcuts panel: opened with ?, listed by screen, keys changed, conflicts confirmed, the
// storyboard answering to the new keys, kept after a reload, and reset.
import { createProjectWithSample, pause } from './harness.mjs'

const ADD_PAGE = 'Add a page after'
const EDIT = 'Edit the card, or open the block'

export default async function check(page, { url }) {
  const hint = () => page.evaluate(`document.querySelector('p.keys')?.innerText`)
  const row = label => `[...document.querySelectorAll('.dialog .row')].find(row => row.firstElementChild.textContent === ${JSON.stringify(label)})`
  const rowKeys = label => page.evaluate(`${row(label)}?.querySelector('.keys-button').textContent.trim()`)
  const clickRow = async label => {
    await page.evaluate(`${row(label)}.querySelector('.keys-button').click()`)
    await pause(200)
  }
  const focusFirstCard = async () => {
    await page.evaluate(`document.querySelector('.grid .element.card').click()`)
    await pause(200)
  }

  await createProjectWithSample(page, url, 'Keys')
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  await focusFirstCard()

  await page.press('?')
  await pause(300)
  page.check('? opens the shortcuts', await page.evaluate(`document.querySelector('.dialog h2')?.textContent`), 'Keyboard shortcuts')
  page.check('listed by screen', await page.evaluate(`[...document.querySelectorAll('.dialog h3')].map(title => title.textContent).join(', ')`), 'Storyboard, Editing a page, Everywhere')
  page.check('with their keys', await rowKeys('Move the selection back'), 'Ctrl+Shift+←')
  await page.screenshot('shortcuts')

  await clickRow(ADD_PAGE)
  page.check('clicking keys waits for new ones', await rowKeys(ADD_PAGE), 'Press the new keys…')
  await page.press('k')
  page.check('the new keys are shown', await rowKeys(ADD_PAGE), 'K')
  await clickRow(EDIT)
  await page.press('k')
  page.check('keys already used are not taken silently', (await page.evaluate(`document.querySelector('.pending')?.textContent`))?.includes(`K already does “${ADD_PAGE}”`), true)
  await page.evaluate(`document.querySelector('.pending .button.primary').click()`)
  await pause(200)
  page.check('confirming moves them', [await rowKeys(EDIT), await rowKeys(ADD_PAGE)].join(' / '), 'K / none')
  await clickRow(ADD_PAGE)
  await page.press('n')
  await page.press('Escape')
  await pause(200)
  page.check('Esc closes the panel', await page.evaluate(`!!document.querySelector('.dialog')`), false)

  page.check('the storyboard shows the new keys', /K edits or opens a block .*N adds a page/.test(await hint() ?? ''), true)
  await focusFirstCard()
  await page.press('k')
  await pause(300)
  page.check('and answers to them', await page.evaluate(`document.querySelector('.edit h3')?.textContent`), 'Edit')
  await page.press('Escape')

  await page.reload()
  await page.waitFor('.open-project')
  await page.evaluate(`document.querySelector('.open-project').click()`)
  await pause(800)
  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  page.check('changes are kept after a reload', (await hint())?.includes('K edits'), true)
  await page.clickButton('Shortcuts', '.button')
  await pause(300)
  await page.clickButton('Reset every shortcut', '.link-button')
  await pause(200)
  page.check('resetting gives the defaults back', [await rowKeys(EDIT), await rowKeys(ADD_PAGE)].join(' / '), 'Enter / N')
}
