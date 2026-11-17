// "New project from a sample" in Cyberdeck's projects view: the sample becomes a new project of its own,
// with its chapters and its files, previewing as it should; picked again, it asks what to do about the
// project of that name, "Open mine" opening the one there is, "Fresh copy" making "Pairs (2)", then
// "Pairs (3)"; no project is ever replaced or merged into, and cancelling changes nothing.
import { pause } from './harness.mjs'

const projectNames = page => page.evaluate(`[...document.querySelectorAll('.projects .project-name')].map(name => name.textContent.trim()).sort()`)
const pickSample = (page, name) => page.evaluate(`[...document.querySelectorAll('.samples .sample')].find(card => card.querySelector('h3').textContent === ${JSON.stringify(name)}).querySelector('button').click()`)
const openedName = page => page.evaluate(`document.querySelector('.page-header h1, h1')?.firstChild?.textContent.trim()`)

export default async function check(page, { url }) {
  await page.navigate(url)
  await page.waitFor('.samples .sample')
  page.check('the section lists the eight samples with their descriptions', await page.evaluate(`[...document.querySelectorAll('.samples .sample')].map(card => card.querySelector('h3').textContent)`),
    ['Sakura Week', 'Knee-Deep', 'Battle', 'Blackjack', 'Minesweeper', 'Pairs', 'Rock, paper, scissors', 'Virtual pet'])
  page.check('and no project exists yet', await projectNames(page), [])
  await page.screenshot('samples')

  await pickSample(page, 'Pairs')
  await page.waitFor('.tab')
  await pause(800)
  page.check('picking Pairs opens a new project of that name', await openedName(page), 'Pairs')
  await page.clickButton('Cast & files', '.tab')
  await pause(500)
  page.check('whose files came with it: no entry waits for one', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)
  await page.clickButton('Preview ▶', '.button')
  await pause(800)
  page.check('and which previews', await page.evaluate(`document.querySelector('.viewport') !== null`), true)
  await page.clickButton('← Projects')
  await page.waitFor('.samples .sample')
  await pause(500)
  page.check('the projects list has it', await projectNames(page), ['Pairs'])

  // The same sample again: the question, and cancelling changes nothing.
  await pickSample(page, 'Pairs')
  await page.waitFor('.samples .confirmation')
  page.check('picking it again asks, with the project of that name named', await page.evaluate(`document.querySelector('.samples .confirmation p').textContent`), 'A project named Pairs already exists. Open it, or make a fresh copy?')
  page.check('offering to open mine, to make a fresh copy, or to cancel', await page.evaluate(`[...document.querySelectorAll('.samples .confirmation .button')].map(button => button.textContent.trim())`), ['Open mine', 'Fresh copy', 'Cancel'])
  page.check('the question is by the sample\'s card, and "Open mine" has the focus', await page.evaluate(`[document.querySelector('.samples .confirmation').closest('.sample').querySelector('h3').textContent, document.activeElement?.textContent.trim()]`), ['Pairs', 'Open mine'])
  await page.screenshot('samples-question')
  await page.clickButton('Cancel', '.samples .confirmation .button')
  await pause(300)
  page.check('cancelling leaves one project and no question', [await projectNames(page), await page.evaluate(`document.querySelector('.samples .confirmation') === null`)], [['Pairs'], true])
  page.check('and the focus returns to the card\'s button', await page.evaluate(`[document.activeElement?.closest('.sample')?.querySelector('h3').textContent, document.activeElement?.textContent.trim()]`), ['Pairs', 'Start from this sample'])

  // Open mine: the one that is there, no new project.
  await pickSample(page, 'Pairs')
  await page.waitFor('.samples .confirmation')
  await page.clickButton('Open mine', '.samples .confirmation .button')
  await page.waitFor('.tab')
  await pause(500)
  page.check('"Open mine" opens the existing project', await openedName(page), 'Pairs')
  await page.clickButton('← Projects')
  await page.waitFor('.samples .sample')
  await pause(500)
  page.check('and makes no other', await projectNames(page), ['Pairs'])

  // Fresh copies.
  for (const [copy, names] of [['Pairs (2)', ['Pairs', 'Pairs (2)']], ['Pairs (3)', ['Pairs', 'Pairs (2)', 'Pairs (3)']]]) {
    await pickSample(page, 'Pairs')
    await page.waitFor('.samples .confirmation')
    await page.clickButton('Fresh copy', '.samples .confirmation .button')
    await page.waitFor('.tab')
    await pause(500)
    page.check(`"Fresh copy" opens ${copy}`, await openedName(page), copy)
    await page.clickButton('← Projects')
    await page.waitFor('.samples .sample')
    await pause(500)
    page.check(`and the list keeps every project: ${names.join(', ')}`, await projectNames(page), names)
  }

  // Another sample is a new project, with no question.
  await pickSample(page, 'Minesweeper')
  await page.waitFor('.tab')
  await pause(500)
  page.check('a sample whose name no project has opens at once', await openedName(page), 'Minesweeper')
}
