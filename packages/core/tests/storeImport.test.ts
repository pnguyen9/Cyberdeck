import { describe, expect, it } from 'vitest'
import {
  createProject,
  DEFAULT_POSITION_PRESETS,
  DEFAULT_STAGE_DEFAULTS,
  FORMAT_VERSION,
  importText,
  isSupportedFormatVersion,
  storeImport,
  type ChapterDocument,
  type StoredNode,
} from '../src/index'
import { monospaceLayout } from './monospaceLayout'

/** Identifiers `id-1`, `id-2`… and a fixed clock, so documents can be compared exactly. */
function testEnvironment() {
  let nextId = 1
  return {
    createId: () => `id-${nextId++}`,
    now: () => '2026-10-26T10:00:00.000Z',
  }
}

const importLines = (lines: string[]) => importText(lines.join('\n'), { layout: monospaceLayout, locale: 'en' })

const newProject = () => createProject({ name: 'Rain City', locale: 'en' }, testEnvironment())

function nodesOfType<Type extends StoredNode['type']>(chapter: ChapterDocument, type: Type): Extract<StoredNode, { type: Type }>[] {
  const flatten = (nodes: StoredNode[]): StoredNode[] =>
    nodes.flatMap(node => node.type === 'condition' ? [node, ...node.branches.flatMap(branch => flatten(branch.nodes))] : [node])
  return flatten(chapter.nodes).filter((node): node is Extract<StoredNode, { type: Type }> => node.type === type)
}

function named<Entry extends { name: string }>(entries: Entry[], name: string): Entry {
  const entry = entries.find(candidate => candidate.name === name)
  if (entry === undefined) {
    throw new Error(`Nothing named ${name} in ${JSON.stringify(entries.map(candidate => candidate.name))}`)
  }
  return entry
}

describe('createProject', () => {
  it('creates an empty project with an identifier, the format version and audit dates', () => {
    expect(createProject({ name: 'Rain City', locale: 'en' }, testEnvironment())).toEqual({
      formatVersion: FORMAT_VERSION,
      id: 'id-1',
      name: 'Rain City',
      locale: 'en',
      chapterOrder: [],
      sceneOrder: [],
      decisions: [],
      characters: [],
      backgrounds: [],
      music: [],
      sounds: [],
      illustrations: [],
      assets: [],
      positions: [...DEFAULT_POSITION_PRESETS],
      endings: [],
      memories: [],
      styles: [],
      stageDefaults: DEFAULT_STAGE_DEFAULTS,
      details: { description: '', credits: '', coverAssetId: null },
      fonts: [],
      css: '',
      chapterTitleCards: false,
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
    })
  })
})

