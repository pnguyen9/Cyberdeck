import { describe, expect, it } from 'vitest'
import type { DesktopBridge } from '../../electron/bridge'
import { createDesktopProfileStore } from '../../src/profiles/desktopProfileStore'
import { someSave } from '../someSave'

/** Answers like the main process would, recording the calls. */
function fakeBridge(answer: (channel: string, parameters: unknown[]) => unknown) {
  const calls: [string, unknown[]][] = []
  const bridge = {
    invoke: async (channel: string, ...parameters: unknown[]) => {
      calls.push([channel, parameters])
      return answer(channel, parameters)
    },
  } as DesktopBridge
  return { bridge, calls }
}

describe('createDesktopProfileStore', () => {
  it('passes each call to the main process', async () => {
    const { bridge, calls } = fakeBridge(() => undefined)
    const store = createDesktopProfileStore(bridge)

    await store.create('Pascal', '/home/pascal/Saves')
    await store.changeSaveFolder('profile-1', '/mnt/shared')

    expect(calls).toEqual([
      ['profiles:create', ['Pascal', '/home/pascal/Saves']],
      ['profiles:changeSaveFolder', ['profile-1', '/mnt/shared']],
    ])
  })

  it('shows the player the message of an error, without the channel Electron prefixes', async () => {
    const { bridge } = fakeBridge(() => {
      throw new Error("Error invoking remote method 'profiles:create': Error: Another profile is already named Pascal.")
    })
    await expect(createDesktopProfileStore(bridge).create('Pascal', null)).rejects.toThrow(/^Another profile is already named Pascal\.$/)
  })

  it('writes saves as readable JSON and validates what it reads', async () => {
    const files = new Map<string, string>()
    const { bridge } = fakeBridge((channel, parameters) => {
      const key = parameters.slice(0, 3).join('/')
      if (channel === 'saves:write') {
        files.set(key, parameters[3] as string)
        return undefined
      }
      return files.get(key) ?? null
    })
    const saves = createDesktopProfileStore(bridge).saveStore('profile-1')
    const save = someSave()

    expect(await saves.write('game', '1', save)).toBe(true)
    expect(files.get('profile-1/game/1')).toContain('\n  "saveFormat": 1')
    expect(await saves.read('game', '1')).toEqual(save)

    files.set('profile-1/game/2', '{"saveFormat": 1}')
    expect(await saves.read('game', '2')).toBeNull()
  })

  it('reports a failed write instead of throwing', async () => {
    const { bridge } = fakeBridge(() => {
      throw new Error('ENOSPC: no space left on device')
    })
    expect(await createDesktopProfileStore(bridge).saveStore('profile-1').write('game', '1', someSave())).toBe(false)
  })

  it('keeps the progress of a game beside its saves', async () => {
    const files = new Map<string, string>()
    const { bridge } = fakeBridge((channel, parameters) => {
      const key = parameters.slice(0, 3).join('/')
      if (channel === 'saves:write') {
        files.set(key, parameters[3] as string)
        return undefined
      }
      return files.get(key) ?? null
    })
    const saves = createDesktopProfileStore(bridge).saveStore('profile-1')
    const progress = { progressFormat: 1 as const, game: { id: 'game', name: 'Game' }, points: [], endingIds: ['ending-1'], memoryIds: ['memory-1'], readPageIds: ['page-1'], illustrationIds: ['illustration-1'] }

    expect(await saves.readProgress('game')).toBeNull()
    expect(await saves.writeProgress('game', progress)).toBe(true)
    expect([...files.keys()]).toEqual(['profile-1/game/progress'])
    expect(await saves.readProgress('game')).toEqual(progress)
  })
})
