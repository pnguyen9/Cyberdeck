/** What `keepOffline` needs of a service worker. */
export interface WorkerLike extends EventTarget {
  readonly state: string
  postMessage: (message: unknown) => void
}

/** What `keepOffline` needs of a registration. */
export interface RegistrationLike extends EventTarget {
  readonly installing: WorkerLike | null
  readonly waiting: WorkerLike | null
  update: () => Promise<unknown>
}

/** What `keepOffline` needs of `navigator.serviceWorker`. */
export interface WorkersLike extends EventTarget {
  readonly controller: unknown
  register: (scriptUrl: string) => Promise<RegistrationLike>
}

/** The message the service worker (`serviceWorker.js`) takes over on. */
export const TAKE_OVER = 'take-over'

/**
 * Registers the service worker that keeps the application's files on the device. When a new version
 * is online, its worker waits beside the running one: `offer` is told, with what makes it take over,
 * after which the page reloads with it. The first worker, the page having none, takes nothing over
 * and is not offered. Each time the page is shown again, the host is asked for a new version.
 */
export async function keepOffline(
  workers: WorkersLike,
  scriptUrl: string,
  offer: (takeOver: () => void) => void,
  reload: () => void,
  onShown: (check: () => void) => void,
): Promise<RegistrationLike> {
  let isTakingOver = false
  workers.addEventListener('controllerchange', () => {
    // Only the version the page asked for: the first worker also becomes the controller, without reloading.
    if (isTakingOver) {
      reload()
    }
  })
  const offerWorker = (worker: WorkerLike) => offer(() => {
    isTakingOver = true
    worker.postMessage(TAKE_OVER)
  })
  const followed = new WeakSet<WorkerLike>()
  const follow = (worker: WorkerLike | null) => {
    if (worker === null || followed.has(worker)) {
      return
    }
    followed.add(worker)
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && workers.controller != null) {
        offerWorker(worker)
      }
    })
  }

  const registration = await workers.register(scriptUrl)
  if (registration.waiting !== null && workers.controller != null) {
    offerWorker(registration.waiting)
  }
  follow(registration.installing)
  registration.addEventListener('updatefound', () => follow(registration.installing))
  onShown(() => {
    registration.update().catch(() => {
      // Offline, or the host is away: the version kept goes on.
    })
  })
  return registration
}
