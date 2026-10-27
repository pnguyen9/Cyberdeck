// Drives headless Chrome, or an Electron application, through the DevTools Protocol, without dependencies: what the browser checks share.
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

export const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const KEY_CODES = { Backspace: 8, Tab: 9, Enter: 13, Escape: 27, ' ': 32, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, '?': 191 }
/** `KeyboardEvent.code` of the keys that are neither letters nor named keys: the player reads codes. */
const PHYSICAL_CODES = { ' ': 'Space', '?': 'Slash' }

/** Waits for the first page of a DevTools endpoint and connects to it; null if none comes. */
async function connect(port, attempts) {
  let targets = []
  for (let attempt = 0; attempt < attempts && targets.length === 0; attempt++) {
    await pause(200)
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(target => target.type === 'page')
    } catch {
      // The browser is still starting.
    }
  }
  if (targets.length === 0) {
    return null
  }
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve))
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    pending.get(message.id)?.(message)
  })
  const send = (method, params = {}) => new Promise(resolve => {
    const id = nextId++
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
  await send('Page.enable')
  await send('DOM.enable')
  return { socket, send }
}

/** What a check does with a page, over a connection that restarting an application replaces. */
function createPage(outputDirectory, connection, stop) {
  const results = []
  const send = (method, params) => connection.send(method, params)
  const page = {
    send,
    results,
    evaluate: async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value,
    check: (name, actual, expected) => {
      const isPassed = JSON.stringify(actual) === JSON.stringify(expected)
      results.push(`${isPassed ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(actual)}${isPassed ? '' : ` (expected ${JSON.stringify(expected)})`}`)
    },
    navigate: async url => {
      await send('Page.navigate', { url })
      await pause(1500)
    },
    reload: async () => {
      await send('Page.reload')
      await pause(1500)
    },
    /** Waits until an element matches, for pages still loading or reloading. */
    waitFor: async (selector, timeoutMilliseconds = 15000) => {
      for (let waited = 0; waited < timeoutMilliseconds; waited += 100) {
        if (await page.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) {
          return true
        }
        await pause(100)
      }
      throw new Error(`Nothing matches ${selector}`)
    },
    typeText: text => send('Input.insertText', { text }),
    /**
     * A key as the keyboard sends it, to the element that has the focus. `commands` are the editing
     * commands Chrome runs for the key, such as `undo`, which synthetic key events do not trigger.
     */
    press: async (key, { ctrl = false, shift = false, alt = false, commands = [] } = {}) => {
      const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0)
      const windowsVirtualKeyCode = KEY_CODES[key] ?? key.toUpperCase().charCodeAt(0)
      const code = PHYSICAL_CODES[key] ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key)
      const text = key.length === 1 && !ctrl ? key : undefined
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers, ...(text === undefined ? {} : { text }), ...(commands.length === 0 ? {} : { commands }) })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers })
      await pause(150)
    },
    /** Drags an element onto another, by the events a mouse drag fires; `side` picks the half of the target dropped on. */
    drag: async (sourceSelector, targetSelector, side = 'before') => {
      await page.evaluate(`(() => {
        const source = document.querySelector(${JSON.stringify(sourceSelector)})
        const target = document.querySelector(${JSON.stringify(targetSelector)})
        const rect = target.getBoundingClientRect()
        const clientX = ${JSON.stringify(side)} === 'before' ? rect.left + 2 : rect.right - 2
        const dataTransfer = new DataTransfer()
        const fire = (element, type) => element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, clientX, clientY: rect.top + 2 }))
        fire(source, 'dragstart')
        fire(target, 'dragover')
        fire(target, 'drop')
        fire(source, 'dragend')
      })()`)
      await pause(300)
    },
    setFiles: async (selector, files) => {
      const { result: { root } } = await send('DOM.getDocument', { depth: -1 })
      const { result: { nodeId } } = await send('DOM.querySelector', { nodeId: root.nodeId, selector })
      await send('DOM.setFileInputFiles', { nodeId, files })
    },
    /** Sets a field as typing would, firing `input` or the event named. */
    setValue: (selector, value, eventName = 'input') => page.evaluate(`(() => {
      const field = document.querySelector(${JSON.stringify(selector)})
      field.value = ${JSON.stringify(value)}
      field.dispatchEvent(new Event(${JSON.stringify(eventName)}))
      return true
    })()`),
    clickButton: (text, selector = 'button') => page.evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(candidate => candidate.textContent.trim() === ${JSON.stringify(text)}); button?.click(); return button !== undefined })()`),
    statusText: () => page.evaluate(`document.querySelector('[role=status]')?.textContent ?? document.querySelector('[role=alert]')?.textContent ?? null`),
    /** Saves what the last link matching the selector offers to download, and returns its path. */
    saveDownload: async (fileName, selector = '.download') => {
      const base64 = await page.evaluate(`fetch([...document.querySelectorAll(${JSON.stringify(selector)})].at(-1).href).then(response => response.arrayBuffer()).then(buffer => {
        const bytes = new Uint8Array(buffer)
        let text = ''
        for (let index = 0; index < bytes.length; index += 8192) text += String.fromCharCode(...bytes.subarray(index, index + 8192))
        return btoa(text)
      })`)
      const path = `${outputDirectory}/${fileName}`
      writeFileSync(path, Buffer.from(base64, 'base64'))
      return path
    },
    /** Starts noting the content security policy violations of the page, until it is left. */
    watchViolations: () => page.evaluate(`window.violations ??= []; document.addEventListener('securitypolicyviolation', event => window.violations.push(event.violatedDirective + ' ' + event.blockedURI)); true`),
    violations: () => page.evaluate(`JSON.stringify(window.violations ?? null)`),
    screenshot: async name => {
      const { result } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${outputDirectory}/${name}.png`, Buffer.from(result.data, 'base64'))
    },
    close: async () => {
      writeFileSync(`${outputDirectory}/results.txt`, results.join('\n') + '\n')
      connection.socket.close()
      await stop()
    },
  }
  return page
}

