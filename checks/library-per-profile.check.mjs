// Each profile has its own library in Datajack's web build: a game added in one is not in another's;
// two profiles that add it each have their copy, one updating it while the other keeps its version
// and plays it; removing or erasing touches one library only; the samples' shelf is per profile, the
// pictures two profiles have stored once; removing a profile deletes its library; and the games
// installed before each profile had its own library go into every profile there is.
import { askProfileRemoval, createProfile, createProjectWithStory, exportGame, installGame, libraryGames, pause, playProfile, shownStep, switchProfile, switchTo as switchToProfile } from './harness.mjs'

const STORY = `# One
The first page of the diary.`

/** In the page: how many records each store of the library's database holds. */
const STORE_COUNTS = `new Promise((resolve, reject) => {
  const request = indexedDB.open('datajack-library')
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const database = request.result
    const stores = [...database.objectStoreNames]
    const transaction = database.transaction(stores, 'readonly')
    const counts = {}
    for (const store of stores) {
      const count = transaction.objectStore(store).count()
      count.onsuccess = () => { counts[store] = count.result }
    }
    transaction.oncomplete = () => { database.close(); resolve(counts) }
  }
})`

/**
 * In the page: moves every profile's copy of the games back where an earlier Datajack kept them,
 * before each profile had its own library, keyed by game alone.
 */
const AS_EARLIER = `new Promise((resolve, reject) => {
  const request = indexedDB.open('datajack-library')
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const database = request.result
    const transaction = database.transaction(['games', 'chapters', 'profileGames', 'profileChapters'], 'readwrite')
    for (const [from, to] of [['profileGames', 'games'], ['profileChapters', 'chapters']]) {
      const cursor = transaction.objectStore(from).openCursor()
      cursor.onsuccess = () => {
        if (cursor.result !== null) {
          transaction.objectStore(to).put(cursor.result.value, cursor.result.key.slice(cursor.result.key.indexOf('/') + 1))
          cursor.result.delete()
          cursor.result.continue()
        }
      }
    }
    transaction.oncomplete = () => { database.close(); resolve(true) }
  }
})`

