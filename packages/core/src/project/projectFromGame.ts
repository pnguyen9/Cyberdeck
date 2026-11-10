import type { GameArchive } from '../archive/gameArchive'
import { FORMAT_VERSION, type ProjectDocument } from '../format/storyFormat'
import type { ProjectBackup } from './projectBackup'

/**
 * A game exported, as a project again, for an author who no longer has theirs: what the archive
 * carries comes back as it was written, under the same identifier, so that players' saves still
 * know the game. Chapters the archive left out leave the story's order; entries whose file it left
 * out stay, waiting for one; definitions written among the pages, which archives drop, are kept by
 * the project itself and come back in Definitions.
 */
export function projectFromGame(archive: GameArchive): { backup: ProjectBackup; chaptersLeftOut: number } {
  const { manifest } = archive
  const shippedAssetIds = new Set(Object.keys(manifest.assetFiles))
  const kept = (assetId: string | null) => assetId !== null && shippedAssetIds.has(assetId) ? assetId : null
  const shipped = manifest.project
  const chapterIds = new Set(archive.chapters.map(chapter => chapter.id))
  const project: ProjectDocument = {
    ...shipped,
    formatVersion: FORMAT_VERSION,
    chapterOrder: shipped.chapterOrder.filter(chapterId => chapterIds.has(chapterId)),
    assets: shipped.assets.filter(asset => shippedAssetIds.has(asset.id)),
    backgrounds: shipped.backgrounds.map(background => ({ ...background, assetId: kept(background.assetId) })),
    music: shipped.music.map(track => ({ ...track, assetId: kept(track.assetId) })),
    sounds: shipped.sounds.map(sound => ({ ...sound, assetId: kept(sound.assetId) })),
    illustrations: shipped.illustrations.map(illustration => ({ ...illustration, assetId: kept(illustration.assetId) })),
    videos: shipped.videos.map(({ captionsAssetId, ...video }) => {
      const captions = kept(captionsAssetId ?? null)
      return { ...video, assetId: kept(video.assetId), ...(captions === null ? {} : { captionsAssetId: captions }) }
    }),
    fonts: shipped.fonts.map(font => ({ ...font, assetId: kept(font.assetId) })),
    frames: { textBox: kept(shipped.frames.textBox), namePlate: kept(shipped.frames.namePlate) },
    characters: shipped.characters.map(character => ({
      ...character,
      expressions: character.expressions.map(expression => ({ ...expression, assetId: kept(expression.assetId) })),
    })),
    details: { ...shipped.details, coverAssetId: kept(shipped.details.coverAssetId) },
  }
  const assetFiles = new Map(Object.entries(manifest.assetFiles).flatMap(([assetId, file]) => {
    const bytes = archive.assetFiles.get(file.path)
    return bytes === undefined ? [] : [[assetId, bytes] as const]
  }))
  const chapters = [...archive.chapters, ...archive.scenes].map(chapter => ({ ...chapter, formatVersion: FORMAT_VERSION }))
  return { backup: { project, chapters, assetFiles }, chaptersLeftOut: manifest.chapters.filter(chapter => !chapter.included).length }
}
