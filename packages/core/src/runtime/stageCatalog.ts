import { expressionAssetId, type Facing, type Framing, type Frames } from '../format/storyFormat'
import type { PlayableStory } from './playableStory'

/** Names and file addresses of what the stage shows, looked up by identifier. */
export interface StageCatalog {
  backgroundName: (backgroundId: string) => string
  backgroundUrl: (backgroundId: string) => string | null
  characterName: (characterId: string) => string
  drawnFacing: (characterId: string) => Facing | null
  /** How the character's pictures are drawn: its own framing, else the project's. */
  framing: (characterId: string) => Framing
  expressionName: (characterId: string, expressionId: string) => string
  expressionUrl: (characterId: string, expressionId: string) => string | null
  /** The file of a character's picture of that name, a grid's tile: null when it has none. */
  expressionUrlByName: (characterId: string, name: string) => string | null
  musicName: (musicId: string) => string
  musicUrl: (musicId: string) => string | null
  soundUrl: (soundId: string) => string | null
  videoUrl: (videoId: string) => string | null
  /** The captions of a video, null when it has none. */
  captionsUrl: (videoId: string) => string | null
  illustrationName: (illustrationId: string) => string
  illustrationUrl: (illustrationId: string) => string | null
  /** The picture frame of the text box or the name plate, null when the game has none. */
  frameUrl: (frame: keyof Frames) => string | null
  /** The colour of a character's name, `#rrggbb`, null for the plate's own. */
  nameColor: (characterId: string) => string | null
  /** The game's fonts that have a file, for the player to load before the CSS names them. */
  fonts: readonly { name: string; url: string }[]
}

export function createStageCatalog(story: PlayableStory): StageCatalog {
  const { project, assetUrls } = story
  const backgrounds = new Map(project.backgrounds.map(background => [background.id, background]))
  const characters = new Map(project.characters.map(character => [character.id, character]))
  const music = new Map(project.music.map(track => [track.id, track]))
  const sounds = new Map(project.sounds.map(sound => [sound.id, sound]))
  const illustrations = new Map(project.illustrations.map(illustration => [illustration.id, illustration]))
  const videos = new Map(project.videos.map(video => [video.id, video]))
  const urlOf = (assetId: string | null | undefined) => assetId == null ? null : assetUrls.get(assetId) ?? null
  const expressionOf = (characterId: string, expressionId: string) =>
    characters.get(characterId)?.expressions.find(expression => expression.id === expressionId)

  return {
    backgroundName: backgroundId => backgrounds.get(backgroundId)?.name ?? '',
    backgroundUrl: backgroundId => urlOf(backgrounds.get(backgroundId)?.assetId),
    characterName: characterId => characters.get(characterId)?.name ?? '',
    drawnFacing: characterId => characters.get(characterId)?.drawnFacing ?? null,
    framing: characterId => characters.get(characterId)?.framing ?? project.characterFraming ?? 'fullBody',
    expressionName: (characterId, expressionId) => expressionOf(characterId, expressionId)?.name ?? '',
    expressionUrl: (characterId, expressionId) => urlOf(expressionAssetId(project.characters, characters.get(characterId), expressionOf(characterId, expressionId))),
    expressionUrlByName: (characterId, name) => {
      const character = characters.get(characterId)
      const wanted = name.trim().toLowerCase()
      return urlOf(expressionAssetId(project.characters, character, character?.expressions.find(expression => expression.name.trim().toLowerCase() === wanted)))
    },
    musicName: musicId => music.get(musicId)?.name ?? '',
    musicUrl: musicId => urlOf(music.get(musicId)?.assetId),
    soundUrl: soundId => urlOf(sounds.get(soundId)?.assetId),
    videoUrl: videoId => urlOf(videos.get(videoId)?.assetId),
    captionsUrl: videoId => urlOf(videos.get(videoId)?.captionsAssetId),
    illustrationName: illustrationId => illustrations.get(illustrationId)?.name ?? '',
    illustrationUrl: illustrationId => urlOf(illustrations.get(illustrationId)?.assetId),
    frameUrl: frame => urlOf(project.frames[frame]),
    nameColor: characterId => characters.get(characterId)?.nameColor ?? null,
    fonts: project.fonts.flatMap(font => {
      const url = urlOf(font.assetId)
      return url === null ? [] : [{ name: font.name, url }]
    }),
  }
}
