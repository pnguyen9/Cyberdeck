import { checkReferences, createProject, importText, storeImport } from '../../src/index'
import type { PlayableStory } from '../../src/runtime/playableStory'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

/** Builds a story the way Cyberdeck will: import, check, store. Fails on any error, so tests start from valid stories. */
export function storyFromText(lines: string[]): PlayableStory {
  const imported = importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })
  const problems = [...imported.problems, ...checkReferences(imported)].filter(problem => problem.severity === 'error')
  if (problems.length > 0) {
    throw new Error(`The test story has problems: ${JSON.stringify(problems)}`)
  }
  const stored = storeImport(imported, createProject({ name: 'Test', locale: 'en' }), { fileName: null })
  return { project: stored.project, chapters: [...stored.chapters, ...stored.scenes], assetUrls: new Map() }
}
