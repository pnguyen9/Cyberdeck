import { describe, expect, it } from 'vitest'
import {
  addEmptyDocument,
  applyDefinitions,
  applyImport,
  applyNodeEdit,
  createGameArchive,
  createProject,
  definitionsOf,
  definitionsText,
  exportText,
  flattenStoredNodes,
  indexNames,
  nameWarnings,
  placeLabels,
  previewDefinitions,
  previewImport,
  previewNodeEdit,
  readGameArchive,
  removeNodes,
  storyFlow,
  type ChapterDocument,
  type ProjectDocument,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-28T12:00:00.000Z'

function projectFrom(text: string) {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
  const project = createProject({ name: 'Game', locale: 'en' }, environment)
  const preview = previewImport(text, project, monospaceLayout)
  expect(preview.problems).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null }, environment)
  return { project: applied.project, chapters: applied.chapters, environment }
}

const STORY = `[import: story]
[decision: Route = Marie | Jules]
[style: Whisper = italic, grey]
# Chapter 1
[decision multi: Clues = Letter | Key]
[choice: Answer]
> Yes = Yes
> No = No
[if: Route is Marie and Answer is Yes]
— Marie: [style: whisper]Come.[style: none]
[end]
[set: Clues = Letter]
# Chapter 2
[if: Clues is Key]
A key.
[end]
[ending: Gone]`

const definitionNodes = (chapter: ChapterDocument) => flattenStoredNodes(chapter.nodes).filter(node => node.type === 'definition')
const decisionNamed = (project: ProjectDocument, name: string) => project.decisions.find(decision => decision.name === name)!