/** Opens a page in a new Chrome with an empty profile, kept in the output folder of the check. */
export async function openBrowser(outputDirectory, port) {
  rmSync(`${outputDirectory}/profile`, { recursive: true, force: true })
  mkdirSync(outputDirectory, { recursive: true })
  const chrome = spawn(process.env.CHROME ?? 'google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,720', '--hide-scrollbars', `--user-data-dir=${outputDirectory}/profile`, 'about:blank'], { stdio: 'ignore' })
  const connection = await connect(port, 50)
  if (connection === null) {
    chrome.kill()
    throw new Error(`Chrome did not answer on port ${port}`)
  }
  return createPage(outputDirectory, connection, async () => {
    chrome.kill()
  })
}

/**
 * Starts a built desktop application headless, with `home` as its home folder, where its settings
 * and documents land. `page.restart()` quits it and starts it again, as its user would.
 */
export async function openElectron(outputDirectory, port, { electron, appFolder, home }) {
  mkdirSync(outputDirectory, { recursive: true })
  mkdirSync(`${home}/Documents`, { recursive: true })
  mkdirSync(`${home}/.config`, { recursive: true })
  writeFileSync(`${home}/.config/user-dirs.dirs`, 'XDG_DOCUMENTS_DIR="$HOME/Documents"\n')
  // Inherited from VS Code's terminal, this setting would start Electron as plain Node.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...environment } = process.env
  let application = null
  const start = async () => {
    application = spawn(electron, [appFolder, '--ozone-platform=headless', `--remote-debugging-port=${port}`], {
      env: { ...environment, HOME: home, XDG_CONFIG_HOME: `${home}/.config`, XDG_DATA_HOME: `${home}/.local/share` },
      stdio: 'ignore',
    })
    const started = await connect(port, 75)
    if (started === null) {
      application.kill()
      throw new Error(`${appFolder} did not answer on port ${port}`)
    }
    await pause(1500)
    return started
  }
  const stop = async () => {
    if (application !== null && application.exitCode === null && application.signalCode === null) {
      const exited = new Promise(resolve => application.once('exit', resolve))
      application.kill()
      await exited
    }
  }
  const connection = { ...await start() }
  const page = createPage(outputDirectory, connection, stop)
  page.restart = async () => {
    connection.socket.close()
    await stop()
    Object.assign(connection, await start())
  }
  return page
}

