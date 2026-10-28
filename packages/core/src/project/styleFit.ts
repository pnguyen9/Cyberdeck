import { styleClassName } from '../format/authorCss'
import { flattenStoredNodes, type ChapterDocument, type ProjectDocument } from '../format/storyFormat'
import type { PageLayout } from '../pagination/paginate'
import { wrapLines } from '../pagination/wrapLines'
import { measuringAskedNames } from '../format/askedNames'
import { styleWidthScales } from './projectEdits'

/**
 * Pages cut before their styles drew text larger, which no longer fit the text box: measured as the
 * import would, the whole page as wide as its widest style. Editing or importing them again cuts them anew.
 */
export function pagesTooLong(project: ProjectDocument, documents: readonly ChapterDocument[], layout: PageLayout): { documentId: string; nodeId: string }[] {
  const scales = styleWidthScales(project)
  const stylesById = new Map(project.styles.map(style => [style.id, style]))
  return documents.flatMap(document => flattenStoredNodes(document.nodes).flatMap(node => {
    if (node.type !== 'page' || node.styles === undefined || node.styles.length === 0) {
      return []
    }
    const scale = Math.max(1, ...node.styles.map(span => scales.get(styleClassName(stylesById.get(span.styleId)?.name ?? '')) ?? 1))
    const measureText = measuringAskedNames(layout.measureText)
    const fits = scale === 1 || wrapLines(node.text, layout.lineWidth, text => measureText(text) * scale).length <= layout.maxLines
    return fits ? [] : [{ documentId: document.id, nodeId: node.id }]
  }))
}