describe('where definitions live', () => {
  it('keeps those above the first heading in the definitions, those of a chapter in it, and marks those made by a choice', () => {
    const { project, chapters } = projectFrom(STORY)
    expect(definitionNodes(chapters[0]!)).toEqual([{ type: 'definition', id: expect.any(String), kind: 'decision', definedId: decisionNamed(project, 'Clues').id }])
    expect(definitionNodes(chapters[1]!)).toEqual([])
    expect(decisionNamed(project, 'Answer').implicit).toBe(true)
    expect(decisionNamed(project, 'Route').implicit).toBeUndefined()
    expect(definitionsText(project, chapters)).toBe('[decision: Route = Marie | Jules]\n[style: Whisper = italic, grey]')
    expect(definitionsOf(chapters[0]!, project)).toEqual(['Clues'])
  })

  it('writes each where it lives, so that the text imports back the same', () => {
    const { project, chapters } = projectFrom(STORY)
    const text = exportText(project, chapters, { declareDecisions: true })
    expect(text.split('\n').slice(0, 5)).toEqual(['[import: story]', '[decision: Route = Marie | Jules]', '[style: Whisper = italic, grey]', '# Chapter 1', '[decision multi: Clues = Letter | Key]'])
    const again = projectFrom(text)
    expect(exportText(again.project, again.chapters, { declareDecisions: true })).toBe(text)
  })

  it('lets a chapter declare again what lives in the definitions, which then lives there', () => {
    const state = projectFrom(STORY)
    const chapter = state.chapters[1]!
    const target = { type: 'insert' as const, slot: { containerId: null, index: 0 } }
    const preview = previewNodeEdit('[decision: Route = Marie | Jules | Theo]', state.project, state.chapters, chapter.id, target, monospaceLayout)
    expect(preview.problems).toEqual([])
    const applied = applyNodeEdit(preview, state.project, state.chapters, chapter.id, target, state.environment)
    const route = decisionNamed(applied.project, 'Route')
    expect(route.values.map(value => value.name)).toEqual(['Marie', 'Jules', 'Theo'])
    expect(route.id).toBe(decisionNamed(state.project, 'Route').id)
    expect(definitionNodes(applied.chapter)).toHaveLength(1)
    expect(definitionsText(applied.project, [state.chapters[0]!, applied.chapter])).toBe('[style: Whisper = italic, grey]')
  })

  it('refuses a second declaration elsewhere, saying where the first one is', () => {
    const state = projectFrom(STORY)
    const preview = previewNodeEdit('[decision multi: Clues = Letter | Key | Map]', state.project, state.chapters, state.chapters[1]!.id, { type: 'insert', slot: { containerId: null, index: 0 } }, monospaceLayout)
    expect(preview.problems).toEqual([{ severity: 'error', code: 'duplicateDecision', line: 1, subject: 'Clues', suggestion: 'Chapter 1 · at the start' }])
  })

  it('lets the declaration be edited in place, but keeps the values still used elsewhere', () => {
    const state = projectFrom(STORY)
    const chapter = state.chapters[0]!
    const target = { type: 'replace' as const, nodeId: definitionNodes(chapter)[0]!.id }
    const dropsKey = previewNodeEdit('[decision multi: Clues = Letter]', state.project, state.chapters, chapter.id, target, monospaceLayout)
    expect(dropsKey.problems).toEqual([{ severity: 'error', code: 'decisionValueStillUsed', line: 1, subject: 'Clues: Key' }])
    const addsMap = previewNodeEdit('[decision multi: Clues = Letter | Key | Map]', state.project, state.chapters, chapter.id, target, monospaceLayout)
    expect(addsMap.problems).toEqual([])
    const applied = applyNodeEdit(addsMap, state.project, state.chapters, chapter.id, target, state.environment)
    expect(definitionNodes(applied.chapter).map(node => node.id)).toEqual([target.nodeId])
  })

  it('lets later choices add values to a decision made by choices', () => {
    const state = projectFrom(STORY)
    const preview = previewNodeEdit('[choice: Answer]\n> Maybe = Maybe', state.project, state.chapters, state.chapters[1]!.id, { type: 'insert', slot: { containerId: null, index: 0 } }, monospaceLayout)
    expect(preview.problems).toEqual([])
    const applied = applyNodeEdit(preview, state.project, state.chapters, state.chapters[1]!.id, { type: 'insert', slot: { containerId: null, index: 0 } }, state.environment)
    expect(decisionNamed(applied.project, 'Answer').values.map(value => value.name)).toEqual(['Yes', 'No', 'Maybe'])
  })

  it('moves a definition removed from its chapter to the definitions', () => {
    const { project, chapters } = projectFrom(STORY)
    const chapter = removeNodes(chapters[0]!, [definitionNodes(chapters[0]!)[0]!.id], NOW)
    expect(definitionsText(project, [chapter, chapters[1]!])).toContain('[decision multi: Clues = Letter | Key]')
  })

  it('leaves definitions out of games, which are stamped for the oldest Datajack that plays them', async () => {
    const { project, chapters } = projectFrom(STORY)
    const archive = await readGameArchive(await createGameArchive({ project, chapters, includedChapterIds: project.chapterOrder, release: '1.1', exportedAt: new Date(NOW), readAsset: async () => new Uint8Array() }))
    expect(archive.chapters.flatMap(chapter => definitionNodes(chapter))).toEqual([])
    expect(archive.manifest.project.formatVersion).toBe('1.1')
    const glowing: ProjectDocument = { ...project, styles: [...project.styles, { id: 'glow', name: 'Glow', properties: ['glow'] }] }
    const newer = await readGameArchive(await createGameArchive({ project: glowing, chapters, includedChapterIds: project.chapterOrder, release: '1.1', exportedAt: new Date(NOW), readAsset: async () => new Uint8Array() }))
    expect(newer.manifest.project.formatVersion).toBe('1.2')
  })
})

describe('what 1.1.0 was reviewed for', () => {
  it('keeps an [only if] valid under a declaration, and a value written twice once', () => {
    const { project, chapters } = projectFrom('# One\n[decision: X = a | A | b]\n[only if: X is a]\nText.')
    expect(chapters[0]!.condition).toBeDefined()
    expect(decisionNamed(project, 'X').values.map(value => value.name)).toEqual(['a', 'b'])
  })

  it('writes a story that imports back into a new project, decisions no choice makes any more and styles of the CSS included', () => {
    const state = projectFrom('[choice: Answer]\n> Yes = Yes\n# Two\n[if: Answer is Yes]\nYes.\n[end]')
    const withoutChoice = state.chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.filter(node => node.type !== 'choice') }))
    const styled: ProjectDocument = { ...state.project, css: '.ghost { color: red }', styles: [{ id: 'ghost', name: 'ghost', properties: [], implicit: true }] }
    const text = exportText(styled, withoutChoice, { declareDecisions: true })
    expect(text).toContain('[decision: Answer = Yes]')
    expect(text).toContain('[style: ghost = plain]')
    expect(previewImport(text, createProject({ name: 'Again', locale: 'en' }), monospaceLayout).problems).toEqual([])
  })

  it('takes out of the definitions only what was deleted from the text the author started from', () => {
    const { project, chapters } = projectFrom(`${STORY}\n[decision: Lone = A]`)
    const moved = removeNodes(chapters[1]!, [definitionNodes(chapters[1]!)[0]!.id], NOW)
    const preview = previewDefinitions('[decision: Route = Marie | Jules]\n[style: Whisper = italic, grey]', project, [chapters[0]!, moved], monospaceLayout, {
      baseText: '[decision: Route = Marie | Jules]\n[style: Whisper = italic, grey]',
    })
    expect(preview.removedIds).toEqual({ decisions: [], styles: [] })
  })
})

