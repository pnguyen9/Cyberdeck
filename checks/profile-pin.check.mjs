// The PIN of a Datajack profile: setting it with the keyboard and the digits, the startup that never
// opens a locked profile without it, wrong PINs and the waits that grow, actions on the profile's data
// asking for it again, storage that refuses it, and changing or removing it.
import { createProfile, pause } from './harness.mjs'

export const app = 'datajack'

export default async function check(page, { url }) {
  const isDialogOpen = () => page.evaluate(`!!document.querySelector('.pin-dialog[open]')`)
  const inDialog = selector => page.evaluate(`document.querySelector('.pin-dialog ${selector}')?.textContent.trim() ?? null`)
  const problem = () => inDialog('#pin-problem p')
  const profileButton = () => page.evaluate(`document.querySelector('.profile-button')?.textContent.trim() ?? null`)
  const libraryMessage = () => page.evaluate(`document.querySelector('.library .message')?.textContent.trim() ?? null`)
  const pinRecord = () => page.evaluate(`Object.keys(localStorage).filter(key => key.startsWith('datajack:pin:')).map(key => localStorage.getItem(key)).join()`)
  const fieldLabel = () => inDialog('.pin-field span')
  const hint = () => inDialog('#pin-hint')
  const pinButton = () => page.evaluate(`(() => { const button = document.querySelector('.pin-button'); return button === null ? null : (button.querySelector('svg') === null ? '' : 'padlock ') + button.textContent.trim() })()`)
  /** Typed on the keyboard, in the field that has the focus, then sent with Enter. */
  const typePin = async pin => {
    await page.typeText(pin)
    await pause(200)
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await pause(500)
  }
  /** Tapped on the dialog's digits, then OK. */
  const tapPin = async pin => {
    for (const digit of pin) {
      await page.clickButton(digit, '.pin-dialog .key')
    }
    await page.clickButton('OK', '.pin-dialog .key')
    await pause(500)
  }
  /** Changes the kept lock as time, or a clock put back, would. */
  const setLock = fields => page.evaluate(`(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith('datajack:pin:'))
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), ...${JSON.stringify(fields)} }))
  })()`)
  const storedLock = () => page.evaluate(`(() => {
    const key = Object.keys(localStorage).find(candidate => candidate.startsWith('datajack:pin:'))
    return JSON.parse(localStorage.getItem(key))
  })()`)
  const switchProfile = async () => {
    await page.evaluate(`document.querySelector('.profile-button').click()`)
    await pause(500)
  }
  const chooseProfile = async index => {
    await page.evaluate(`document.querySelectorAll('.play-profile')[${index}].click()`)
    await pause(500)
  }
  const clickLink = async (text, index = 0) => {
    await page.evaluate(`[...document.querySelectorAll('.link-button')].filter(button => button.textContent.trim() === ${JSON.stringify(text)})[${index}].click()`)
    await pause(300)
  }

  await createProfile(page, url, 'Pascal')
  page.check('the library offers to add a PIN', await pinButton(), 'Add a PIN')
  await page.evaluate(`document.querySelector('.pin-button').click()`)
  await pause(400)
  page.check('the PIN dialog opens', await isDialogOpen(), true)
  page.check('it names the profile', await inDialog('h2'), 'Pascal’s PIN')
  page.check('the field has the focus', await page.evaluate(`document.activeElement?.classList.contains('pin-input')`), true)
  page.check('a new PIN is asked for first', await fieldLabel(), 'New PIN')
  page.check('the field is labelled', await page.evaluate(`document.querySelector('.pin-input').labels[0]?.textContent.trim()`), 'New PIN')
  page.check('it says what the PIN guards', await hint(), 'Choose 4 digits. Datajack will ask for them before opening Pascal’s profile and before erasing its saves or progress. Remember them: a forgotten PIN cannot be recovered.')
  page.check('with a mouse, the system offers its digits', await page.evaluate(`document.querySelector('.pin-input').inputMode`), 'numeric')
  page.check('no password field, so no password to save, but dots', await page.evaluate(`[document.querySelector('input[type=password]') === null, document.querySelector('.pin-input').type, document.querySelector('.pin-input').autocomplete, getComputedStyle(document.querySelector('.pin-input')).webkitTextSecurity]`), [true, 'text', 'off', 'disc'])
  page.check('no forgotten PIN to help with when choosing one', await page.evaluate(`!!document.querySelector('.pin-dialog .forgot')`), false)
  await page.screenshot('pin-choose')
  await page.typeText('1234')
  await pause(500)
  page.check('four digits are not sent on their own', [await fieldLabel(), await page.evaluate(`document.querySelector('.pin-dialog .key.confirm').disabled`)], ['New PIN', false])
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await pause(400)
  page.check('Enter asks for them again', await fieldLabel(), 'Confirm the PIN')
  page.check('with its own hint', await hint(), 'Enter the same 4 digits again, to be sure.')
  page.check('OK waits for four digits', await page.evaluate(`document.querySelector('.pin-dialog .key.confirm').disabled`), true)
  await tapPin('1235')
  page.check('two PINs that differ are refused', await problem(), 'The two PINs don’t match: try again.')
  page.check('then a new PIN is asked for again', await fieldLabel(), 'New PIN')
  await typePin('1234')
  await tapPin('1234')
  page.check('the PIN set closes the dialog', await isDialogOpen(), false)
  page.check('the library says so', await libraryMessage(), 'Pascal is now protected by a PIN.')
  page.check('the button shows the PIN is set', await pinButton(), 'padlock PIN')
  const record = await pinRecord()
  page.check('only a salted hash is kept', record.includes('"hash"') && record.includes('"salt"') && !record.includes('1234'), true)

  // Erasing the profile's saves and progress asks for the PIN again; erasing only the games, everyone's, does not.
  await clickLink('Erase what Datajack keeps…')
  await page.clickButton('Erase the games, the saves and the progress', '.button.danger')
  await pause(400)
  page.check('erasing the saves asks for the PIN', await hint(), 'Enter Pascal’s PIN to go on.')
  page.check('a forgotten PIN has its way out', await inDialog('.forgot summary'), 'Forgot the PIN?')
  await page.evaluate(`document.querySelector('.pin-dialog .forgot summary').click()`)
  await pause(200)
  page.check('in the browser, erasing its data', await inDialog('.forgot p'), 'Datajack cannot recover it. The only way out is to erase the data the browser keeps for Datajack, in the browser’s settings: every profile, save and game is erased with it.')
  await page.press('Escape')
  await pause(300)
  page.check('Escape closes the dialog', await isDialogOpen(), false)
  page.check('nothing is erased without the PIN', await libraryMessage(), 'Pascal is now protected by a PIN.')
  await page.clickButton('Erase the games, the saves and the progress', '.button.danger')
  await pause(400)
  await typePin('1234')
  page.check('with the PIN, it is erased', await libraryMessage(), 'Every game was erased, with the saves and the progress.')

  // At startup, a profile with a PIN never opens without it.
  await page.reload()
  await page.waitFor('.pin-dialog[open]')
  page.check('a restart asks for the PIN of the last profile', await hint(), 'Enter it to play as Pascal.')
  page.check('the library is not shown behind it', await page.evaluate(`!!document.querySelector('.library')`), false)
  await page.screenshot('pin-startup')
  await page.press('Escape')
  await pause(300)
  page.check('cancelled, the profiles are listed', await page.evaluate(`[...document.querySelectorAll('.profile-name')].map(element => element.textContent).join()`), 'Pascal')
  page.check('the list says which has a PIN, with a padlock', await page.evaluate(`(() => { const badge = document.querySelector('.play-profile .locked'); return [badge?.textContent.trim(), !!badge?.querySelector('svg[aria-hidden=true]')] })()`), ['Protected by a PIN', true])

  // Another profile, without a PIN, opens directly; Pascal's wrong PINs end in waits that grow.
  await page.evaluate(`document.querySelector('.new-profile .text-input').focus()`)
  await page.typeText('Alex')
  await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
  await pause(800)
  page.check('a profile without a PIN opens directly', await profileButton(), 'Alex · Switch profile')
  await switchProfile()
  await chooseProfile(0)
  page.check('switching to Pascal asks for the PIN', await isDialogOpen(), true)
  await typePin('0000')
  page.check('a wrong PIN says how many tries are left', await problem(), 'Wrong PIN. 4 more tries before a 30-second wait.')
  page.check('the field has the focus again', await page.evaluate(`document.activeElement?.classList.contains('pin-input')`), true)
  for (const pin of ['1111', '2222', '3333']) {
    await typePin(pin)
  }
  page.check('one try left', await problem(), 'Wrong PIN. 1 more try before a 30-second wait.')
  await typePin('4444')
  page.check('the fifth wrong PIN makes the player wait', await problem(), 'Too many wrong PINs: try again in 30\u00a0seconds.')
  page.check('said once, the ticking clock only seen', await page.evaluate(`(() => {
    const countdown = document.querySelector('#pin-problem .countdown')
    return [document.querySelectorAll('.pin-dialog [role=status]').length, countdown?.getAttribute('aria-hidden'), /^0:(30|29|28)$/.test(countdown?.textContent ?? '')]
  })()`), [1, 'true', true])
  page.check('the field waits too', await page.evaluate(`document.querySelector('.pin-input').disabled`), true)
  page.check('the digits wait too', await page.evaluate(`[...document.querySelectorAll('.pin-dialog .key')].every(key => key.disabled)`), true)
  await page.screenshot('pin-wait')
  // The wait, ended as 30 seconds would.
  await setLock({ waitUntil: 0 })
  await pause(600)
  page.check('after the wait, the field is back', await page.evaluate(`document.querySelector('.pin-input').disabled`), false)
  await typePin('5555')
  page.check('one more wrong PIN waits a minute', await problem(), 'Too many wrong PINs: try again in 1\u00a0minute.')
  // A clock put back a day leaves a wait a day long: it is shortened to the minute earned.
  await setLock({ waitUntil: Date.now() + 86_400_000 })
  await pause(600)
  const shortened = await storedLock()
  page.check('a wait longer than earned is shortened, and kept so', shortened.waitUntil - Date.now() <= 60_000, true)
  await setLock({ waitUntil: 0 })
  await pause(600)
  await typePin('6666')
  page.check('the next one waits 5 minutes', await problem(), 'Too many wrong PINs: try again in 5\u00a0minutes.')
  await setLock({ waitUntil: 0 })
  await pause(600)
  await tapPin('1234')
  page.check('the right PIN opens the profile', await profileButton(), 'Pascal · Switch profile')
  page.check('and starts the count again', [(await storedLock()).failures, (await storedLock()).waitUntil], [0, 0])

  // Renaming or removing a profile with a PIN asks for it; one without does not.
  await switchProfile()
  await clickLink('Rename', 0)
  page.check('renaming Pascal asks for the PIN', await isDialogOpen(), true)
  await typePin('1234')
  page.check('then the new name is asked for', await page.evaluate(`!!document.querySelector('.inline-form')`), true)
  await page.clickButton('Cancel', '.inline-form .button')
  await pause(200)
  await clickLink('Remove', 0)
  page.check('removing Pascal asks for the PIN', await isDialogOpen(), true)
  await page.press('Escape')
  await pause(300)
  page.check('cancelled, nothing is asked to confirm', await page.evaluate(`!!document.querySelector('.confirmation')`), false)
  await clickLink('Remove', 1)
  page.check('removing Alex asks for no PIN', [await isDialogOpen(), await page.evaluate(`document.querySelector('.confirmation p')?.textContent.trim()`)], [false, 'Remove Alex? Its saves are deleted with it.'])
  await page.clickButton('Cancel', '.confirmation .button')
  await pause(200)

  // Storage that refuses to keep the PIN says so, and the dialog is not stuck.
  await chooseProfile(0)
  await page.evaluate(`(() => { window.realSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('Full', 'QuotaExceededError') } })()`)
  await typePin('1234')
  page.check('a storage that cannot keep it says so', await problem(), 'Datajack could not read or keep the PIN: the browser’s storage may be full or blocked. Try again.')
  page.check('the dialog can still be used', await page.evaluate(`[document.querySelector('.pin-input').disabled, [...document.querySelectorAll('.pin-dialog .actions .button')].some(button => button.disabled)]`), [false, false])
  await page.evaluate(`Storage.prototype.setItem = window.realSetItem`)
  await typePin('1234')
  page.check('storage back, the PIN opens the profile', await profileButton(), 'Pascal · Switch profile')

  // Removing the PIN asks for the current one.
  await page.evaluate(`document.querySelector('.pin-button').click()`)
  await pause(400)
  page.check('a PIN set offers to change or remove it', await page.evaluate(`[...document.querySelectorAll('.pin-dialog .actions .button')].map(button => button.textContent.trim()).join()`), 'Change the PIN,Remove the PIN,Cancel')
  page.check('with its own hint', await hint(), 'Pascal is protected by a PIN. Changing or removing it asks for the current one first.')
  page.check('the choices are one under the other, full width', await page.evaluate(`(() => {
    const boxes = [...document.querySelectorAll('.pin-dialog .actions .button')].map(button => button.getBoundingClientRect())
    return boxes.every(box => box.width === boxes[0].width && box.left === boxes[0].left) && boxes[1].top > boxes[0].bottom
  })()`), true)
  await page.clickButton('Change the PIN', '.pin-dialog .button')
  await pause(300)
  page.check('changing it asks for the current PIN', [await fieldLabel(), await hint()], ['Current PIN', 'Enter the current PIN to change it.'])
  await page.press('Escape')
  await pause(300)
  await page.evaluate(`document.querySelector('.pin-button').click()`)
  await pause(400)
  await page.clickButton('Remove the PIN', '.pin-dialog .button')
  await pause(300)
  page.check('removing it asks for the current PIN', [await fieldLabel(), await hint()], ['Current PIN', 'Enter the current PIN to remove it.'])
  await typePin('9999')
  page.check('a wrong one does not remove it', await problem(), 'Wrong PIN. 4 more tries before a 30-second wait.')
  await typePin('1234')
  page.check('the right one removes it', await libraryMessage(), 'Pascal’s PIN was removed.')
  page.check('the button offers to add one again', await pinButton(), 'Add a PIN')
  page.check('nothing is kept of it', await pinRecord(), '')
  await switchProfile()
  await chooseProfile(0)
  page.check('Pascal opens directly again', [await isDialogOpen(), await profileButton()], [false, 'Pascal · Switch profile'])

  // On a phone, the digits fit, are large enough to tap, and the system's keyboard does not cover them.
  await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 700, deviceScaleFactor: 1, mobile: true })
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await page.evaluate(`document.querySelector('.pin-button').click()`)
  await pause(400)
  page.check('the dialog fits a phone', await page.evaluate(`document.querySelector('.pin-dialog').getBoundingClientRect().right <= 375`), true)
  page.check('the digits are large enough to tap', await page.evaluate(`[...document.querySelectorAll('.pin-dialog .key')].every(key => key.getBoundingClientRect().height >= 44)`), true)
  page.check('a touch screen opens no system keyboard', await page.evaluate(`[matchMedia('(pointer: coarse)').matches, document.querySelector('.pin-input').inputMode]`), [true, 'none'])
  await page.screenshot('pin-phone')
}
