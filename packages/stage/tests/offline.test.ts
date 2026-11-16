import { describe, expect, it } from 'vitest'
import { keepOffline, TAKE_OVER, type RegistrationLike, type WorkerLike, type WorkersLike } from '../src/app/offline'

class FakeWorker extends EventTarget implements WorkerLike {
  state = 'installing'
  readonly messages: unknown[] = []
  postMessage(message: unknown) {
    this.messages.push(message)
  }
  becomes(state: string) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

class FakeRegistration extends EventTarget implements RegistrationLike {
  installing: FakeWorker | null = null
  waiting: FakeWorker | null = null
  updates = 0
  update() {
    this.updates++
    return Promise.resolve()
  }
  found(worker: FakeWorker) {
    this.installing = worker
    this.dispatchEvent(new Event('updatefound'))
  }
}

class FakeWorkers extends EventTarget implements WorkersLike {
  controller: unknown = null
  registered: string[] = []
  constructor(readonly registration: FakeRegistration) {
    super()
  }
  register(scriptUrl: string) {
    this.registered.push(scriptUrl)
    return Promise.resolve(this.registration)
  }
  takeOver() {
    this.controller = {}
    this.dispatchEvent(new Event('controllerchange'))
  }
}

function setUp({ controlled }: { controlled: boolean }) {
  const registration = new FakeRegistration()
  const workers = new FakeWorkers(registration)
  if (controlled) {
    workers.controller = {}
  }
  const offers: (() => void)[] = []
  let reloads = 0
  let shown = () => {}
  const started = keepOffline(workers, './sw.js', takeOver => offers.push(takeOver), () => reloads++, check => {
    shown = check
  })
  return { registration, workers, offers, reloads: () => reloads, shown: () => shown(), started }
}

describe('keeping the application offline', () => {
  it('registers the service worker of the page’s folder', async () => {
    const { workers, started } = setUp({ controlled: false })
    await started
    expect(workers.registered).toEqual(['./sw.js'])
  })

  it('offers nothing for the first worker, and does not reload when it takes control', async () => {
    const { registration, workers, offers, reloads, started } = setUp({ controlled: false })
    await started
    const first = new FakeWorker()
    registration.found(first)
    first.becomes('installed')
    first.becomes('activated')
    workers.takeOver()
    expect(offers).toHaveLength(0)
    expect(reloads()).toBe(0)
  })

  it('offers a new version once installed, and reloads only after it took over', async () => {
    const { registration, workers, offers, reloads, started } = setUp({ controlled: true })
    await started
    const next = new FakeWorker()
    registration.found(next)
    expect(offers).toHaveLength(0)
    next.becomes('installed')
    expect(offers).toHaveLength(1)
    offers[0]?.()
    expect(next.messages).toEqual([TAKE_OVER])
    expect(reloads()).toBe(0)
    workers.takeOver()
    expect(reloads()).toBe(1)
  })

  it('offers a version already waiting when the page opens', async () => {
    const registration = new FakeRegistration()
    const waiting = new FakeWorker()
    waiting.state = 'installed'
    registration.waiting = waiting
    const workers = new FakeWorkers(registration)
    workers.controller = {}
    const offers: (() => void)[] = []
    await keepOffline(workers, './sw.js', takeOver => offers.push(takeOver), () => {}, () => {})
    expect(offers).toHaveLength(1)
    offers[0]?.()
    expect(waiting.messages).toEqual([TAKE_OVER])
  })

  it('follows a worker once, however it is found', async () => {
    const registration = new FakeRegistration()
    const next = new FakeWorker()
    registration.installing = next
    const workers = new FakeWorkers(registration)
    workers.controller = {}
    const offers: (() => void)[] = []
    await keepOffline(workers, './sw.js', takeOver => offers.push(takeOver), () => {}, () => {})
    registration.found(next)
    next.becomes('installed')
    expect(offers).toHaveLength(1)
  })

  it('asks the host for a new version each time the page is shown again', async () => {
    const { registration, shown, started } = setUp({ controlled: true })
    await started
    shown()
    shown()
    expect(registration.updates).toBe(2)
  })
})
