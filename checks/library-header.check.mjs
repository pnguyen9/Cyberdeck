// The top of Datajack's library in French, whose words are long: at every width the language, the
// settings, the look, the PIN and the profile line all keep to the right; when they do not fit on one
// row the profile line moves whole to a row of its own, still on the right, never cut in two.
import { createProfile, pause } from './harness.mjs'

export const app = 'datajack'

/** Common widths, from a desktop to a phone. */
const WIDTHS = [1280, 1024, 800, 600, 400]

/** In the page: where the header and each of its tools are. */
const LAYOUT = `(() => {
  const header = document.querySelector('.library .header')
  const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } }
  const profile = document.querySelector('.profile-button')
  const tools = [...document.querySelectorAll('.library .header-tools > *')]
    .flatMap(element => element.matches('.header-group') ? [...element.children] : [element])
  return {
    header: box(header),
    title: box(header.querySelector('h1')),
    tools: tools.map(box),
    profile: box(profile),
    profileLineHeight: parseFloat(getComputedStyle(profile).lineHeight) || parseFloat(getComputedStyle(profile).fontSize) * 1.2,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  }
})()`

/** The tools in rows: those whose middles share a height. */
function rowsOf(tools) {
  const rows = []
  for (const tool of tools) {
    const middle = (tool.top + tool.bottom) / 2
    const row = rows.find(candidate => middle > candidate.top && middle < candidate.bottom)
    if (row === undefined) rows.push({ top: tool.top, bottom: tool.bottom, tools: [tool] })
    else row.tools.push(tool)
  }
  return rows
}

const overlaps = (first, second) => first.left < second.right - 0.5 && second.left < first.right - 0.5 && first.top < second.bottom - 0.5 && second.top < first.bottom - 0.5

export default async function check(page, { url }) {
  await createProfile(page, url, 'Pascal')
  await page.waitFor('.library .profile-button')
  await page.setValue('.library .language-select', 'fr', 'change')
  await pause(400)
  page.check('the library speaks French', await page.evaluate(`document.querySelector('.profile-button').textContent.trim()`), 'Pascal · Changer de profil')

  for (const width of WIDTHS) {
    await page.setViewport(width, 720)
    await pause(300)
    await page.screenshot(`header-fr-${width}`)
    const layout = await page.evaluate(LAYOUT)
    const right = layout.header.right
    const rows = rowsOf(layout.tools)
    const profileRow = rows.find(row => row.tools.some(tool => tool.left === layout.profile.left && tool.top === layout.profile.top))
    page.check(`${width} px: the page does not scroll sideways`, layout.pageWidth <= layout.viewportWidth, true)
    page.check(`${width} px: the profile line is on one line`, layout.profile.bottom - layout.profile.top < layout.profileLineHeight * 1.5, true)
    page.check(`${width} px: the profile line keeps to the right`, Math.abs(layout.profile.right - right) <= 1, true)
    page.check(`${width} px: every row of tools keeps to the right`, rows.every(row => Math.abs(Math.max(...row.tools.map(tool => tool.right)) - right) <= 1), true)
    page.check(`${width} px: the profile line is last, below or beside the others`, layout.tools.every(tool => tool.top <= layout.profile.top + 0.5), true)
    page.check(`${width} px: a profile line that wraps goes whole to a row of its own`, profileRow.tools.length === 1 || rows.length === 1, true)
    page.check(`${width} px: no tool covers another or the title`, layout.tools.every((tool, index) => !overlaps(tool, layout.title) && layout.tools.every((other, otherIndex) => otherIndex === index || !overlaps(tool, other))), true)
  }

  // The keyboard goes through them in the order they are read: language, settings, look, PIN, profile.
  await page.setViewport(800, 720)
  const order = await page.evaluate(`[...document.querySelectorAll('.library .header-tools select, .library .header-tools button')].map(element => element.className.split(' ').find(name => ['language-select', 'pin-button', 'profile-button'].includes(name)) ?? element.textContent.trim())`)
  page.check('the tools are in reading order', order, ['language-select', 'Paramètres', order[2], 'pin-button', 'profile-button'])
  await page.resetViewport()
}
