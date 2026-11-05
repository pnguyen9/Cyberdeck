import { describe, expect, it } from 'vitest'
import { createProject, exportText, importText, storeImport } from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const WRITTEN = [
  '# The Letter',
  'The classroom was empty. The last light of the day fell across the desks. Nobody had come back for the bag by the window. It was still there when the bell rang.',
  'Short one.',
  '— Marie: I waited for you after class, by the gate, for a long time. Then I gave up and went home. Why did you never come?',
  '[bg: rooftop]',
  'The roof was cold. The city glowed below.',
]

function exported(paragraphsAsWritten: boolean): string[] {
  const imported = importText(WRITTEN.join('\n'), { layout: monospaceLayout, locale: 'en' })
  const stored = storeImport(imported, createProject({ name: 'Letter', locale: 'en' }), { fileName: null })
  return exportText(stored.project, stored.chapters, { declareDecisions: false, ...(paragraphsAsWritten ? { paragraphsAsWrittenFor: monospaceLayout } : {}) })
    .trim().split('\n').slice(1)
}

describe('paragraphs as written', () => {
  it('joins the pages the import cut from one paragraph, and reads as the text written', () => {
    expect(exported(true)).toEqual(WRITTEN)
  })

  it('keeps each page its own paragraph otherwise', () => {
    expect(exported(false).length).toBeGreaterThan(WRITTEN.length)
  })

  it('never joins a paragraph to one whose first sentence the import would have cut there', () => {
    const written = ['# Two paragraphs', 'Short line here.', 'Alpha beta gamma delta, epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau and more words here.']
    const imported = importText(written.join('\n'), { layout: monospaceLayout, locale: 'en' })
    const stored = storeImport(imported, createProject({ name: 'Two', locale: 'en' }), { fileName: null })
    expect(exportText(stored.project, stored.chapters, { declareDecisions: false, paragraphsAsWrittenFor: monospaceLayout }).trim().split('\n').slice(1)).toEqual(written)
  })

  it('joins the pages of a language written without spaces without adding any', () => {
    const written = ['# 夜', '窓の外を見ると街はとても静かで誰もいなかった。それから雨が降り始めて、私たちは長い間黙って座っていた。遠くで犬が吠えた。']
    const imported = importText(written.join('\n'), { layout: monospaceLayout, locale: 'ja' })
    const stored = storeImport(imported, createProject({ name: '夜', locale: 'ja' }), { fileName: null })
    expect(exportText(stored.project, stored.chapters, { declareDecisions: false, paragraphsAsWrittenFor: monospaceLayout }).trim().split('\n').slice(1)).toEqual(written)
  })
})
