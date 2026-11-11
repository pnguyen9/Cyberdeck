// A choice of many options on its card in the storyboard grid: each line at its own height, readable,
// the first options shown and how many more, rather than every line squeezed into the card.
import { createProjectWithStory, openChapterBoard, pause } from './harness.mjs'

const STORY = `# Bets
Place your bet.
[choice: BetPick]
> Bet $10 = Ten
> Bet $50 = Fifty
> Bet $100 = Hundred
> Everything: {Money} dollars = All
> Another amount… = Other
[choice: Small]
> Yes = Yes
> No = No
The end.`

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Bets', `[counter: Money = 1000]\n${STORY}`)
  await openChapterBoard(page)
  await pause(600)
  const cards = await page.evaluate(`[...document.querySelectorAll('.element.card')].filter(card => card.querySelector('.option') !== null).map(card => {
    const box = card.getBoundingClientRect()
    const lines = [...card.querySelectorAll('.option')]
    return {
      options: lines.map(line => line.textContent.trim()),
      readable: lines.every(line => line.getBoundingClientRect().height >= 14 && line.getBoundingClientRect().bottom <= box.bottom + 0.5),
    }
  })`)
  page.check('a choice of five shows two options and how many more, each line readable', cards[0], { options: ['› Bet $10', '› Bet $50', '+3 more options'], readable: true })
  page.check('a choice of two shows both', cards[1], { options: ['› Yes', '› No'], readable: true })
  await page.screenshot('choice-cards')
}
