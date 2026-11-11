// Upper-body characters, chosen in Cast & files: drawn at their set height, taller than the stage and
// past its bottom; `near` zooms on the face, the head staying where it was, and `far` shrinks from the
// stage's bottom edge, nothing floating above it; a character drawn full body as before.
import { createProjectWithStory, pause } from './harness.mjs'

const STORY = `[enter: marie left]
[enter: jules right]
Both of them.
[move: marie near]
[move: jules far]
Near and far.`

export default async function check(page, { url, assets }) {
  await createProjectWithStory(page, url, 'Framing', STORY)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [`${assets}/marie.svg`, `${assets}/jules.svg`])
  await pause(1500)
  await page.evaluate(`(() => {
    const select = document.querySelector('.project-framing select')
    select.value = 'upperBody'
    select.dispatchEvent(new Event('change'))
  })()`)
  await pause(800)
  // Jules keeps full body, against the project.
  await page.evaluate(`(() => {
    const group = [...document.querySelectorAll('.group')].find(candidate => candidate.querySelector('.group-name')?.textContent.trim().startsWith('jules'))
    const select = group.querySelector('.framing select')
    select.value = 'fullBody'
    select.dispatchEvent(new Event('change'))
  })()`)
  await pause(800)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .sprite')
  await pause(1500)
  /** Each character's picture: its height and top, in stage pixels, and whether it goes past the bottom. */
  const pictures = () => page.evaluate(`(() => {
    const stage = document.querySelector('.viewport .stage').getBoundingClientRect()
    const scale = stage.height / 1080
    return Object.fromEntries([...document.querySelectorAll('.viewport .character')].map(character => {
      const box = character.querySelector('.sprite').getBoundingClientRect()
      return [character.querySelector('.sprite').getAttribute('alt').split(',')[0], {
        height: Math.round(box.height / scale),
        top: Math.round((box.top - stage.top) / scale),
        pastBottom: box.bottom > stage.bottom + 1,
      }]
    }))
  })()`)
  const first = await pictures()
  page.check('upper body: drawn taller than the stage, past its bottom; full body as before', [first.marie?.height, first.marie?.pastBottom, first.jules !== undefined && first.jules.height <= 960, first.jules?.pastBottom], [1300, true, true, false])
  await page.press(' ')
  await pause(1500)
  const second = await pictures()
  page.check('near zooms on the face: the head stays near where it was', Math.abs((second.marie?.top ?? 0) - (first.marie?.top ?? 0)) < 60 && (second.marie?.height ?? 0) > 1600, true)
  await page.screenshot('upper-body')
}
