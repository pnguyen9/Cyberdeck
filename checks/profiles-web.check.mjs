// Profiles in the web build of Datajack: the first start, the last profile opening directly,
// switching, names already taken, removal, and saves kept per profile.
import { createProjectWithSample, exportGame, installGame, pause } from './harness.mjs'

export const app = 'datajack'

export default async function check(page, { url, serve }) {
  const hasContinue = () => page.evaluate(`[...document.querySelectorAll('.button')].some(button => button.textContent.trim() === 'Continue')`)
  const profileButton = () => page.evaluate(`document.querySelector('.profile-button')?.textContent.trim()`)
  const submitNewProfile = async () => {
    await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
    await pause(500)
  }

  await createProjectWithSample(page, await serve('cyberdeck'), 'The Letter')
  const archive = await exportGame(page, 'The Letter.zip')

  await page.navigate(url)
  await page.waitFor('.new-profile')
  page.check('the first start asks for a profile', await page.evaluate(`document.querySelector('h2')?.textContent`), 'Create your profile')
  page.check('without a folder to choose on the web', await page.evaluate(`!!document.querySelector('.folder-choice')`), false)
  page.check('the name field has the focus', await page.evaluate(`document.activeElement?.classList.contains('text-input')`), true)
  await page.screenshot('profile-first-start')
  await page.typeText('Pascal')
  await submitNewProfile()
  page.check('creating it opens the library', await profileButton(), 'Pascal · Switch profile')

  await installGame(page, archive)
  await page.clickButton('Play', '.button')
  await page.waitFor('.viewport .text')
  await page.press(' ')
  await page.press(' ')
  await pause(300)
  await page.evaluate(`document.querySelector('.leave-button').click()`)
  await pause(500)
  page.check('Continue is offered from the autosave of the profile', await hasContinue(), true)

  await page.reload()
  await page.waitFor('.library')
  page.check('the last profile opens directly after a restart', await profileButton(), 'Pascal · Switch profile')

  await page.evaluate(`document.querySelector('.profile-button').click()`)
  await pause(500)
  page.check('switching lists the profiles', await page.evaluate(`[...document.querySelectorAll('.profile-name')].map(element => element.textContent).join()`), 'Pascal')
  await page.evaluate(`document.querySelector('.new-profile .text-input').focus()`)
  await page.typeText('pascal')
  await submitNewProfile()
  page.check('a name already taken is refused', await page.evaluate(`document.querySelector('.error')?.textContent`), 'Another profile is already named pascal.')
  await page.evaluate(`document.querySelector('.new-profile .text-input').select()`)
  await page.typeText('Alex')
  await submitNewProfile()
  await pause(300)
  page.check('a second profile has no Continue', await hasContinue(), false)
  await page.evaluate(`document.querySelector('.profile-button').click()`)
  await pause(500)
  await page.screenshot('profile-list')
  await page.evaluate(`[...document.querySelectorAll('.link-button')].filter(button => button.textContent === 'Remove')[1].click()`)
  await pause(200)
  page.check('removing asks first', await page.evaluate(`document.querySelector('.confirmation p')?.textContent.trim()`), 'Remove Alex? Its saves are deleted with it.')
  await page.evaluate(`document.querySelector('.button.danger').click()`)
  await pause(300)
  await page.evaluate(`document.querySelector('.play-profile').click()`)
  await pause(800)
  page.check('back on Pascal, Continue is still there', await hasContinue(), true)

  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 700, deviceScaleFactor: 1, mobile: true })
  await page.evaluate(`document.querySelector('.profile-button').click()`)
  await pause(500)
  page.check('no horizontal scroll at phone width', await page.evaluate(`document.documentElement.scrollWidth <= 375`), true)
  await page.screenshot('profile-phone')
}
