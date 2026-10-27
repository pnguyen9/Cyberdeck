// Cyberdeck's desktop build: projects as folders in the documents folder, their files shown and
// previewed from there, kept across restarts, and deleted to the trash.
import { existsSync, readdirSync } from 'node:fs'
import { pause } from './harness.mjs'

export const app = 'cyberdeck-desktop'

export default async function check(page, { home, assets }) {
  const projectsFolder = `${home}/Documents/Cyberdeck`

  page.check('the projects screen says where projects are', await page.evaluate(`document.querySelector('.folder code')?.textContent`), projectsFolder)
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText('On disk')
  await page.clickButton('Create')
  await pause(1000)
  const projectIds = readdirSync(projectsFolder)
  page.check('a project is a folder named after its identifier', projectIds.length === 1 && /^[0-9a-f-]{36}$/.test(projectIds[0]), true)
  const projectFolder = `${projectsFolder}/${projectIds[0]}`
  page.check('holding project.json', existsSync(`${projectFolder}/project.json`), true)

  await page.clickButton('Use the sample story')
  await pause(400)
  await page.clickButton('Import', '.import-actions .button')
  await pause(1000)
  page.check('chapters are files in chapters/', readdirSync(`${projectFolder}/chapters`).length, 1)
  await page.clickButton('Cast & files', '.tab')
  await page.waitFor('.drop-zone .file-input')
  await page.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
  await pause(1500)
  page.check('files are kept in assets/ under their identifier', readdirSync(`${projectFolder}/assets`).length >= 6, true)
  page.check('and shown from there', await page.evaluate(`[...document.querySelectorAll('img.thumbnail')].filter(image => image.src.startsWith('cyberdeck://app/project-assets/') && image.complete && image.naturalWidth > 0).length >= 5`), true)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .text')
  await pause(800)
  page.check('the preview plays them', await page.evaluate(`[...document.querySelectorAll('.viewport .background')].some(element => getComputedStyle(element).backgroundImage.includes('cyberdeck://app/project-assets/'))`), true)
  await page.screenshot('desktop-preview')

  await page.restart()
  page.check('the project is there after a restart', await page.evaluate(`document.querySelector('.project-name')?.textContent`), 'On disk')
  await page.clickButton('Delete', '.link-button')
  await pause(200)
  page.check('deleting says the folder goes to the trash', (await page.evaluate(`document.querySelector('.confirmation p')?.textContent`))?.includes('goes to the trash'), true)
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(1500)
  page.check('the folder leaves the projects', readdirSync(projectsFolder).length, 0)
  page.check('and is in the trash', existsSync(`${home}/.local/share/Trash/files/${projectIds[0]}/project.json`), true)
}
