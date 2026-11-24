import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GUIDE_ADDRESS, REPOSITORY_ADDRESS, SITE_ADDRESS } from '../../stage/src/app/projectAddresses.js'

/** The project's own pages: the only addresses the desktop page may open, in the system's browser. */
const PROJECT_PAGES = [REPOSITORY_ADDRESS, SITE_ADDRESS]

/** Whether an address is one of the project's pages, or under one, over HTTPS, without a user name. */
export function isProjectLink(address: string): boolean {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return false
  }
  const page = `${url.origin}${url.pathname}`
  return url.protocol === 'https:' && url.username === '' && url.password === ''
    && PROJECT_PAGES.some(project => page === project || page.startsWith(project.endsWith('/') ? project : `${project}/`))
}

/**
 * What opens in the system's browser for a link the page asks to open: for the online guide, the copy
 * packaged with the application, read offline and of the application's own version, when there is
 * one (`guideFolder`); any other project page as it is; null for anything else.
 */
export function addressToOpen(address: string, guideFolder: string | null): string | null {
  if (!isProjectLink(address)) {
    return null
  }
  const url = new URL(address)
  if (guideFolder === null || ![GUIDE_ADDRESS, `${GUIDE_ADDRESS}index.html`].includes(`${url.origin}${url.pathname}`)) {
    return address
  }
  const copy = pathToFileURL(join(guideFolder, 'index.html'))
  copy.hash = url.hash
  return copy.href
}
