// The pages of the built-in samples are cut at build time, in Node, from a table of Georgia's character
// widths; an author who imports the same text in Cyberdeck has the browser measure it. The two must cut
// every page in the same place, or a sample made from the built-in game would not read like the text
// it was made from. For each of the eight samples: "New project from a sample" makes a project from
// the built-in game, the text in docs/sample is imported the normal way into another, and the pages
// of every chapter and scene are compared.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProject, pause } from './harness.mjs'

const samples = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'sample')
const SAMPLES = [
  ['Sakura Week', 'sakura-week', 'sakura-week'],
  ['Knee-Deep', 'knee-deep', 'knee-deep'],
  ['Battle', 'minigames/battle', 'battle'],
  ['Blackjack', 'minigames/blackjack', 'blackjack'],
  ['Minesweeper', 'minigames/minesweeper', 'minesweeper'],
  ['Pairs', 'minigames/pairs', 'pairs'],
  ['Rock, paper, scissors', 'minigames/rock-paper-scissors', 'rock-paper-scissors'],
  ['Virtual pet', 'minigames/virtual-pet', 'virtual-pet'],
]

/** The text of every page of every chapter, then every scene, of the project of that name; null while it has none. */
const pagesOf = (page, name) => page.evaluate(`(async () => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('cyberdeck-projects')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const entries = store => new Promise((resolve, reject) => {
    const found = []
    const request = database.transaction(store).objectStore(store).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor === null) {
        resolve(found)
        return
      }
      found.push([cursor.key, cursor.value])
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
  const project = (await entries('projects')).map(entry => entry[1]).find(candidate => candidate.name === ${JSON.stringify(name)})
  if (project === undefined) {
    return null
  }
  const documents = (await entries('chapters')).filter(([key]) => key.startsWith(project.id + '/')).map(entry => entry[1])
  const pagesIn = value => Array.isArray(value) ? value.flatMap(pagesIn)
    : value !== null && typeof value === 'object' ? [...(value.type === 'page' ? [value.text] : []), ...Object.values(value).flatMap(pagesIn)] : []
  const ids = [...project.chapterOrder, ...project.sceneOrder]
  return ids.length === 0 || documents.length < ids.length ? null : ids.map(id => pagesIn(documents.find(document => document.id === id).nodes))
})()`)

export default async function check(page, { url }) {
  for (const [name, folder, id] of SAMPLES) {
    await page.navigate(url)
    await page.waitFor('.samples .sample')
    await page.evaluate(`[...document.querySelectorAll('.samples .sample')].find(card => card.querySelector('h3').textContent === ${JSON.stringify(name)}).querySelector('button').click()`)
    await page.waitFor('.tab', 60000)
    await pause(500)

    await createProject(page, url, `Imported ${name}`)
    await page.setValue('.import .source', readFileSync(join(samples, folder, `${id}.txt`), 'utf8'))
    await pause(1500)
    await page.waitUntil(`document.querySelector('.import-actions .button:not([disabled])') !== null`, 60000)
    await page.clickButton('Import', '.import-actions .button')
    await page.waitUntil(`(async () => true)()`)
    let imported = null
    for (let attempt = 0; attempt < 120 && imported === null; attempt++) {
      await pause(500)
      imported = await pagesOf(page, `Imported ${name}`)
    }
    const built = await pagesOf(page, name)
    const differences = []
    for (const [index, pages] of (built ?? []).entries()) {
      const others = imported?.[index] ?? []
      if (pages.length !== others.length || pages.some((text, number) => text !== others[number])) {
        const first = pages.findIndex((text, number) => text !== others[number])
        differences.push(`document ${index}: ${pages.length} pages built in, ${others.length} imported; the first to differ is page ${first}: ${JSON.stringify(pages[first])} against ${JSON.stringify(others[first])}`)
      }
    }
    page.check(`${name}: the built-in archive has as many chapters and scenes as the text imported`, [built?.length ?? null, built?.length === imported?.length], [imported?.length ?? 0, true])
    page.check(`${name}: every page of the built-in archive ends where the imported one does (${(built ?? []).flat().length} pages)`, differences.slice(0, 3), [])
  }
}
