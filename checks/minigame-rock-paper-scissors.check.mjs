// The rock, paper, scissors sample in docs/sample/minigames: its text imports without a problem, its
// sounds, given as the zip they come in, each find their entry; played, a round names both hands and
// counts its outcome in the journal, and stopping ends on the final score.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { advanceUntil, createProject, pause, shownStep } from './harness.mjs'

const sample = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample', 'minigames', 'rock-paper-scissors')

const options = page => page.evaluate(`[...document.querySelectorAll('.viewport .option')].map(option => option.textContent.trim())`)
async function untilOptions(page) {
  for (let press = 0; press < 8 && (await options(page)).length === 0; press++) {
    await page.press(' ')
    await pause(500)
  }
}
const pick = (page, text) => page.evaluate(`[...document.querySelectorAll('.viewport .option')].find(option => option.textContent.trim() === ${JSON.stringify(text)}).click()`)

export default async function check(page, { url }) {
  await createProject(page, url, 'Rock, paper, scissors')
  await page.setValue('.import .source', readFileSync(join(sample, 'rock-paper-scissors.txt'), 'utf8'))
  await pause(1000)
  page.check('the sample imports without problems', await page.evaluate(`[...document.querySelectorAll('.import .problems li')].map(item => item.textContent)`), [])
  await page.clickButton('Import', '.import-actions .button')
  await pause(1000)

  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', [join(sample, 'rock-paper-scissors-assets.zip')])
  await page.waitFor('.message[role=status]', 30000)
  await pause(500)
  const report = await page.statusText()
  page.check('every sound of the zip finds its entry', ['pick', 'reveal', 'win', 'lose', 'draw'].every(name => report.includes(`${name}.ogg → Sound ${name}`)), true)
  page.check('and no entry is left without a file', await page.evaluate(`document.querySelectorAll('.cast .missing-count').length`), 0)

  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .ask-input')
  await page.press('Enter')
  await pause(600)
  await untilOptions(page)
  page.check('a round offers the three hands', await options(page), ['Rock', 'Paper', 'Scissors'])

  const outcomes = []
  for (let round = 0; round < 4; round++) {
    await pick(page, ['Rock', 'Paper', 'Scissors'][round % 3])
    await pause(800)
    const hands = await shownStep(page)
    page.check(`round ${round + 1} names both hands`, /^You chose (Rock|Paper|Scissors)\. The computer chose (Rock|Paper|Scissors)\.$/.test(hands), true)
    await advanceUntil(page, step => !step.startsWith('You chose'), 5)
    await pause(400)
    outcomes.push(await shownStep(page))
    await untilOptions(page)
    page.check(`round ${round + 1} asks whether to go on`, await options(page), ['Another round', 'Stop here'])
    if (round < 3) {
      await pick(page, 'Another round')
      await pause(800)
      await untilOptions(page)
    }
  }
  page.check('each round has an outcome', outcomes.every(outcome => ['Round to You!', 'A draw.', 'Round to the computer.'].includes(outcome)), true)

  await page.press('j')
  await pause(300)
  const journal = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.viewport .entry')].map(entry => { const words = entry.innerText.trim().split(/\\s+/); return [words.slice(0, -1).join(' '), words.at(-1)] }))`)
  page.check('the journal counts the four rounds, in this game and in all', [Number(journal.Wins) + Number(journal.Losses) + Number(journal.Draws), Number(journal['Total wins']) + Number(journal['Total losses']) + Number(journal['Total draws'])], [4, 4])
  await page.screenshot('journal')
  await page.press('Escape')
  await pause(300)

  await pick(page, 'Stop here')
  await pause(800)
  page.check('stopping gives the final score', (await shownStep(page)).startsWith(`Final score — You ${journal.Wins}, the computer ${journal.Losses}, draws ${journal.Draws}.`), true)
  await advanceUntil(page, step => step.startsWith('Every game played'))
  page.check('then the score of every game played', (await shownStep(page)).startsWith(`Every game played — You ${journal['Total wins']}`), true)
  for (let press = 0; press < 5 && await page.evaluate(`document.querySelector('.ending-name') === null`); press++) {
    await page.press(' ')
    await pause(800)
  }
  page.check('and the ending is the final score', await page.evaluate(`document.querySelector('.ending-name')?.textContent.trim()`), 'Final score')
  await page.screenshot('end')
}
