// The apps' own look: cyberpunk by default, a preset or a look of one's own, chosen with the keyboard
// as with the mouse and kept; the preview's stage, like Datajack's games, keeps its own.
import { createProfile, createProjectWithSample, pause } from './harness.mjs'

const rootVariable = name => `getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(name)}).trim()`
const colourOf = (selector, property = 'color') => `getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(property)}]`

export default async function check(page, { url, serve }) {
  await page.navigate(url)
  await page.waitFor('.page-header')
  page.check('Cyberdeck is cyberpunk by default', await page.evaluate(`[document.documentElement.dataset.look, ${rootVariable('--look-accent')}, ${colourOf('h1')}]`), ['cyberpunk', '#9eeaff', 'rgb(158, 234, 255)'])
  page.check('as it always was', await page.evaluate(`[${colourOf('html', 'backgroundColor')}, ${colourOf('.button', 'borderTopColor')}, ${colourOf('.button', 'backgroundColor')}]`), ['rgb(11, 13, 18)', 'rgb(44, 52, 66)', 'rgb(17, 21, 29)'])
  await page.screenshot('cyberdeck-default')

  // With the keyboard: the button takes the focus, Space opens the setting, which holds the focus.
  await page.evaluate(`[...document.querySelectorAll('.page-header .button')].find(button => button.textContent.trim() === 'Appearance').focus()`)
  await page.press(' ')
  await page.waitFor('dialog.app-look[open]')
  page.check('the setting opens over the screen, the focus in it', await page.evaluate(`document.querySelector('dialog.app-look').contains(document.activeElement)`), true)
  page.check('it says games keep their own look', await page.evaluate(`document.querySelector('dialog.app-look p').textContent.includes('A game keeps the look its author gave it')`), true)
  page.check('the current preset is pressed', await page.evaluate(`document.querySelector('.preset[aria-pressed=true]').dataset.preset`), 'cyberpunk')
  await page.evaluate(`document.querySelector('.preset[data-preset=paper]').focus()`)
  await page.press(' ')
  await pause(200)
  page.check('a preset changes the look at once', await page.evaluate(`[document.documentElement.dataset.look, ${colourOf('h1')}, ${colourOf('html', 'backgroundColor')}]`), ['paper', 'rgb(26, 82, 150)', 'rgb(247, 244, 236)'])
  page.check('its contrast is told', await page.evaluate(`document.querySelector('.contrast').textContent.trim()`), 'Contrast: text 14.4:1, titles 7.1:1. Borders 2:1.')
  await page.screenshot('cyberdeck-paper-setting')
  await page.press('Escape')
  await pause(200)
  page.check('Escape closes it', await page.evaluate(`!!document.querySelector('dialog.app-look')`), false)
  await page.screenshot('cyberdeck-paper')

  // In depth: a gradient, white text on it, the box keeping it readable, double borders, a monospaced font.
  await page.clickButton('Appearance', '.page-header .button')
  await page.waitFor('dialog.app-look[open]')
  await page.evaluate(`[...document.querySelectorAll('.app-look input[type=radio]')][1].click()`)
  await pause(100)
  const corners = ['#ff8a00', '#ffe066', '#e52e71', '#ffffff']
  for (const [index, corner] of corners.entries()) {
    await page.evaluate(`(() => { const field = document.querySelectorAll('.app-look .corners .hex')[${index}]; field.value = ${JSON.stringify(corner)}; field.dispatchEvent(new Event('input')); field.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  }
  const textField = `[...document.querySelectorAll('.app-look .colour-field')].find(field => field.textContent.includes('Text colour')).querySelector('.hex')`
  await page.evaluate(`(() => { const field = ${textField}; field.value = 'ffffff'; field.dispatchEvent(new Event('input')); field.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await pause(100)
  page.check('white text on a bright gradient is warned about', await page.evaluate(`document.querySelector('.contrast').classList.contains('low')`), true)
  await page.evaluate(`document.querySelector('.app-look input[type=checkbox]').click()`)
  await pause(100)
  page.check('the box under the text does not mend white text on a bright background', await page.evaluate(`document.querySelector('.contrast').classList.contains('low')`), true)
  await page.evaluate(`(() => { const field = ${textField}; field.value = '#2a1a10'; field.dispatchEvent(new Event('input')); field.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await pause(100)
  page.check('dark text on the light box reads', await page.evaluate(`document.querySelector('.contrast').textContent.includes('hard to read for many people')`), false)
  await page.evaluate(`(() => { const select = [...document.querySelectorAll('.app-look select')]; select[0].value = 'mono'; select[0].dispatchEvent(new Event('change')); select[1].value = 'double'; select[1].dispatchEvent(new Event('change')) })()`)
  await pause(200)
  page.check('a look of one\'s own is no preset', await page.evaluate(`[document.documentElement.dataset.look, [...document.querySelectorAll('.preset[aria-pressed=true]')].map(preset => preset.dataset.preset)]`), ['custom', ['custom']])
  page.check('on a bright background, the box is light', await page.evaluate(`${rootVariable('--look-scheme')}`), 'light')
  await page.screenshot('cyberdeck-gradient-setting')
  await page.evaluate(`document.querySelector('.look-footer .primary').click()`)
  await pause(200)
  page.check('the page lies in the box, its borders double', await page.evaluate(`[${colourOf('.editor-page', 'backgroundColor')} !== 'rgba(0, 0, 0, 0)', ${colourOf('.button', 'borderTopStyle')}, ${colourOf('.editor-page', 'fontFamily')}.startsWith('ui-monospace')]`), [true, 'double', true])
  await page.screenshot('cyberdeck-gradient')

  await page.reload()
  await page.waitFor('.page-header')
  page.check('the look is kept', await page.evaluate(`[document.documentElement.dataset.look, JSON.parse(localStorage.getItem('cyberdeck:look')).borderKind]`), ['custom', 'double'])

  // The preview plays as Datajack shows it: the stage keeps its own look.
  await createProjectWithSample(page, url, 'Looks')
  await page.screenshot('cyberdeck-editor')
  await page.evaluate(`[...document.querySelectorAll('.header-tools > .button.primary')].find(button => button.textContent.trim().startsWith('Preview')).click()`)
  await page.waitFor('.viewport .text')
  await pause(500)
  page.check('the preview\'s stage keeps its look', await page.evaluate(`[${colourOf('.viewport', 'backgroundColor')}, ${colourOf('.viewport .text')}, ${colourOf('.viewport .text', 'fontFamily')}.includes('monospace')]`), ['rgb(0, 0, 0)', 'rgb(242, 244, 248)', false])
  await page.screenshot('cyberdeck-preview')

  // Datajack has its own, the same for every profile: it shows before one is chosen.
  const datajack = await serve('datajack')
  await page.navigate(datajack)
  await page.waitFor('.profiles-header')
  page.check('Datajack keeps a look apart from Cyberdeck\'s', await page.evaluate(`document.documentElement.dataset.look`), 'cyberpunk')
  await createProfile(page, datajack, 'Pascal')
  await page.waitFor('.library')
  await page.clickButton('Appearance', '.header-tools .button')
  await page.waitFor('dialog.app-look[open]')
  await page.evaluate(`document.querySelector('.preset[data-preset=dusk]').click()`)
  // The look is written down once it rests (400 ms).
  await pause(600)
  page.check('Datajack takes a preset', await page.evaluate(`[document.documentElement.dataset.look, JSON.parse(localStorage.getItem('datajack:look')).backgroundKind]`), ['dusk', 'gradient'])
  await page.screenshot('datajack-dusk-setting')
  await page.press('Escape')
  await pause(200)
  await page.screenshot('datajack-dusk')

  // The preset for children: a bright gradient, the text on a light box, its borders dashed.
  await page.clickButton('Appearance', '.header-tools .button')
  await page.waitFor('dialog.app-look[open]')
  await page.evaluate(`document.querySelector('.preset[data-preset=playground]').click()`)
  await pause(600)
  page.check('Datajack takes the preset for children', await page.evaluate(`[document.documentElement.dataset.look, ${rootVariable('--look-scheme')}, JSON.parse(localStorage.getItem('datajack:look')).readableBox]`), ['playground', 'light', true])
  page.check('its text and titles read', await page.evaluate(`document.querySelector('.contrast').textContent.trim()`), 'Contrast: text 12.3:1, titles 7.1:1. Borders 4:1.')
  await page.screenshot('datajack-playground-setting')
  await page.press('Escape')
  await pause(200)
  page.check('the library lies in a light box, its borders dashed', await page.evaluate(`[${colourOf('.library', 'color')}, ${colourOf('.header-tools .button', 'borderTopStyle')}]`), ['rgb(29, 43, 100)', 'dashed'])
  await page.screenshot('datajack-playground')
  await page.clickButton('Settings', '.header-tools .button')
  await page.waitFor('.settings-screen .overlay')
  page.check('the player\'s settings, drawn as in a game, keep their look', await page.evaluate(`${colourOf('.settings-screen', 'backgroundColor')}`), 'rgb(5, 7, 12)')
}
