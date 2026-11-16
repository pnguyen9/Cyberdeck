/** The project's own pages: the only addresses the desktop page may open, in the system's browser. */
const PROJECT_PAGES = ['https://github.com/pnguyen9/Cyberdeck', 'https://pnguyen9.github.io/Cyberdeck/']

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
