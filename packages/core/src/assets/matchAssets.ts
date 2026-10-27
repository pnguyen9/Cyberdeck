import type { Asset, ProjectDocument } from '../format/storyFormat'

/** The registry entry a file is meant for. */
export type AssetTarget =
  | { type: 'background'; backgroundId: string }
  | { type: 'expression'; characterId: string; expressionId: string }
  | { type: 'music'; musicId: string }
  | { type: 'sound'; soundId: string }
  | { type: 'illustration'; illustrationId: string }

/** Expression a file named after a character alone is meant for: `marie.png`. */
const DEFAULT_EXPRESSION = 'normal'

/** `Classroom Evening.PNG`, `classroom_evening` and `classroom-evening` all become `classroom-evening`. */
function matchingKey(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '')
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/**
 * Finds the registry entry a file is meant for from its name, so that a whole folder can be
 * dropped at once: `rooftop.jpg` for the background `rooftop`, `marie-smile.png` for Marie's
 * `smile` expression, `marie.png` for her `normal` one, `calm.mp3` for the track `calm`, `door.ogg`
 * for the sound `door`. Images only go to backgrounds, illustrations and expressions, audio only to
 * music and sounds.
 * A name both a track and a sound bear goes to the track.
 */
export function matchAssetFile(fileName: string, mediaType: string, project: ProjectDocument): AssetTarget | null {
  const fileKey = matchingKey(withoutExtension(fileName))

  if (mediaType.startsWith('audio/')) {
    const track = project.music.find(candidate => matchingKey(candidate.name) === fileKey)
    if (track !== undefined) {
      return { type: 'music', musicId: track.id }
    }
    const sound = project.sounds.find(candidate => matchingKey(candidate.name) === fileKey)
    return sound === undefined ? null : { type: 'sound', soundId: sound.id }
  }
  if (!mediaType.startsWith('image/')) {
    return null
  }

  const background = project.backgrounds.find(candidate => matchingKey(candidate.name) === fileKey)
  if (background !== undefined) {
    return { type: 'background', backgroundId: background.id }
  }
  const illustration = project.illustrations.find(candidate => matchingKey(candidate.name) === fileKey)
  if (illustration !== undefined) {
    return { type: 'illustration', illustrationId: illustration.id }
  }

  const charactersLongestNameFirst = [...project.characters]
    .sort((first, second) => matchingKey(second.name).length - matchingKey(first.name).length)
  for (const character of charactersLongestNameFirst) {
    const characterKey = matchingKey(character.name)
    const expressionKey = fileKey === characterKey
      ? DEFAULT_EXPRESSION
      : fileKey.startsWith(`${characterKey}-`) ? fileKey.slice(characterKey.length + 1) : null
    const expression = expressionKey === null
      ? undefined
      : character.expressions.find(candidate => matchingKey(candidate.name) === expressionKey)
    if (expression !== undefined) {
      return { type: 'expression', characterId: character.id, expressionId: expression.id }
    }
  }
  return null
}

/** Adds the asset to the project and points the target at it. Returns a new project. */
export function assignAsset(project: ProjectDocument, target: AssetTarget, asset: Asset): ProjectDocument {
  const withAsset = { ...project, assets: [...project.assets, asset] }
  switch (target.type) {
    case 'background':
      return {
        ...withAsset,
        backgrounds: project.backgrounds.map(background => background.id === target.backgroundId ? { ...background, assetId: asset.id } : background),
      }
    case 'music':
      return {
        ...withAsset,
        music: project.music.map(track => track.id === target.musicId ? { ...track, assetId: asset.id } : track),
      }
    case 'illustration':
      return {
        ...withAsset,
        illustrations: project.illustrations.map(illustration => illustration.id === target.illustrationId ? { ...illustration, assetId: asset.id } : illustration),
      }
    case 'sound':
      return {
        ...withAsset,
        sounds: project.sounds.map(sound => sound.id === target.soundId ? { ...sound, assetId: asset.id } : sound),
      }
    case 'expression':
      return {
        ...withAsset,
        characters: project.characters.map(character => character.id !== target.characterId ? character : {
          ...character,
          expressions: character.expressions.map(expression => expression.id === target.expressionId ? { ...expression, assetId: asset.id } : expression),
        }),
      }
  }
}