describe('storeImport', () => {
  it('gives every chapter and node an identifier and appends the chapters to the project', () => {
    const environment = testEnvironment()
    const project = createProject({ name: 'Rain City', locale: 'en' }, environment)

    const stored = storeImport(importLines(['# One', 'Hello.', '# Two', '[bg: rooftop]']), project, { fileName: 'story.docx' }, environment)

    expect(stored.project.backgrounds).toEqual([{ id: 'id-2', name: 'rooftop', assetId: null }])
    expect(stored.chapters).toEqual([
      {
        formatVersion: FORMAT_VERSION,
        id: 'id-3',
        title: 'One',
        importedFrom: { fileName: 'story.docx', importedAt: '2026-10-26T10:00:00.000Z' },
        nodes: [{ type: 'page', id: 'id-4', kind: 'narration', speakerId: null, text: 'Hello.', commandsBefore: [], inlineCommands: [] }],
        createdAt: '2026-10-26T10:00:00.000Z',
        updatedAt: '2026-10-26T10:00:00.000Z',
      },
      {
        formatVersion: FORMAT_VERSION,
        id: 'id-5',
        title: 'Two',
        importedFrom: { fileName: 'story.docx', importedAt: '2026-10-26T10:00:00.000Z' },
        nodes: [{ type: 'stage', id: 'id-6', commands: [{ type: 'background', backgroundId: 'id-2' }] }],
        createdAt: '2026-10-26T10:00:00.000Z',
        updatedAt: '2026-10-26T10:00:00.000Z',
      },
    ])
    expect(stored.project.chapterOrder).toEqual(['id-3', 'id-5'])
    expect(project.chapterOrder).toEqual([])
  })

  it('stores decisions with identifiers, and references them by identifier', () => {
    const stored = storeImport(importLines([
      '[decision: Confession = Accept | Refuse]',
      '[choice: Confession]',
      '> Yes = Accept',
      '> No = refuse',
      '[if: Confession is not Accept]',
      'Sad.',
      '[end]',
      '[set: Confession = Accept]',
    ]), newProject(), { fileName: null }, testEnvironment())

    const confession = named(stored.project.decisions, 'Confession')
    expect(confession.values.map(value => value.name)).toEqual(['Accept', 'Refuse'])
    const [accept, refuse] = confession.values

    const chapter = stored.chapters[0]!
    expect(nodesOfType(chapter, 'choice')[0]).toMatchObject({
      decisionId: confession.id,
      options: [{ text: 'Yes', valueId: accept?.id }, { text: 'No', valueId: refuse?.id }],
    })
    expect(nodesOfType(chapter, 'condition')[0]?.branches[0]?.condition).toEqual(
      { type: 'is', decisionId: confession.id, valueId: accept?.id, negated: true },
    )
    expect(nodesOfType(chapter, 'set')[0]).toMatchObject({ decisionId: confession.id, valueId: accept?.id })
  })

  it('creates the decision of a choice nobody declared, with its option values', () => {
    const stored = storeImport(importLines(['[choice: Answer]', '> Yes', '> No = Never']), newProject(), { fileName: null }, testEnvironment())

    expect(named(stored.project.decisions, 'Answer')).toMatchObject({ multiple: false, values: [{ name: 'A' }, { name: 'Never' }] })
  })

  it('reuses the decisions the project already has, ignoring case', () => {
    const environment = testEnvironment()
    const first = storeImport(importLines(['[decision multi: Clues = Letter | Key]']),
      createProject({ name: 'Rain City', locale: 'en' }, environment), { fileName: null }, environment)
    const second = storeImport(importLines(['[set: clues = KEY]']), first.project, { fileName: null }, environment)

    const clues = named(second.project.decisions, 'Clues')
    expect(second.project.decisions).toHaveLength(1)
    expect(nodesOfType(second.chapters[0]!, 'set')[0]).toMatchObject({ decisionId: clues.id, valueId: clues.values[1]?.id })
  })

  it('refuses an import whose references were not checked', () => {
    expect(() => storeImport(importLines(['[set: Nowhere = Yes]']), newProject(), { fileName: null }, testEnvironment())).toThrow('Nowhere')
    expect(() => storeImport(importLines(['[move: marie]', 'Text.']), newProject(), { fileName: null }, testEnvironment())).toThrow('move')
  })

  describe('registry', () => {
    const story = [
      '[bg: rooftop] [music: calm]',
      '[enter: marie left]',
      '— Marie: Hi. [marie: smile]',
      '[marie: sad]',
      '[exit: Marie] [music: stop]',
      '— Jules: Bye. [wait: 1] [sound: Door]',
    ]

    it('creates the characters, expressions, backgrounds, music and sounds the text uses, and reports them', () => {
      const stored = storeImport(importLines(story), newProject(), { fileName: null }, testEnvironment())

      expect(stored.project.characters.map(character => character.name)).toEqual(['Marie', 'Jules'])
      expect(named(stored.project.characters, 'Marie').expressions.map(expression => expression.name)).toEqual(['normal', 'smile', 'sad'])
      expect(named(stored.project.characters, 'Jules').expressions).toEqual([])
      expect(stored.project.backgrounds.map(background => background.name)).toEqual(['rooftop'])
      expect(stored.project.music.map(track => track.name)).toEqual(['calm'])
      expect(stored.project.sounds.map(sound => sound.name)).toEqual(['Door'])

      expect(stored.created).toEqual({
        characters: ['Marie', 'Jules'],
        expressions: [
          { character: 'Marie', expression: 'normal' },
          { character: 'Marie', expression: 'smile' },
          { character: 'Marie', expression: 'sad' },
        ],
        backgrounds: ['rooftop'],
        music: ['calm'],
        sounds: ['Door'],
        illustrations: [],
      })
    })

    it('stores speakers and stage directives by identifier', () => {
      const stored = storeImport(importLines(story), newProject(), { fileName: null }, testEnvironment())
      const marie = named(stored.project.characters, 'Marie')
      const jules = named(stored.project.characters, 'Jules')
      const [normal, smile, sad] = marie.expressions
      const [hi, bye] = nodesOfType(stored.chapters[0]!, 'page')

      expect(hi).toMatchObject({
        speakerId: marie.id,
        commandsBefore: [
          { type: 'background', backgroundId: named(stored.project.backgrounds, 'rooftop').id },
          { type: 'music', musicId: named(stored.project.music, 'calm').id },
          {
            type: 'enter',
            characterId: marie.id,
            expressionId: normal?.id,
            placement: { type: 'preset', presetId: 'position-left' },
            facing: null,
            animation: { kind: null, durationMs: null, wait: false },
          },
        ],
        inlineCommands: [{ offset: 3, type: 'expression', characterId: marie.id, expressionId: smile?.id }],
      })
      expect(bye).toMatchObject({
        speakerId: jules.id,
        commandsBefore: [
          { type: 'expression', characterId: marie.id, expressionId: sad?.id },
          { type: 'exit', characterId: marie.id, animation: { kind: null, durationMs: null, wait: false } },
          { type: 'music', musicId: null },
        ],
        inlineCommands: [{ offset: 4, type: 'wait', seconds: 1 }, { offset: 4, type: 'sound', soundId: named(stored.project.sounds, 'Door').id }],
      })
    })

    it('reuses what the project already has, ignoring case', () => {
      const environment = testEnvironment()
      const first = storeImport(importLines(story), createProject({ name: 'Rain City', locale: 'en' }, environment), { fileName: null }, environment)
      const second = storeImport(importLines(['[bg: Rooftop]', '[enter: MARIE smile]', 'marie said nothing.']), first.project, { fileName: null }, environment)

      expect(second.project.characters).toEqual(first.project.characters)
      expect(second.project.backgrounds).toEqual(first.project.backgrounds)
      expect(second.created).toEqual({ characters: [], expressions: [], backgrounds: [], music: [], sounds: [], illustrations: [] })
    })

    it('stores positions as presets, exact percentages, or automatic placement', () => {
      const stored = storeImport(importLines(['[enter: marie] [enter: jules 35% facing-left slide-from-right 1s wait]', '[move: marie far-right instant]', 'Text.']),
        newProject(), { fileName: null }, testEnvironment())
      const [text] = nodesOfType(stored.chapters[0]!, 'page')

      expect(text?.commandsBefore).toMatchObject([
        { type: 'enter', placement: { type: 'auto' }, facing: null },
        { type: 'enter', placement: { type: 'exact', x: 35 }, facing: 'left', animation: { kind: 'slide-from-right', durationMs: 1000, wait: true } },
        { type: 'move', placement: { type: 'preset', presetId: 'position-far-right' }, animation: { kind: 'instant', durationMs: null, wait: false } },
      ])
    })

    it('gives new characters no drawn facing, so that they are never mirrored until the author says which way they look', () => {
      const stored = storeImport(importLines(['— Marie: Hi.']), newProject(), { fileName: null }, testEnvironment())
      expect(stored.project.characters[0]?.drawnFacing).toBeNull()
    })
  })
})

describe('isSupportedFormatVersion', () => {
  it('accepts the current version and older minor versions of the same major version', () => {
    const [major, minor] = FORMAT_VERSION.split('.').map(Number) as [number, number]
    expect(isSupportedFormatVersion(FORMAT_VERSION)).toBe(true)
    expect(isSupportedFormatVersion(`${major}.0`)).toBe(true)
    expect(isSupportedFormatVersion(`${major}.${minor + 1}`)).toBe(false)
    expect(isSupportedFormatVersion(`${major + 1}.0`)).toBe(false)
    expect(isSupportedFormatVersion('not a version')).toBe(false)
  })
})

