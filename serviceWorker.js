// The service worker of the web build, written by hand: webBuild.ts puts CACHE_PREFIX, CACHE_NAME,
// FILES and TAKE_OVER (the page's message, from the stage's offline.ts) before this code. It keeps
// every file of the release on the device, so that the application opens offline, and answers from
// them first. A new release waits beside the running one until the page, asked by the player or
// author, tells it to take over; then the older release's files go.
/* global CACHE_PREFIX, CACHE_NAME, FILES, TAKE_OVER */

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES.map(path => new Request(path, { cache: 'reload' })))))
})

self.addEventListener('activate', event => {
  // Only this application's older releases: the other application, beside it on the same site, keeps its own.
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))))
    .then(() => self.clients.claim()))
})

self.addEventListener('message', event => {
  if (event.data === TAKE_OVER) {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return
  }
  // The page itself, whatever its address in the application's folder, is its index.html.
  const kept = request.mode === 'navigate' ? 'index.html' : request
  event.respondWith(caches.open(CACHE_NAME)
    .then(cache => cache.match(kept, { ignoreSearch: true }))
    .then(response => response ?? fetch(request)))
})
