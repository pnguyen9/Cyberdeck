// Fonts of the project: a font file dropped in Cast & files becomes a font of its name, measured; a
// class of the CSS naming it draws text in it, the preview loading it from the game; and pages of text
// in a wider font are cut shorter. The font is a free one of the system, copied for the check, not
// kept in the repository: `fc-match monospace` finds it, DejaVu Sans Mono on most Linux systems.
import { execFileSync } from 'node:child_process'
import { copyFileSync } from 'node:fs'
import { pause } from './harness.mjs'

// Two lines of the text box at its own font, nearly full: wider, it needs a second page.
const PARAGRAPH = 'The station was empty, and the last train had left long before the old clock struck midnight over the quiet square.'

export default async function check(page, { url, output }) {
  const systemFont = execFileSync('fc-match', ['-f', '%{file}', 'monospace'], { encoding: 'utf8' }).trim()
  const fontFile = `${output}/Typewriter.ttf`
  copyFileSync(systemFont, fontFile)

  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Fonts')
  await page.clickButton('Create')
  await page.waitFor('.import .source')

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [fontFile])
  await pause(1500)
  page.check('the font file becomes a font of its name', await page.statusText(), '1 file added: Typewriter.ttf → Font Typewriter.')
  const shown = await page.evaluate(`[...document.querySelectorAll('.cast .entry')].map(entry => entry.textContent.replace(/\\s+/g, ' ').trim()).find(text => text.includes('Typewriter'))`)
  const percent = Number(/(\d+) % as wide/.exec(shown ?? '')?.[1])
  page.check('it is named for the CSS, and measured wider than the text box\'s font', [shown?.startsWith('font-family: "Typewriter"'), percent > 110], [true, true])
  await page.screenshot('fonts')

  await page.clickButton('Definitions', '.tab')
  await page.waitFor('.definitions textarea.css')
  await page.setValue('.definitions textarea.css', '.typed { font-family: "Typewriter", monospace }')
  await page.clickButton('Save the CSS', '.button')
  await pause(300)

  await page.clickButton('Import', '.tab')
  await page.waitFor('.import .source')
  await page.setValue('.import .source', PARAGRAPH)
  await pause(800)
  const plainPages = await page.evaluate(`Number(/(\\d+) pages?/.exec(document.querySelector('.import p.muted:last-of-type')?.textContent ?? '')?.[1])`)
  await page.setValue('.import .source', `[style: typed]${PARAGRAPH}`)
  await pause(800)
  const typedPages = await page.evaluate(`Number(/(\\d+) pages?/.exec(document.querySelector('.import p.muted:last-of-type')?.textContent ?? '')?.[1])`)
  page.check('the same paragraph in the wider font is cut into more pages', [plainPages, typedPages], [1, 2])
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .textbox')
  await pause(1200)
  page.check('the preview draws the text in the font, loaded from the project', await page.evaluate(`(() => {
    const run = document.querySelector('.viewport .textbox .text .author-typed')
    return [getComputedStyle(run).fontFamily.startsWith('Typewriter'), document.fonts.check('44px "Typewriter"')]
  })()`), [true, true])
  await page.press(' ')
  await pause(300)
  await page.screenshot('preview')
}