/** Creates a project from the projects page, leaving its Import tab open. */
export async function createProject(page, url, name) {
  await page.navigate(url)
  await page.waitFor('.new-project .text-input')
  await page.evaluate(`document.querySelector('.new-project .text-input').focus()`)
  await page.typeText(name)
  await page.clickButton('Create')
  await page.waitFor('.import .source')
}

/** Creates a project from the projects page and imports a story into it, leaving the Import tab open. */
export async function createProjectWithStory(page, url, name, story) {
  await createProject(page, url, name)
  await page.evaluate(`document.querySelector('.import .source').focus()`)
  await page.typeText(story)
  await pause(500)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
}

/** Creates a project holding the sample story Cyberdeck offers, leaving its Chapters tab open. */
export async function createProjectWithSample(page, url, name) {
  await createProject(page, url, name)
  await page.clickButton('Use the sample story')
  await pause(400)
  await page.clickButton('Import', '.import-actions .button')
  await pause(800)
}

/** Exports the open project as a game from its Export tab, and returns the path of the archive. */
export async function exportGame(page, fileName) {
  await page.clickButton('Export', '.tab')
  await pause(300)
  await page.clickButton('Export', '.export .button')
  await page.waitFor('.export .download')
  return page.saveDownload(fileName, '.export .download')
}

/** Creates a profile on Datajack's first start, which opens the library. */
export async function createProfile(page, url, name) {
  await page.navigate(url)
  await page.waitFor('.new-profile .text-input')
  await page.evaluate(`document.querySelector('.new-profile .text-input').focus()`)
  await page.typeText(name)
  await page.evaluate(`document.querySelector('.new-profile button[type=submit]').click()`)
  await pause(800)
}

/** Adds a game archive to Datajack's library. */
export async function installGame(page, archivePath) {
  await page.setFiles('.add-button .file-input', [archivePath])
  await pause(2000)
}

/** What the player shows: the text of the page, `CHOICE` for options, the end screen's text, or `NONE`. */
export function shownStep(page) {
  return page.evaluate(`document.querySelector('.viewport .end-screen')?.innerText
    ?? document.querySelector('.viewport .text')?.textContent
    ?? (document.querySelector('.viewport .option') ? 'CHOICE' : 'NONE')`)
}

/** What the typewriter has shown of the page so far: the text box's runs not hidden yet. */
export function visibleText(page) {
  return page.evaluate(`[...document.querySelectorAll('.viewport .text span:not(.not-yet-shown)')].map(run => run.textContent).join('')`)
}

/** Presses Space in the player until the condition holds for what it shows, at most `limit` times. */
export async function advanceUntil(page, condition, limit = 20) {
  for (let press = 0; press < limit && !condition(await shownStep(page)); press++) {
    await page.press(' ')
  }
}

/**
 * Makes "The Letter" in Cyberdeck, in a Chrome of its own: the sample story with the test assets and
 * Rooftop.svg as its cover, exported as a game. Returns the path of the archive.
 */
export async function exportSampleGame(outputDirectory, cyberdeckUrl, assets, port = 9336) {
  const browser = await openBrowser(outputDirectory, port)
  try {
    await createProjectWithSample(browser, cyberdeckUrl, 'The Letter')
    await browser.clickButton('Cast & files', '.tab')
    await browser.waitFor('.drop-zone .file-input')
    await browser.setFiles('.drop-zone .file-input', readdirSync(assets).map(fileName => `${assets}/${fileName}`))
    await pause(1000)
    await browser.clickButton('Details', '.tab')
    await browser.waitFor('.cover-actions input[type=file]')
    await browser.setFiles('.cover-actions input[type=file]', [`${assets}/Rooftop.svg`])
    await pause(800)
    return await exportGame(browser, 'The Letter 1.0.zip')
  } finally {
    await browser.close()
  }
}
