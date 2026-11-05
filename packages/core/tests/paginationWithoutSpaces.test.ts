import { describe, expect, it } from 'vitest'
import { paginate, wrapLines } from '../src/index'

const measure = (text: string) => [...text].length

describe('languages written without spaces', () => {
  it('break their lines between words, never before a closing mark nor after an opening one', () => {
    const text = '「今日は雨が降っています。」と彼女は言った。窓の外を見ると、街は静かだった。'
    const lines = wrapLines(text, 12, measure, 'ja')
    expect(lines.join('')).toBe(text)
    expect(lines.every(line => measure(line) <= 12)).toBe(true)
    expect(lines.some(line => /^[、。」]/.test(line))).toBe(false)
    expect(lines.some(line => /「$/.test(line))).toBe(false)
  })

  it('are cut into pages that fit, where breaking at spaces alone would leave one line too long', () => {
    const text = '我们走过长长的街道，看着灯光一盏一盏地亮起来，直到夜色完全降临在这座安静的城市上空。'
    const pages = paginate(text, { lineWidth: 10, maxLines: 2, measureText: measure }, 'zh')
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.every(page => wrapLines(text.slice(page.start, page.end).trim(), 10, measure, 'zh').length <= 2)).toBe(true)
    expect(wrapLines(text, 10, measure, 'en')).toEqual([text])
  })
})