export default async function check(page, { url, serve }) {
  await createProjectWithStory(page, url, 'Diary', STORY)
  const older = await exportGame(page, 'Diary 1.0.zip')
  await page.evaluate(`(() => { const input = document.querySelector('.export .release .text-input'); input.focus(); input.select() })()`)
  await page.typeText('2.0')
  await pause(300)
  const newer = await exportGame(page, 'Diary 2.0.zip')

  await createProfile(page, await serve('datajack'), 'Pascal')
  /** Another profile's library, its shelf shown. */
  const switchTo = async name => {
    await switchToProfile(page, name)
    await page.waitFor('.shelf .sample')
  }
  const shelfState = name => page.evaluate(`(() => {
    const card = [...document.querySelectorAll('.shelf .sample')].find(candidate => candidate.querySelector('h3').textContent === ${JSON.stringify(name)})
    return card.querySelector('button')?.textContent.trim() ?? card.querySelector('.in-library')?.textContent.trim()
  })()`)
  const addSample = async name => {
    await page.evaluate(`[...document.querySelectorAll('.shelf .sample')].find(card => card.querySelector('h3').textContent === ${JSON.stringify(name)}).querySelector('button').click()`)
    await pause(2500)
    return page.evaluate(`document.querySelector('.shelf .sample [role=status]')?.textContent`)
  }
  const confirmation = () => page.evaluate(`document.querySelector('.confirmation p')?.textContent.trim()`)
  const gameCard = name => `[...document.querySelectorAll('.games .game')].find(card => card.querySelector('h2').textContent.trim().startsWith(${JSON.stringify(name)}))`

  await installGame(page, older)
  page.check('Pascal installs the diary', [await libraryGames(page), await page.statusText()], ['Diary 1.0', 'Diary 1.0 installed.'])
  page.check('Pascal adds a sample', await addSample('Pairs'), 'Pairs 1.0 installed.')
  const assetsOnce = (await page.evaluate(STORE_COUNTS)).assets

  await switchTo('Alex')
  page.check('a new profile starts with an empty library', await libraryGames(page), '')
  page.check('its shelf offers the sample Pascal added', await shelfState('Pairs'), 'Add to library')
  await installGame(page, older)
  page.check('Alex installs the same diary, as any new game, nothing said of Pascal', [await libraryGames(page), await page.statusText()], ['Diary 1.0', 'Diary 1.0 installed.'])
  page.check('Alex adds the same sample', await addSample('Pairs'), 'Pairs 1.0 installed.')
  page.check('their pictures are stored once', (await page.evaluate(STORE_COUNTS)).assets, assetsOnce)
  await installGame(page, newer)
  page.check('Alex updates the diary', [await libraryGames(page), await page.statusText()], ['Diary 2.0,Pairs 1.0', 'Diary 2.0: updated One.'])

  await switchTo('Pascal')
  page.check('Pascal keeps the version installed', await libraryGames(page), 'Diary 1.0,Pairs 1.0')
  await page.evaluate(`${gameCard('Diary')}.querySelector('.button.primary').click()`)
  await page.waitFor('.viewport .text')
  await pause(500)
  page.check('and plays it', await shownStep(page), 'The first page of the diary.')
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)
  await page.evaluate(`[...${gameCard('Diary')}.querySelectorAll('.link-button')].find(button => button.textContent.trim() === 'Remove').click()`)
  await pause(300)
  page.check('removing asks about Pascal’s library', await confirmation(), 'Remove Diary from your library? Your saves are kept, for when you install it again.')
  await page.evaluate(`document.querySelector('.game .confirmation .button.danger').click()`)
  await pause(800)
  page.check('the diary leaves Pascal’s library', [await libraryGames(page), await page.statusText()], ['Pairs 1.0', 'Diary was removed from your library.'])

  await switchTo('Alex')
  page.check('Alex still has it', await libraryGames(page), 'Diary 2.0,Pairs 1.0')
  await page.clickButton('Erase your games and saves…', '.link-button')
  await pause(300)
  page.check('erasing speaks of Alex’s library', await confirmation(), 'Erase every game in your library? Your saves and progress are kept, unless you erase them too. Other profiles keep their libraries, saves and progress.')
  await page.clickButton('Erase the games', '.button.danger')
  await pause(800)
  page.check('Alex’s library is empty, and its shelf offers the sample again', [await libraryGames(page), await shelfState('Pairs')], ['', 'Add to library'])
  await switchTo('Pascal')
  page.check('Pascal’s library is untouched, its sample still in it', [await libraryGames(page), await shelfState('Pairs')], ['Pairs 1.0', 'In your library'])
  page.check('the pictures Pascal’s sample uses are kept', (await page.evaluate(STORE_COUNTS)).assets, assetsOnce)

  await switchProfile(page)
  await askProfileRemoval(page, 'Pascal')
  page.check('removing Pascal says its library goes with it', await confirmation(), 'Remove Pascal? Its games and saves are deleted with it. Export it first to keep a copy.')
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(800)
  page.check('its games and the pictures nobody else uses are deleted', await page.evaluate(STORE_COUNTS), { assets: 0, chapters: 0, games: 0, profileChapters: 0, profileGames: 0 })

  // The games of an earlier Datajack go into every profile there is.
  await playProfile(page, 'Alex')
  await installGame(page, older)
  await switchTo('Kim')
  await page.evaluate(AS_EARLIER)
  await switchProfile(page)
  await page.reload()
  await page.waitFor('.profile-name')
  page.check('an earlier game is no longer where it was', (await page.evaluate(STORE_COUNTS)).games, 0)
  await playProfile(page, 'Alex')
  await page.waitFor('.game h2')
  page.check('Alex has the earlier game', await libraryGames(page), 'Diary 1.0')
  await switchTo('Kim')
  page.check('Kim, made before, has it too', await libraryGames(page), 'Diary 1.0')
  await switchTo('Lee')
  page.check('a profile made after starts empty', await libraryGames(page), '')
}