describe('the definitions tab', () => {
  it('declares, redeclares and takes out what is unused, but nothing still used', () => {
    const { project, chapters } = projectFrom(`${STORY}\n[decision: Unused = A | B]`)
    const keepsAll = previewDefinitions('[decision: Route = Marie | Jules]\n[style: Whisper = italic]\n[decision: Mood = Calm]', project, chapters, monospaceLayout)
    expect(keepsAll.problems).toEqual([])
    const saved = applyDefinitions(keepsAll, project, { createId: () => 'new', now: () => NOW })
    // Unused lives in Chapter 2: the definitions tab does not hold it.
    expect(saved.decisions.map(decision => decision.name)).toEqual(['Route', 'Clues', 'Unused', 'Answer', 'Mood'])
    expect(saved.styles.find(style => style.name === 'Whisper')?.properties).toEqual(['italic'])
    expect(saved.chapterOrder).toEqual(project.chapterOrder)

    const dropsRoute = previewDefinitions('[style: Whisper = italic, grey]', project, chapters, monospaceLayout)
    expect(dropsRoute.problems).toEqual([{ severity: 'error', code: 'definitionStillUsed', line: 0, subject: 'Route' }])
    const takesPages = previewDefinitions('Hello.\n[decision multi: Clues = Letter]', project, chapters, monospaceLayout)
    expect(takesPages.problems.map(problem => problem.code)).toEqual(['definitionStillUsed', 'definitionStillUsed', 'notADefinition', 'duplicateDecision'])
  })
})

describe('the index of names', () => {
  it('never takes the styles of title cards and the end screen for unused', () => {
    const { project, chapters } = projectFrom('[style: Chapter title = gold]\n[style: Ending = red]\n[style: Unused = bold]\nA page.')
    expect(nameWarnings(indexNames(project, chapters), project, storyFlow(chapters, [])).map(warning => warning.name.name)).toEqual(['Unused'])
  })

  it('lists every use, and what looks forgotten', () => {
    const { project, chapters } = projectFrom(`${STORY}\n[decision: Unused = A | B]`)
    const index = indexNames(project, chapters)
    const clues = index.find(name => name.kind === 'decision' && name.name === 'Clues')!
    expect(clues.uses.map(entry => entry.role)).toEqual(['declared', 'set', 'tested'])
    const labels = placeLabels(chapters[0]!, project)
    expect(clues.uses.map(entry => entry.nodeId === null ? null : labels.get(entry.nodeId) ?? null)).toEqual(['at the start', 'after 2a', null])
    const warnings = nameWarnings(index, project, storyFlow(chapters, []))
    expect(warnings.map(warning => `${warning.severity} ${warning.code} ${warning.name.name}${warning.valueName === undefined ? '' : `: ${warning.valueName}`}`)).toEqual([
      'warning testedNeverGiven Route',
      'warning valueTestedNeverGiven Clues: Key',
      'notice declaredNeverUsed Unused',
    ])
  })
})

describe('a story begun without a text', () => {
  it('adds an empty chapter at the end of the story, or an empty scene', () => {
    let nextId = 1
    const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
    const project = createProject({ name: 'Blank', locale: 'en' }, environment)
    const chapter = addEmptyDocument(project, 'chapter', 'Chapter 1', environment)
    const scene = addEmptyDocument(chapter.project, 'scene', ' Scene 1 ', environment)
    expect(scene.project.chapterOrder).toEqual([chapter.document.id])
    expect(scene.project.sceneOrder).toEqual([scene.document.id])
    expect([chapter.document.title, scene.document.title, chapter.document.nodes]).toEqual(['Chapter 1', 'Scene 1', []])
  })
})
