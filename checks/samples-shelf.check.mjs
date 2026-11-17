// The Samples shelf of Datajack's library: every sample listed with its cover and description, nothing
// installed until one is picked; "Add to library" installs it and the shelf then says it is in the
// library, no game being played from the shelf; a game of the library played from its own card; a sample
// whose content differs from what the shelf installed offers "Update", and one with no record too.
import { createProfile, pause } from './harness.mjs'

export const app = 'datajack'

export default async function check(page, { url }) {
  await createProfile(page, url, 'Pascal')
  await page.waitFor('.shelf .sample')
  const shelf = () => page.evaluate(`[...document.querySelectorAll('.shelf .sample')].map(card => [card.querySelector('h3').textContent, card.querySelector('button')?.textContent.trim() ?? card.querySelector('.in-library')?.textContent.trim()])`)

  page.check('the shelf lists the eight samples, each to add', await shelf(), [
    ['Sakura Week', 'Add to library'], ['Knee-Deep', 'Add to library'], ['Battle', 'Add to library'], ['Blackjack', 'Add to library'],
    ['Minesweeper', 'Add to library'], ['Pairs', 'Add to library'], ['Rock, paper, scissors', 'Add to library'], ['Virtual pet', 'Add to library'],
  ])
  page.check('nothing is installed until one is picked', await page.evaluate(`document.querySelectorAll('.games .game').length`), 0)
  page.check('each shows its description, and the covers load', await page.evaluate(`[...document.querySelectorAll('.shelf .sample')].every(card => card.querySelector('.sample-description').textContent.length > 20)
    && [...document.querySelectorAll('.shelf .sample-cover img')].every(image => image.complete)`), true)
  await page.screenshot('shelf')

  await page.evaluate(`[...document.querySelectorAll('.shelf .sample')].find(card => card.querySelector('h3').textContent === 'Pairs').querySelector('button').click()`)
  await page.waitFor('.games .game')
  await pause(500)
  page.check('Pairs is installed, and says so, by its card, where the focus is now that its button is gone', await page.evaluate(`(() => { const status = document.querySelector('.shelf .sample [role=status]'); return [status.textContent, document.activeElement === status, status.closest('.sample').querySelector('h3').textContent] })()`), ['Pairs 1.0 installed.', true, 'Pairs'])
  page.check('its card is among the games, with its cover and description', await page.evaluate(`(() => { const card = document.querySelector('.games .game'); return [card.querySelector('h2').textContent.trim(), card.querySelector('.cover img') !== null, card.querySelector('.description').textContent.startsWith('A minigame')] })()`), ['Pairs 1.0', true, true])
  page.check('the shelf says it is in the library, without a button to play it', (await shelf()).find(([name]) => name === 'Pairs')[1], 'In your library')
  page.check('and the others still offer to be added', (await shelf()).filter(([, state]) => state === 'Add to library').length, 7)
  await page.screenshot('shelf-installed')

  // Played from its own card, like any game.
  await page.clickButton('Play', '.games .button')
  await page.waitFor('.viewport')
  page.check('the game starts from its card', await page.evaluate(`document.querySelector('.viewport') !== null`), true)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  // The record survives a reload; a record of other content offers the update, a missing record too.
  await page.reload()
  await page.waitFor('.shelf .sample')
  page.check('after a reload, Pairs is still in the library', (await shelf()).find(([name]) => name === 'Pairs')[1], 'In your library')
  await page.evaluate(`localStorage.setItem('datajack:samples', JSON.stringify({ pairs: 'older' }))`)
  await page.reload()
  await page.waitFor('.shelf .sample')
  page.check('content that differs from the built-in offers Update', (await shelf()).find(([name]) => name === 'Pairs')[1], 'Update')
  await page.evaluate(`localStorage.removeItem('datajack:samples')`)
  await page.reload()
  await page.waitFor('.shelf .sample')
  page.check('an installed sample with no record offers Update too', (await shelf()).find(([name]) => name === 'Pairs')[1], 'Update')
  await page.evaluate(`[...document.querySelectorAll('.shelf .sample')].find(card => card.querySelector('h3').textContent === 'Pairs').querySelector('button').click()`)
  await pause(1500)
  page.check('updating says the sample is up to date, not the chapters it rewrote', await page.evaluate(`document.querySelector('.shelf .sample [role=status]')?.textContent`), 'Pairs is up to date in your library.')
  page.check('updating keeps one game, and the shelf is settled again', [await page.evaluate(`document.querySelectorAll('.games .game').length`), (await shelf()).find(([name]) => name === 'Pairs')[1]], [1, 'In your library'])

  // Removed from the library, it can be added again.
  await page.clickButton('Remove', '.games .link-button')
  await pause(200)
  await page.clickButton('Remove', '.confirmation .button')
  await pause(800)
  page.check('a sample removed from the library is offered again', (await shelf()).find(([name]) => name === 'Pairs')[1], 'Add to library')
}
