import { describe, expect, it } from 'vitest'
import { importText } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const problemCodes = (lines: string[]) => importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' }).problems.map(problem => `${problem.code} ${problem.line}`)

describe('reading flow', () => {
  it('takes a loop that plays a scene which always ends for one with a way out', () => {
    expect(problemCodes(['[loop]', 'Again.', '[play: Bad]', '[end]', '# Scene: Bad', 'Too late.', '[ending: Bad]'])).toEqual([])
  })

  it('reports a loop nothing leaves, and what follows a scene that always ends', () => {
    expect(problemCodes(['[loop]', 'Again.', '[end]', 'After.'])).toEqual(['endlessLoop 1', 'unreachable 4'])
    expect(problemCodes(['[play: Bad]', 'After.', '# Scene: Bad', '[ending: Bad]'])).toEqual(['unreachable 2'])
  })
})
