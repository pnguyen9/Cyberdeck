import type { ChapterDocument, ProjectDocument } from '../format/storyFormat'

/** A project and the chapters it lists in `chapterOrder`, as a game delivers them, installed or previewed. */
export interface PlayableStory {
  project: ProjectDocument
  /** The chapters, and the scenes `sceneOrder` lists, which are stored the same way. */
  chapters: ChapterDocument[]
  /** Where to load each asset from, by asset identifier: object URLs of the game's files. */
  assetUrls: ReadonlyMap<string, string>
  /** Endings only chapters not installed lead to, which the game keeps quiet about: not counted for players. */
  uncountedEndingIds?: ReadonlySet<string>
}

/** The chapters in the order the project lists them; chapters it does not list are not played. */
export function chaptersInOrder(story: PlayableStory): ChapterDocument[] {
  return story.project.chapterOrder
    .map(chapterId => story.chapters.find(chapter => chapter.id === chapterId))
    .filter(chapter => chapter !== undefined)
}

/**
 * Whether chapters of the story are not in the game, a game exported with only some of its chapters:
 * reaching its end without an ending, a player has not finished the story, only what is installed.
 */
export function isMissingChapters(story: PlayableStory): boolean {
  const chapterIds = new Set(story.chapters.map(chapter => chapter.id))
  return story.project.chapterOrder.some(chapterId => !chapterIds.has(chapterId))
}

/** The scenes of the story by identifier, for `[play]` to find. */
export function scenesOf(story: PlayableStory): Map<string, ChapterDocument> {
  return new Map(story.chapters.filter(chapter => story.project.sceneOrder.includes(chapter.id)).map(scene => [scene.id, scene]))
}
