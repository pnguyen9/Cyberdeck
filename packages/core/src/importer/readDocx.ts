import { readZip } from '../archive/zip'

/**
 * The text of a Word document (`.docx`), one line per paragraph, ready for `importText`: what the
 * writer typed, as they see it in Word.
 *
 * - "Heading 1" paragraphs become chapter headings (`# Title`), recognised by the style's built-in
 *   name, which Word keeps in English whatever the language of its interface;
 * - list items get back the bullet Word took from them (`• `): a typed `- ` becomes a list, and
 *   `— Marie: …` must still read as dialogue;
 * - text Word cut into runs (formatting, spelling) is joined, even inside a `[tag]`;
 * - italic text is kept, between `[style: italic]` and `[style: none]`, in paragraphs of prose
 *   (not in headings, options, or lines of tags alone, and never inside a tag);
 * - deleted revisions, field codes, text boxes, comments and notes are left out.
 */
export async function docxToText(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  let entries
  try {
    entries = new Map(readZip(bytes).map(entry => [entry.path, entry]))
  } catch {
    throw new Error('This file is not a Word document (.docx)')
  }
  const documentEntry = entries.get('word/document.xml')
  if (documentEntry === undefined) {
    throw new Error('This file is not a Word document (.docx)')
  }
  const decoder = new TextDecoder()
  const stylesEntry = entries.get('word/styles.xml')
  const headingStyleIds = stylesEntry === undefined ? new Set<string>() : chapterStyleIds(decoder.decode(await stylesEntry.read()))
  return paragraphsOf(decoder.decode(await documentEntry.read()), headingStyleIds).join('\n')
}

const TOKEN = /<(\/?)([\w:]+)((?:\s+[\w:]+="[^"]*")*)\s*(\/?)>|([^<]+)/g

/** Elements whose content is not part of the text the writer reads. */
const SKIPPED_ELEMENTS = new Set(['w:delText', 'w:instrText', 'w:txbxContent', 'w:footnoteReference', 'w:commentReference'])

/** Styles whose built-in name is "heading 1" or "title": their identifier is translated, their name is not. */
function chapterStyleIds(stylesXml: string): Set<string> {
  const ids = new Set<string>()
  for (const style of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = /<w:name\s+w:val="([^"]*)"/.exec(style[2] ?? '')?.[1]?.toLowerCase()
    if (name === 'heading 1' || name === 'title') {
      ids.add(style[1] ?? '')
    }
  }
  return ids
}

function paragraphsOf(documentXml: string, headingStyleIds: ReadonlySet<string>): string[] {
  const paragraphs: string[] = []
  let text: string | null = null
  let styleId: string | null = null
  let isListItem = false
  let isInText = false
  let skippedDepth = 0
  let isInRun = false
  let isRunItalic = false
  /** Whether the text written so far ends in italics, as its markers say. */
  let isWrittenItalic = false

  for (const token of documentXml.matchAll(TOKEN)) {
    const [, closing, name, attributes = '', selfClosing, content] = token
    if (content !== undefined) {
      if (isInText && skippedDepth === 0 && text !== null) {
        if (isRunItalic !== isWrittenItalic && !isInsideTag(text)) {
          text += isRunItalic ? ITALIC_MARKER : PLAIN_MARKER
          isWrittenItalic = isRunItalic
        }
        text += decodeEntities(content)
      }
      continue
    }
    if (name === undefined) {
      continue
    }
    if (SKIPPED_ELEMENTS.has(name)) {
      if (selfClosing === '') {
        skippedDepth += closing === '/' ? -1 : 1
      }
      continue
    }
    if (skippedDepth > 0) {
      continue
    }
    switch (name) {
      case 'w:p':
        if (closing === '/') {
          if (text !== null) {
            const isHeading = styleId !== null && headingStyleIds.has(styleId)
            const kept = isHeading || isWithoutProse(text) ? withoutStyleMarkers(text) : text
            paragraphs.push(isHeading ? `# ${kept.trim()}` : isListItem ? `• ${kept.trimStart()}` : kept)
          }
          text = null
        } else if (selfClosing === '/') {
          paragraphs.push('')
        } else {
          text = ''
          styleId = null
          isListItem = false
          isWrittenItalic = false
        }
        break
      case 'w:r':
        isInRun = closing !== '/' && selfClosing !== '/'
        isRunItalic = false
        break
      case 'w:i':
        // The paragraph mark has its own formatting, outside any run: only the runs' count.
        if (isInRun) {
          isRunItalic = !/w:val="(0|false|off)"/.test(attributes)
        }
        break
      case 'w:pStyle':
        styleId = /w:val="([^"]*)"/.exec(attributes)?.[1] ?? null
        break
      case 'w:numPr':
        isListItem = true
        break
      case 'w:t':
        isInText = closing !== '/' && selfClosing !== '/'
        break
      case 'w:tab':
        if (text !== null && selfClosing === '/') {
          text += '\t'
        }
        break
      case 'w:br':
      case 'w:cr':
        if (text !== null) {
          text += '\n'
        }
        break
      case 'w:noBreakHyphen':
        if (text !== null) {
          text += '‑'
        }
        break
    }
  }
  return paragraphs
}

const ITALIC_MARKER = '[style: italic]'
const PLAIN_MARKER = '[style: none]'

/** Whether a `[` is still open at the end of the text: a marker there would break the tag. */
function isInsideTag(text: string): boolean {
  return text.lastIndexOf('[') > text.lastIndexOf(']')
}

/** Options (`> …`) and lines of tags alone carry no styled prose. */
function isWithoutProse(text: string): boolean {
  return withoutStyleMarkers(text).trimStart().startsWith('>') || withoutStyleMarkers(text).replace(/\[[^\]]*\]/g, '').trim() === ''
}

function withoutStyleMarkers(text: string): string {
  return text.replaceAll(ITALIC_MARKER, '').replaceAll(PLAIN_MARKER, '')
}

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (_, entity: string) => {
    switch (entity) {
      case 'amp': return '&'
      case 'lt': return '<'
      case 'gt': return '>'
      case 'quot': return '"'
      case 'apos': return "'"
      default: return String.fromCodePoint(entity.startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1)))
    }
  })
}
