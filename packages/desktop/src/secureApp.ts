import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, type IpcMainInvokeEvent } from 'electron'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * The desktop shell both applications share. The page runs sandboxed, without Node, served from a
 * private scheme under a strict content security policy; navigation, new windows, web views and
 * permission requests are refused. It reaches the disk only through named channels, whose
 * arguments are checked before the handlers run: strings, bytes and lists of strings only, and
 * folders only when the user picked them in the system dialog.
 */

/** Serves a file under a path of the page's address, by the rest of the path; null for none. */
export interface FileRoute {
  prefix: string
  find: (rest: string) => Promise<{ path: string; mediaType: string } | null>
}

export type ChannelHandler = (event: IpcMainInvokeEvent, ...parameters: never[]) => Promise<unknown>

export interface ChannelContext {
  /** Opens the system folder picker; null when cancelled. Folders picked so become acceptable to `pickedFolder`. */
  chooseFolder: (event: IpcMainInvokeEvent, title: string) => Promise<string | null>
  /** Throws unless the user picked this folder in the dialog. */
  pickedFolder: (folder: string) => string
}

export interface SecureAppOptions {
  name: string
  scheme: string
  /** The page built by Vite. */
  pageFolder: string
  preloadPath: string
  backgroundColor: string
  /** Called once the application is ready, when its paths are known. */
  start: (context: ChannelContext) => { channels: Record<string, ChannelHandler>; routes?: FileRoute[] }
}

/** Images and sounds dropped in the page are `blob:` addresses, read back when exported. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

export function startSecureApp(options: SecureAppOptions) {
  const pageOrigin = `${options.scheme}://app`
  app.setName(options.name)
  app.enableSandbox()
  protocol.registerSchemesAsPrivileged([{ scheme: options.scheme, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

  if (!app.requestSingleInstanceLock()) {
    // A second copy writing the same files would race the first one.
    app.quit()
    return
  }
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    window?.restore()
    window?.focus()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', event => event.preventDefault())
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  })

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    const pickedFolders = new Set<string>()
    const { channels, routes = [] } = options.start({
      chooseFolder: async (event, title) => {
        const window = BrowserWindow.fromWebContents(event.sender)
        const dialogOptions: Electron.OpenDialogOptions = { title, properties: ['openDirectory', 'createDirectory'] }
        const result = window === null ? await dialog.showOpenDialog(dialogOptions) : await dialog.showOpenDialog(window, dialogOptions)
        const folder = result.canceled ? undefined : result.filePaths[0]
        if (folder === undefined) {
          return null
        }
        pickedFolders.add(folder)
        return folder
      },
      pickedFolder: folder => {
        if (!pickedFolders.has(folder)) {
          throw new Error('This folder was not picked in the system dialog')
        }
        return folder
      },
    })
    protocol.handle(options.scheme, request => serveFile(request, options.pageFolder, routes))
    registerChannels(channels, pageOrigin)
    openWindow(options, pageOrigin)
  })
}

function openWindow(options: SecureAppOptions, pageOrigin: string) {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    show: false,
    backgroundColor: options.backgroundColor,
    autoHideMenuBar: true,
    title: options.name,
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  void window.loadURL(`${pageOrigin}/index.html`)
}

/** Serves the page's files and the routes', and nothing else. */
async function serveFile(request: Request, pageFolder: string, routes: readonly FileRoute[]): Promise<Response> {
  const url = new URL(request.url)
  if (url.host !== 'app') {
    return notFound()
  }
  const route = routes.find(candidate => url.pathname.startsWith(candidate.prefix))
  if (route !== undefined) {
    const found = await route.find(decodeURIComponent(url.pathname.slice(route.prefix.length))).catch(() => null)
    return found === null ? notFound() : respondWithFile(found.path, { 'Content-Type': found.mediaType })
  }
  const path = resolve(pageFolder, `.${decodeURIComponent(url.pathname)}`)
  const pathInFolder = relative(pageFolder, path)
  if (pathInFolder.startsWith('..') || isAbsolute(pathInFolder)) {
    return notFound()
  }
  return respondWithFile(path === resolve(pageFolder) ? join(path, 'index.html') : path, {})
}

async function respondWithFile(path: string, headers: Record<string, string>): Promise<Response> {
  let file: Response
  try {
    file = await net.fetch(pathToFileURL(path).toString())
  } catch {
    return notFound()
  }
  const responseHeaders = new Headers(file.headers)
  Object.entries(headers).forEach(([name, value]) => responseHeaders.set(name, value))
  responseHeaders.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  return new Response(file.body, { status: file.status, headers: responseHeaders })
}

function notFound() {
  return new Response('Not found', { status: 404 })
}

function registerChannels(channels: Record<string, ChannelHandler>, pageOrigin: string) {
  for (const [channel, handler] of Object.entries(channels)) {
    ipcMain.handle(channel, (event, ...parameters: unknown[]) => {
      if (event.senderFrame?.origin !== pageOrigin) {
        throw new Error('Only the application page may call the desktop')
      }
      // Every handler declares the event and then its parameters, so its length tells how many it takes.
      if (parameters.length !== handler.length - 1 || !parameters.every(isPlainArgument)) {
        throw new Error(`Invalid arguments for ${channel}`)
      }
      return (handler as (event: IpcMainInvokeEvent, ...rest: unknown[]) => Promise<unknown>)(event, ...parameters)
    })
  }
}

function isPlainArgument(value: unknown): boolean {
  return typeof value === 'string' || value === null || value instanceof Uint8Array
    || (Array.isArray(value) && value.every(item => typeof item === 'string'))
}
