// The map from the keyboard, in Datajack and in Cyberdeck's map of every path: it opens focused on a
// card, the arrows go from card to card, Tab goes through the card's own buttons and then leaves the
// map, Escape goes back from a button to its card, and Enter plays from the card.
import { createProfile, createProjectWithStory, exportGame, installGame, pause, pickOption, playUntilStop, shownStep } from './harness.mjs'

const STORY = `[counter: Bond = 0]
A free day.
[choice: Day]
> Rest at home = Rest
> Spend it with Mika = Mika
[if: Day is Mika]
[add: Bond 1]
[end]
[choice: Evening]
> Find Mika = Mika [if: Bond >= 1]
> Go home = Home
[if: Evening is Mika]
[ending: Fireworks]
[end]
[ending: Quiet]`

/** What has the focus: a card (by its heading or ending), a button in one (by its class), or something outside the map. */
const focused = page => page.evaluate(`(() => {
  const element = document.activeElement
  const card = element?.closest('.map-screen .node')
  if (card === null || card === undefined) {
    return 'outside'
  }
  const name = card.querySelector('h2')?.textContent ?? card.textContent.trim()
  return element === card ? name : name + ' / ' + element.className
})()`)

/** Presses keys one by one, telling what has the focus after each. */
async function focusAfter(page, keys, options = {}) {
  const steps = []
  for (const key of keys) {
    await page.press(key, options)
    await pause(200)
    steps.push(await focused(page))
  }
  return steps
}

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Evening', STORY)
  const archive = await exportGame(page, 'evening.zip')

  // Cyberdeck's map of every path: the option only some values open has its own ▶ button.
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(600)
  await page.clickButton('Map', '.viewport .quick-button')
  await page.waitFor('.map-screen .node')
  await pause(800)
  page.check('every path: the map opens focused on its first card', await focused(page), 'Day')
  page.check('the card has a name telling what Enter does', await page.evaluate(`document.activeElement.getAttribute('aria-label')`), 'Untitled chapter, Day: Enter to play from here')
  page.check('one Tab stop in the map: the card, and its own buttons (Day shows no values)', await page.evaluate(`[...document.querySelectorAll('.map-scroll [tabindex="0"]')].map(element => element.className).join(' / ')`), 'node point / play-button')
  page.check('→ → ← ↓: from card to card, the nearest by height, down the column', await focusAfter(page, ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft', 'ArrowUp']), ['Evening', '★ Fireworks', 'Evening', 'Day', 'Day'])
  await page.press('ArrowRight')
  await pause(200)
  page.check('Tab goes through the card\'s buttons in order, then leaves the map', await focusAfter(page, ['Tab', 'Tab', 'Tab', 'Tab']), ['Evening / option-play', 'Evening / values-button', 'Evening / play-button', 'outside'])
  await page.press('Tab', { shift: true })
  await pause(200)
  page.check('Shift+Tab comes back to the last of them', await focused(page), 'Evening / play-button')
  page.check('an arrow on a button goes on to the next card', await focusAfter(page, ['ArrowRight']), ['★ Fireworks'])
  await page.press('ArrowLeft')
  await page.press('Tab')
  await page.press('Escape')
  await pause(200)
  page.check('Escape on a button goes back to its card', await focused(page), 'Evening')
  await page.screenshot('every-path')
  await page.press('Enter')
  await page.waitFor('.viewport')
  await pause(1000)
  const previewOptions = () => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
  page.check('Enter on the card previews from it: its own point, where Bond is 0', await previewOptions(), ['Go home'])

  // Enter on an option's ▶ does what the button does, never what the card's Enter does.
  await page.clickButton('Map', '.viewport .quick-button')
  await page.waitFor('.map-screen')
  await page.clickButton('Every path', '.switch-button')
  await pause(800)
  await page.evaluate(`[...document.querySelectorAll('.map-screen .node')].find(node => node.querySelector('h2')?.textContent === 'Evening').focus()`)
  await page.press('Tab')
  await pause(200)
  page.check('Tab reaches the ▶ of the option only some values open', await focused(page), 'Evening / option-play')
  await page.press('Enter', { text: '\r' })
  await page.waitFor('.viewport .option')
  await pause(1000)
  page.check('Enter on the ▶ previews from the path that offers the option, not from the card\'s point', await previewOptions(), ['Find Mika', 'Go home'])

  // Datajack: the map of the paths played.
  await createProfile(page, await serve('datajack'), 'Pascal')
  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport')
  await pause(500)
  await playUntilStop(page)
  await pickOption(page, 'Spend it with Mika')
  await pause(300)
  await playUntilStop(page)
  await pickOption(page, 'Find Mika')
  await pause(300)
  await playUntilStop(page)
  await page.clickButton('Map', '.end-button')
  await page.waitFor('.map-screen .node')
  await pause(600)
  page.check('Datajack: the map opens focused on the card reached last', await focused(page), 'Evening')
  page.check('← → →: from card to card', await focusAfter(page, ['ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowDown']), ['Day', 'Evening', '★ Fireworks', '★ Fireworks'])
  await page.press('ArrowLeft')
  page.check('Tab: the card\'s button (no values shown to players here), then out of the map', await focusAfter(page, ['Tab', 'Tab']), ['Evening / play-button', 'outside'])
  // Past the page's last element, the browser may hold the focus for a press before the page has it again.
  for (let press = 0; press < 3 && await focused(page) !== 'Evening / play-button'; press++) {
    await page.press('Tab', { shift: true })
  }
  page.check('Shift+Tab back to the button, then to the card', [await focused(page), ...await focusAfter(page, ['Tab'], { shift: true })], ['Evening / play-button', 'Evening'])
  await page.screenshot('datajack')
  await page.press('Enter')
  await page.waitFor('.viewport')
  await pause(1000)
  page.check('Enter on the card plays from it', await shownStep(page), 'CHOICE')
}
