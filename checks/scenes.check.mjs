// Scenes: one bad end written once and played from two chapters. The import, the Chapters tab, the
// storyboard (the play, the branch it ends, the scene itself) and the preview reaching its ending.
import { advanceUntil, pause, shownStep } from './harness.mjs'

const STORY = `# Chapter 2
[choice: Answer]
> Lie = Lie
> Tell the truth = Truth
[if: Answer is Lie]
[play: Caught]
[end]
The guard lets you pass.
# Chapter 5
[choice: Door]
> Force it = Force
> Knock = Knock
[if: Door is Force]
[play: Caught]
[end]
The door opens.
# Scene: Caught
— Guard: Stop right there.
[ending: Caught]`

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('Scenes')
  await page.clickButton('Create')
  await page.waitFor('.import .source')
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(STORY)
  await pause(600)
  const paragraphs = () => page.evaluate(`[...document.querySelectorAll('.import p.muted')].map(paragraph => paragraph.textContent.replace(/\\s+/g, ' ').trim())`)
  page.check('the import names the scene apart from the chapters', (await paragraphs()).some(text => text.startsWith('Scene: Caught.')), true)
  page.check('without a problem', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)

  page.check('the Chapters tab lists the scene, and who plays it', await page.evaluate(`document.querySelector('.chapter.scene .details')?.textContent.replace(/\\s+/g, ' ').trim()`), '1 page · played by Chapter 2, Chapter 5')
  page.check('apart from the chapters', await page.evaluate(`[...document.querySelectorAll('.chapter:not(.scene) .title')].map(title => title.textContent).join(' | ')`), 'Chapter 2 | Chapter 5')

  await page.clickButton('Storyboard', '.tab')
  await page.waitFor('.grid')
  page.check('the play shows in the block, naming the scene', await page.evaluate(`[...document.querySelectorAll('.grid .element.block .mini.marker')].map(mini => mini.textContent.trim())`), ['▷ Caught'])
  page.check('the branch playing a scene that ends is marked as ending', await page.evaluate(`document.querySelector('.grid .element.block .ending-mark')?.textContent.trim()`), '★ 1 route ends')
  await page.screenshot('chapter')

  const sceneId = await page.evaluate(`[...document.querySelectorAll('.chapter-picker option')].find(option => option.textContent === 'Caught').value`)
  await page.setValue('.chapter-picker select', sceneId)
  await page.evaluate(`document.querySelector('.chapter-picker select').dispatchEvent(new Event('change'))`)
  await pause(300)
  page.check('the storyboard shows the scene, said to be one', await page.evaluate(`document.querySelector('.chapter-picker span')?.textContent`), 'Scene')
  page.check('with its page', await page.evaluate(`[...document.querySelectorAll('.grid .element.card .text')].map(text => text.textContent)`), ['Stop right there.'])
  await page.screenshot('scene')

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport')
  await advanceUntil(page, step => step === 'CHOICE')
  await pause(400)
  await page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.includes('Lie')).click()`)
  await pause(300)
  page.check('lying plays the scene', await shownStep(page), 'Stop right there.')
  await page.press(' ')
  await page.press(' ')
  await pause(300)
  page.check('whose ending ends the story', (await shownStep(page))?.includes('Caught'), true)
}
