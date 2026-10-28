import { describe, expect, it } from 'vitest'
import {
  createGameArchive,
  exportText,
  flattenStoredNodes,
  assignAsset,
  matchAssetFile,
  playerFormatVersion,
  readGameArchive,
  StoryRuntime,
  type ChapterDocument,
} from '../../src/index'
import { storyFromText } from './storyFromText'

describe('voices and videos', () => {
  it('are cues: a voice is one of the sounds, a video an entry of its own, both reached once', () => {
    const story = storyFromText(['[video: Opening]', '[voice: marie-01]— Marie: Hello.', '[sound: door]Bye.'])
    expect(story.project.sounds.map(sound => sound.name)).toEqual(['marie-01', 'door'])
    expect(story.project.videos.map(video => video.name)).toEqual(['Opening'])

    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(runtime.takeCues().map(cue => cue.type)).toEqual(['video', 'voice'])
    runtime.next()
    expect(runtime.takeCues().map(cue => cue.type)).toEqual(['sound'])
    runtime.back()
    expect(runtime.takeCues()).toEqual([])
  })

  it('are written back as they are imported', () => {
    const story = storyFromText(['[video: Opening]', '[voice: marie-01]— Marie: Hello.'])
    expect(exportText(story.project, story.chapters, { declareDecisions: false })).toBe('[import: chapter]\n#\n[video: Opening]\n[voice: marie-01]\n— Marie: Hello.\n')
  })

  it('make a game for Datajack 1.2 or later', () => {
    const plain = storyFromText(['[sound: door]Hello.'])
    expect(playerFormatVersion(plain.project, plain.chapters)).toBe('1.1')
    const voiced = storyFromText(['[voice: marie-01]Hello.'])
    expect(playerFormatVersion(voiced.project, voiced.chapters)).toBe('1.3')
    const filmed = storyFromText(['[video: Opening]', 'Hello.'])
    expect(playerFormatVersion(filmed.project, filmed.chapters)).toBe('1.3')
  })

  it('take their files by name: a video file goes to the video of its name', () => {
    const { project } = storyFromText(['[video: Opening Credits]', 'Hello.'])
    expect(matchAssetFile('opening_credits.webm', 'video/webm', project)).toEqual({ type: 'video', videoId: project.videos[0]!.id })
    expect(matchAssetFile('opening_credits.png', 'image/png', project)).toBeNull()
  })

  it('take their captions from a .vtt file of the same name, and need Datajack 1.3 then', async () => {
    const story = storyFromText(['[video: Opening]', 'Hello.'])
    const target = matchAssetFile('opening.vtt', 'text/vtt', story.project)
    expect(target).toEqual({ type: 'captions', videoId: story.project.videos[0]!.id })
    const video = { id: 'asset-1', fileName: 'opening.mp4', mediaType: 'video/mp4', byteSize: 3 }
    const captions = { id: 'asset-2', fileName: 'opening.vtt', mediaType: 'text/vtt', byteSize: 6 }
    const project = assignAsset(assignAsset(story.project, { type: 'video', videoId: story.project.videos[0]!.id }, video), target!, captions)
    expect(project.videos[0]).toMatchObject({ assetId: 'asset-1', captionsAssetId: 'asset-2' })
    const archive = await readGameArchive(await createGameArchive({
      project,
      chapters: story.chapters,
      includedChapterIds: project.chapterOrder,
      readAsset: async asset => new Uint8Array(asset.id === 'asset-1' ? [1, 2, 3] : [87, 69, 66, 86, 84, 84]),
      release: '1',
      exportedAt: new Date('2026-10-28T10:00:00.000Z'),
    }))
    expect(archive.manifest.assetFiles['asset-2']?.path).toBe('assets/videos/Opening.vtt')
    expect(archive.manifest.project.videos[0]?.captionsAssetId).toBe('asset-2')
    expect(archive.manifest.project.formatVersion).toBe('1.4')
  })

  it('travel in game archives, under assets/videos', async () => {
    const story = storyFromText(['[video: Opening]', 'Hello.'])
    const asset = { id: 'asset-1', fileName: 'opening.mp4', mediaType: 'video/mp4', byteSize: 3 }
    const project = { ...story.project, assets: [asset], videos: story.project.videos.map(video => ({ ...video, assetId: asset.id })) }
    const chapters: ChapterDocument[] = story.chapters
    const bytes = await createGameArchive({
      project,
      chapters,
      includedChapterIds: project.chapterOrder,
      readAsset: async () => new Uint8Array([1, 2, 3]),
      release: '1',
      exportedAt: new Date('2026-10-28T10:00:00.000Z'),
    })
    const archive = await readGameArchive(bytes)
    expect(archive.manifest.assetFiles['asset-1']?.path).toBe('assets/videos/Opening.mp4')
    expect(archive.manifest.project.formatVersion).toBe('1.3')
    expect(flattenStoredNodes(archive.chapters[0]!.nodes)[0]).toMatchObject({ type: 'page', commandsBefore: [{ type: 'video' }] })
  })
})
