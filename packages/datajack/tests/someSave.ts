import { createProject, importText, storeImport, StoryRuntime, toSave, type SaveData } from '@cyberdeck/core'

const monospaceLayout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }

/** A valid save of a one-page story, for tests about where saves are kept. */
export function someSave(): SaveData {
  const stored = storeImport(importText('Hello.', { layout: monospaceLayout, locale: 'en' }), createProject({ name: 'Test', locale: 'en' }), { fileName: null })
  const story = { project: stored.project, chapters: stored.chapters, assetUrls: new Map<string, string>() }
  const runtime = new StoryRuntime(story)
  runtime.start()
  return toSave(story, runtime.exportState(), '2026-10-26T12:00:00.000Z')
}
