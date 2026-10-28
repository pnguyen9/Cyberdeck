import { describe, expect, it } from 'vitest'
import { addFontFile, assignAsset, DEFAULT_POSITION_PRESETS, DEFAULT_STAGE_DEFAULTS, fontMediaTypeOf, matchAssetFile, type ProjectDocument } from '../src/index'

const project: ProjectDocument = {
  formatVersion: '1.0',
  id: 'project',
  name: 'Rain City',
  locale: 'en',
  chapterOrder: [],
  sceneOrder: [],
  styles: [],
  decisions: [],
  characters: [
    { id: 'marie', name: 'Marie', drawnFacing: null, expressions: [{ id: 'marie-normal', name: 'normal', assetId: null }, { id: 'marie-smile', name: 'smile', assetId: null }] },
    { id: 'old-marie', name: 'Old Marie', drawnFacing: null, expressions: [{ id: 'old-marie-sad', name: 'sad', assetId: null }] },
  ],
  backgrounds: [
    { id: 'rooftop', name: 'rooftop', assetId: null },
    { id: 'classroom', name: 'classroom_evening', assetId: null },
  ],
  music: [{ id: 'calm', name: 'calm', assetId: null }],
  sounds: [{ id: 'door', name: 'door', assetId: null }],
  illustrations: [{ id: 'kiss', name: 'kiss', assetId: null }],
  assets: [],
  positions: [...DEFAULT_POSITION_PRESETS],
  endings: [],
  memories: [],
  stageDefaults: DEFAULT_STAGE_DEFAULTS,
  details: { description: '', credits: '', coverAssetId: null },
  fonts: [],
  css: '',
  chapterTitleCards: false,
  createdAt: '2026-10-26T10:00:00.000Z',
  updatedAt: '2026-10-26T10:00:00.000Z',
}

describe('matchAssetFile', () => {
  it('matches an image to the background of the same name, ignoring case, spaces, hyphens and underscores', () => {
    expect(matchAssetFile('Rooftop.JPG', 'image/jpeg', project)).toEqual({ type: 'background', backgroundId: 'rooftop' })
    expect(matchAssetFile('classroom evening.png', 'image/png', project)).toEqual({ type: 'background', backgroundId: 'classroom' })
  })

  it('matches an image named after a character and an expression', () => {
    expect(matchAssetFile('marie-smile.png', 'image/png', project)).toEqual({ type: 'expression', characterId: 'marie', expressionId: 'marie-smile' })
    expect(matchAssetFile('Marie_Smile.webp', 'image/webp', project)).toEqual({ type: 'expression', characterId: 'marie', expressionId: 'marie-smile' })
  })

  it('matches an image named after a character alone to its normal expression', () => {
    expect(matchAssetFile('marie.png', 'image/png', project)).toEqual({ type: 'expression', characterId: 'marie', expressionId: 'marie-normal' })
  })

  it('prefers the character with the longest matching name', () => {
    expect(matchAssetFile('old-marie-sad.png', 'image/png', project)).toEqual({ type: 'expression', characterId: 'old-marie', expressionId: 'old-marie-sad' })
  })

  it('matches audio to music and sounds only, and images never to them', () => {
    expect(matchAssetFile('calm.mp3', 'audio/mpeg', project)).toEqual({ type: 'music', musicId: 'calm' })
    expect(matchAssetFile('Door.ogg', 'audio/ogg', project)).toEqual({ type: 'sound', soundId: 'door' })
    expect(matchAssetFile('door.png', 'image/png', project)).toBeNull()
    expect(matchAssetFile('Kiss.webp', 'image/webp', project)).toEqual({ type: 'illustration', illustrationId: 'kiss' })
    expect(matchAssetFile('calm.png', 'image/png', project)).toBeNull()
    expect(matchAssetFile('rooftop.ogg', 'audio/ogg', project)).toBeNull()
  })

  it('matches nothing for unknown names and expressions', () => {
    expect(matchAssetFile('street.png', 'image/png', project)).toBeNull()
    expect(matchAssetFile('marie-angry.png', 'image/png', project)).toBeNull()
  })
})

describe('assignAsset', () => {
  it('adds the asset to the project and points the target at it, leaving the project given untouched', () => {
    const asset = { id: 'asset-1', fileName: 'marie-smile.png', mediaType: 'image/png', byteSize: 1234 }
    const updated = assignAsset(project, { type: 'expression', characterId: 'marie', expressionId: 'marie-smile' }, asset)

    expect(updated.assets).toEqual([asset])
    expect(updated.characters[0]?.expressions[1]?.assetId).toBe('asset-1')
    expect(project.characters[0]?.expressions[1]?.assetId).toBeNull()
    expect(project.assets).toEqual([])
  })
})

describe('fonts', () => {
  it('makes a font of each font file, named after it, and gives a file named like a font to it', () => {
    let nextId = 1
    const asset = (fileName: string) => ({ id: `asset-${nextId}`, fileName, mediaType: fontMediaTypeOf(fileName)!, byteSize: 1 })
    const first = addFontFile(project, 'Cinzel-Regular.woff2', asset('Cinzel-Regular.woff2'), 1.2, () => `font-${nextId++}`)
    expect(first.project.fonts).toEqual([{ id: 'font-1', name: 'Cinzel-Regular', assetId: 'asset-1', widthScale: 1.2 }])
    const again = addFontFile(first.project, 'cinzel_regular.TTF', asset('cinzel_regular.TTF'), 1.25, () => `font-${nextId++}`)
    expect(again.project.fonts).toEqual([{ id: 'font-1', name: 'Cinzel-Regular', assetId: 'asset-2', widthScale: 1.25 }])
    expect(fontMediaTypeOf('song.ogg')).toBeNull()
  })
})
