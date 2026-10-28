import { describe, expect, it } from 'vitest'
import {
  applyImport,
  checkAuthorCss,
  createProject,
  flattenStoredNodes,
  pagesTooLong,
  previewImport,
  styleClassName,
  type ProjectDocument,
} from '../src/index'
import { monospaceLayout } from './monospaceLayout'

describe('checkAuthorCss', () => {
  it('keeps the looks of text, renames classes and keyframes so they touch nothing else', () => {
    const checked = checkAuthorCss(`
      /* A ghost's voice. */
      .ghost, .echo { color: #8af; text-shadow: 0 0 6px #8af; animation: drift 2s infinite !important; }
      @keyframes drift { from { opacity: 0.4 } 50% { opacity: 1; transform: translateY(-2px) } }
    `)
    expect(checked.dropped).toEqual([])
    expect(checked.classes).toEqual(['ghost', 'echo'])
    expect(checked.css).toBe([
      '.author-ghost, .author-echo { color: #8af; text-shadow: 0 0 6px #8af; animation: author-drift 2s infinite; }',
      '@keyframes author-drift { from { opacity: 0.4; } 50% { opacity: 1; transform: translateY(-2px); } }',
    ].join('\n'))
  })

  it('leaves out whatever could load, run, move out of the text or reach the player, and says why', () => {
    const checked = checkAuthorCss(`
      .a { background: url(https://example.com/x.png); position: fixed; color: red }
      .b { font-family: var(--player-font); display: block; font-size: 3em }
      @import "evil.css";
      button, .c:hover { color: red }
      .d { color: red
    `)
    expect(checked.css).toBe('.author-a { color: red; }')
    // The rules are read first, then their properties checked.
    expect(checked.dropped.map(entry => entry.reason)).toEqual([
      'a brace is never closed',
      'nothing may be loaded or computed: no url(), var(), attr(), @, \\ or quotes but around font names',
      'not a property of how text looks',
      'nothing may be loaded or computed: no url(), var(), attr(), @, \\ or quotes but around font names',
      'text stays in its line: display is inline or inline-block',
      'font-size in em or %, at most 1.5em, for the text to fit the box',
      'only class names are styled here: .ghost, or .ghost, .whisper',
    ])
  })

  it('names classes as styles are named, and adds up the rules on one class', () => {
    const checked = checkAuthorCss('.Ghost { color: red } .ghost { letter-spacing: 0.25em } .ghost { font-size: 1.2em }')
    expect(checked.classes).toEqual(['ghost'])
    expect(checked.css).toContain('.author-ghost { color: red; }')
    expect(checked.widthScales.get('ghost')).toBeCloseTo(1.8)
  })

  it('measures only what pages can be cut for, and keeps font names quoted', () => {
    const checked = checkAuthorCss(`.a { letter-spacing: .1em; padding: 0 0.2em; font-family: "Times New Roman", serif }
      .b { padding: 2em; letter-spacing: 1rem; border: 3px solid red; color: "red }`)
    expect(checked.css).toBe('.author-a { letter-spacing: .1em; padding: 0 0.2em; font-family: "Times New Roman", serif; }\n.author-b { border: 3px solid red; }')
    expect(checked.dropped.map(entry => entry.reason)).toEqual([
      'padding in em or px, at most 0.25em, for the text to fit its line',
      'letter-spacing in em or px, for the pages to be cut to fit',
      'nothing may be loaded or computed: no url(), var(), attr(), @, \\ or quotes but around font names',
    ])
  })

  it('tells how much wider a class draws text', () => {
    expect([...checkAuthorCss('.shout { font-size: 1.4em } .wide { letter-spacing: 0.1em } .plain { color: red }').widthScales]).toEqual([['shout', 1.4], ['wide', 1.2]])
    expect(styleClassName('Chapter Title')).toBe('chapter-title')
  })
})

describe('CSS classes as styles', () => {
  const project = (css: string): ProjectDocument => ({ ...createProject({ name: 'Game', locale: 'en' }), css })
  const layout = { ...monospaceLayout }

  it('lets the text use a class of the CSS without declaring it, as a style of its own', () => {
    const owner = project('.ghost { color: #8af }')
    const preview = previewImport('— Marie: [style: ghost]Boo.[style: none]', owner, layout)
    expect(preview.problems).toEqual([])
    const applied = applyImport(preview, owner, [], { type: 'newChapters' }, { fileName: null })
    expect(applied.project.styles).toEqual([{ id: expect.any(String), name: 'ghost', properties: [], implicit: true }])
    expect(previewImport('[style: phantom]Boo.', owner, layout).problems.map(problem => problem.code)).toEqual(['unknownStyle'])
  })

  it('cuts a paragraph holding a larger style as if all of it were that wide, and finds pages cut before', () => {
    // Two lines of 40 characters at the normal size; at 1.5 times, it needs a second page.
    const text = 'One two three four five six seven eight nine ten eleven twelve.'
    const plain = previewImport(text, project(''), layout).result.chapters[0]!.nodes.length
    const large = previewImport(`[style: shout]${text}`, project('.shout { font-size: 1.5em }'), layout).result.chapters[0]!.nodes.length
    expect(large).toBeGreaterThan(plain)

    const before = project('.shout { color: red }')
    const applied = applyImport(previewImport(`[style: shout]${text}`, before, layout), before, [], { type: 'newChapters' }, { fileName: null })
    expect(flattenStoredNodes(applied.chapters[0]!.nodes)).toHaveLength(plain)
    expect(pagesTooLong(applied.project, applied.chapters, layout)).toEqual([])
    expect(pagesTooLong({ ...applied.project, css: '.shout { font-size: 1.5em }' }, applied.chapters, layout)).toHaveLength(plain)
  })
})
