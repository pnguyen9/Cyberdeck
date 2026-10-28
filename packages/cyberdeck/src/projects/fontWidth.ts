import { TEXTBOX_FONT_FAMILY, TEXTBOX_FONT_SIZE } from '@cyberdeck/stage'

/** Letters of English and French in their usual mix, capitals and signs: the width of ordinary text. */
const SAMPLE = 'The quick brown fox jumps over the lazy dog. Portez ce vieux whisky au juge blond qui fume ! ÉÀÇ 0123456789, « oui ? »'

/**
 * How much wider than the text box's font a font file draws text: loaded under a name of its own,
 * measured as the box measures its text, then put away. Pages in it are cut by this.
 */
export async function measureFontWidth(bytes: Uint8Array<ArrayBuffer>): Promise<number> {
  const family = `cyberdeck-measured-${crypto.randomUUID()}`
  const face = new FontFace(family, bytes)
  await face.load()
  document.fonts.add(face)
  try {
    const context = document.createElement('canvas').getContext('2d')
    if (context === null) {
      return 1
    }
    context.font = `${TEXTBOX_FONT_SIZE}px "${family}"`
    const width = context.measureText(SAMPLE).width
    context.font = `${TEXTBOX_FONT_SIZE}px ${TEXTBOX_FONT_FAMILY}`
    return width / context.measureText(SAMPLE).width
  } finally {
    document.fonts.delete(face)
  }
}
