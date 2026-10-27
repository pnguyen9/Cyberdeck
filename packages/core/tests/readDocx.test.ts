import { describe, expect, it } from 'vitest'
import { docxToText, importText, writeZip } from '../src/index'
import { monospaceLayout } from './monospaceLayout'

const encoder = new TextEncoder()
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

/** A minimal Word document: the paragraphs' XML, and styles as Word names them. */
function docx(paragraphsXml: string, stylesXml = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/></w:style></w:styles>`) {
  return writeZip([
    { path: '[Content_Types].xml', bytes: encoder.encode('<Types/>'), compress: true },
    { path: 'word/document.xml', bytes: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${paragraphsXml}<w:sectPr/></w:body></w:document>`), compress: true },
    { path: 'word/styles.xml', bytes: encoder.encode(stylesXml), compress: true },
  ], new Date('2026-10-26T12:00:00Z'))
}

const paragraph = (runs: string, properties = '') => `<w:p>${properties === '' ? '' : `<w:pPr>${properties}</w:pPr>`}${runs}</w:p>`
const run = (text: string, properties = '') => `<w:r>${properties === '' ? '' : `<w:rPr>${properties}</w:rPr>`}<w:t xml:space="preserve">${text}</w:t></w:r>`

describe('docxToText', () => {
  it('gives one line per paragraph, joining the runs Word cut them into', async () => {
    const text = await docxToText(await docx([
      paragraph(run('The classroom ') + run('was', '<w:b/>') + run(' empty.')),
      '<w:p/>',
      paragraph(run('[en') + run('ter: marie]', '<w:i/>')),
    ].join('')))
    expect(text).toBe('The classroom was empty.\n\n[enter: marie]')
  })

  it('keeps italics in prose, never inside a tag, nor in headings, options or lines of tags', async () => {
    const text = await docxToText(await docx([
      paragraph(run('It was ') + run('so', '<w:i/>') + run(' quiet. ') + run('Too quiet.', '<w:i/>')),
      paragraph(run('Chapter', '<w:i/>'), '<w:pStyle w:val="Titre1"/>'),
      paragraph(run('> Leave', '<w:i/>')),
      paragraph(run('[bg: night]', '<w:i/>')),
      paragraph(run('Not italic', '<w:i w:val="0"/>')),
    ].join('')))
    expect(text).toBe('It was [style: italic]so[style: none] quiet. [style: italic]Too quiet.\n# Chapter\n> Leave\n[bg: night]\nNot italic')
    const imported = importText(text.split('\n')[0]!, { layout: monospaceLayout, locale: 'en' })
    expect(imported.problems).toEqual([])
    expect(imported.chapters[0]!.nodes[0]).toMatchObject({ text: 'It was so quiet. Too quiet.', styles: [{ start: 7, end: 9, style: 'italic' }, { start: 17, end: 27, style: 'italic' }] })
  })

  it('makes chapters of Heading 1 paragraphs, whatever the language of Word', async () => {
    const text = await docxToText(await docx(paragraph(run('Chapter 1 — The Letter'), '<w:pStyle w:val="Titre1"/>') + paragraph(run('Hello.'))))
    expect(text).toBe('# Chapter 1 — The Letter\nHello.')
  })

  it('gives list items back the bullet Word took, so that dialogue stays dialogue', async () => {
    // Word processors may start a list item with tabs, as LibreOffice does.
    const text = await docxToText(await docx(paragraph('<w:r><w:tab/><w:tab/></w:r>' + run('Marie: You came.'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')))
    expect(text).toBe('• Marie: You came.')
    const imported = importText(text, { layout: monospaceLayout, locale: 'en' })
    expect(imported.chapters[0]?.nodes[0]).toMatchObject({ kind: 'dialogue', speaker: 'Marie', text: 'You came.' })
  })

  it('leaves out deleted revisions and field codes, keeps insertions, decodes characters', async () => {
    const text = await docxToText(await docx(paragraph(
      '<w:del><w:r><w:delText>Old words.</w:delText></w:r></w:del>'
      + '<w:ins>' + run('New &amp; better &lt;words&gt; &#8212; ') + '</w:ins>'
      + '<w:r><w:instrText> PAGE </w:instrText></w:r>'
      + '<w:r><w:t>end</w:t><w:tab/><w:t>tab</w:t><w:br/><w:t>line</w:t></w:r>',
    )))
    expect(text).toBe('New & better <words> — end\ttab\nline')
  })

  it('refuses what is not a Word document', async () => {
    await expect(docxToText(encoder.encode('plain text'))).rejects.toThrow('not a Word document')
    await expect(docxToText(await writeZip([{ path: 'game.json', bytes: encoder.encode('{}'), compress: false }], new Date()))).rejects.toThrow('not a Word document')
  })
})
