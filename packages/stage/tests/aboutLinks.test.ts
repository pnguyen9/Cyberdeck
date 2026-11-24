import { describe, expect, it } from 'vitest'
import { aboutLinksOf } from '../src/app/aboutApp'

describe('the links of the About panel', () => {
  const ways = ['desktop', 'files', 'web', 'installed'] as const

  it('link to the downloads from a build that does not update itself: the desktop one and the files', () => {
    expect(ways.map(how => aboutLinksOf('downloads', how))).toEqual(['downloads', 'downloads', 'none', 'none'])
  })

  it('link to the project however the page runs, or to nothing when none are asked for', () => {
    expect(ways.map(how => aboutLinksOf('project', how))).toEqual(['project', 'project', 'project', 'project'])
    expect(ways.map(how => aboutLinksOf('none', how))).toEqual(['none', 'none', 'none', 'none'])
  })
})
