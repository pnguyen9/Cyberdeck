// Route chapters: a chapter played only on a condition says so in the Chapters tab and the storyboard,
// and the preview passes it by when the condition does not hold.
import { advanceUntil, pause, shownStep } from './harness.mjs'

const STORY = `# Prologue
[choice: Route]
> Follow Marie = Marie
> Follow Jules = Jules
# Marie's route
[only if: Route is Marie]
The library.
# Jules's route
[only if: Route is Jules]
The rooftop.
# Epilogue
The end.`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Routes')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  page.check('the import accepts it', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  page.check('the Chapters tab says which chapters play only on a route', await page.evaluate(`[...document.querySelectorAll('.chapter')].map(chapter => chapter.querySelector('.only-if')?.textContent.trim() ?? '—')`), [
    '—',
    'Played only if Route is Marie',
    'Played only if Route is Jules',
    '—',
  ])
  await page.screenshot('chapters')

  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  const chapterId = await page.evaluate(`[...document.querySelectorAll('.chapter-picker option')].find(option => option.textContent === "Jules's route").value`)
  await page.setValue('.chapter-picker select', chapterId, 'change')
  await pause(300)
  page.check('so does the storyboard', await page.evaluate(`document.querySelector('.storyboard .only-if')?.textContent.trim()`), 'Played only if Route is Jules; passed by otherwise.')

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await advanceUntil(page, step => step === 'CHOICE')
  await pause(400)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes('Follow Jules')).click()`)
  await pause(300)
  page.check("Jules's route is played", await shownStep(page), 'The rooftop.')
  await advanceUntil(page, step => step === 'The end.')
  page.check("then the epilogue, Marie's route passed by", await shownStep(page), 'The end.')
}
