// Each profile has its own library in Datajack's desktop build: a folder of games per profile, the
// asset files two profiles have stored once; removing a game from one library leaves the other's, and
// removing a profile deletes its folder and the files nobody else uses, while its saves stay; the games
// installed before each profile had its own library go into every profile, after a restart too.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { askProfileRemoval, exportSampleGame, installGame, libraryGames, newProfile, pause, playProfile, switchProfile, switchTo } from './harness.mjs'

export const app = 'datajack-desktop'

export default async function check(page, { home, output, assets, serve }) {
  const archive = await exportSampleGame(`${output}/cyberdeck`, await serve('cyberdeck'), assets)
  const libraryFolder = `${home}/.config/Datajack/library`
  const profileIdOf = name => JSON.parse(readFileSync(`${home}/.config/Datajack/profiles.json`, 'utf8')).profiles.find(profile => profile.name === name).id
  const gamesOf = name => {
    const folder = `${libraryFolder}/profiles/${profileIdOf(name)}/games`
    return existsSync(folder) ? readdirSync(folder) : []
  }
  const assetCount = () => readdirSync(`${libraryFolder}/assets`).length
  const remove = async () => {
    await page.clickButton('Remove', '.link-button')
    await pause(200)
    await page.evaluate(`document.querySelector('.game .confirmation .button.danger').click()`)
    await pause(1000)
  }

  await newProfile(page, 'Pascal')
  await installGame(page, archive)
  const assetsOnce = assetCount()
  await switchTo(page, 'Alex')
  page.check('a new profile starts with an empty library', await libraryGames(page), '')
  await installGame(page, archive)
  page.check('Alex installs the same game, as any new game', [await libraryGames(page), await page.statusText()], ['The Letter 1.0', 'The Letter 1.0 installed.'])
  page.check('each profile has its folder of games', [gamesOf('Pascal').length, gamesOf('Alex').length], [1, 1])
  page.check('the asset files both have are stored once', assetCount(), assetsOnce)

  await remove()
  page.check('removing it from Alex’s library deletes Alex’s copy only', [gamesOf('Alex').length, gamesOf('Pascal').length, assetCount()], [0, 1, assetsOnce])
  await switchTo(page, 'Pascal')
  page.check('Pascal still has it', await libraryGames(page), 'The Letter 1.0')
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await pause(500)
  await page.press(' ')
  await pause(500)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(800)

  await switchProfile(page)
  const pascalId = profileIdOf('Pascal')
  await askProfileRemoval(page, 'Pascal')
  const saveFolder = `${home}/Documents/Datajack/Pascal`
  page.check('removing Pascal says the saves stay and the library goes', await page.evaluate(`document.querySelector('.confirmation p')?.textContent.trim()`), `Remove Pascal? Its games are deleted; its saves stay in ${saveFolder}. Export it first to keep a copy.`)
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(800)
  page.check('its library folder is deleted, with the files nobody else uses', [existsSync(`${libraryFolder}/profiles/${pascalId}`), assetCount()], [false, 0])
  page.check('its saves stay in their folder', readdirSync(saveFolder).length, 1)

  // The games of an earlier Datajack, in `games/`, go into every profile there is.
  await playProfile(page, 'Alex')
  await installGame(page, archive)
  await switchTo(page, 'Kim')
  const [gameId] = gamesOf('Alex')
  mkdirSync(`${libraryFolder}/games`, { recursive: true })
  renameSync(`${libraryFolder}/profiles/${profileIdOf('Alex')}/games/${gameId}`, `${libraryFolder}/games/${gameId}`)
  await page.restart()
  page.check('after a restart, the earlier game is copied into every profile, then removed', [gamesOf('Alex'), gamesOf('Kim'), readdirSync(`${libraryFolder}/games`)], [[gameId], [gameId], []])
  page.check('Kim, opened last, plays it', await libraryGames(page), 'The Letter 1.0')
}
