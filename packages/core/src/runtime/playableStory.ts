import type { ChapterDocument, ProjectDocument } from '../format/storyFormat'

/** A project and the chapters it lists in `chapterOrder`, as a chip delivers them. */
export interface PlayableStory {
  project: ProjectDocument
  /** The chapters, and the scenes `sceneOrder` lists, which are stored the same way. */
  chapters: ChapterDocument[]
  /** Where to load each asset from, by asset identifier: object URLs of the chip's files. */
  assetUrls: ReadonlyMap<string, string>
}

/** The chapters in the order the project lists them; chapters it does not list are not played. */
export function chaptersInOrder(story: PlayableStory): ChapterDocument[] {
  return story.project.chapterOrder
    .map(chapterId => story.chapters.find(chapter => chapter.id === chapterId))
    .filter(chapter => chapter !== undefined)
}

/** The scenes of the story by identifier, for `[play]` to find. */
export function scenesOf(story: PlayableStory): Map<string, ChapterDocument> {
  return new Map(story.chapters.filter(chapter => story.project.sceneOrder.includes(chapter.id)).map(scene => [scene.id, scene]))
}
