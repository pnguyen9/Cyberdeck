import { describe, expect, it } from 'vitest'
import {
  applyImport,
  createProject,
  exportText,
  flattenStoredNodes,
  previewImport,
  StoryRuntime,
  type ChapterDocument,
  type ProjectDocument,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-26T12:00:00.000Z'

/** A new project made from the text, as Cyberdeck's import does. */
function projectFrom(text: string) {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
  const project = createProject({ name: 'Game', locale: 'en' }, environment)
  const preview = previewImport(text, project, monospaceLayout)
  expect(preview.problems).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null }, environment)
  const inOrder = (ids: string[]) => ids.map(id => applied.chapters.find(chapter => chapter.id === id)!)
  return { project: applied.project, chapters: inOrder(applied.project.chapterOrder), scenes: inOrder(applied.project.sceneOrder), environment }
}

const EVERYTHING = [
  '[import: story]',
  '[decision: Mood = Calm | Angry]',
  '[decision multi: Clues = Letter | Key]',
  '[style: Whisper = italic, small, grey]',
  '# Chapter 1 — The Letter',
  '[bg: classroom] [music: calm]',
  'The classroom was [style: italic]empty[style: none], [style: whisper]or so it seemed.',
  '[enter: marie left smile slide-from-left 0.8s wait]',
  '— Marie: I read your letter. [marie: surprised] Then I found [wait: 0.6] the second one.',
  '— Theo: I said I would.',
  '— ???: Who is there?',
  '[choice: Answer]',
  '> Tell the truth. = Truth',
  '> Dodge. [if: not seen ending Gone]',
  '[if: Answer is Truth and Mood is not Angry or remembered Secret]',
  '[set: Clues = Letter]',
  '— Marie: Thank you.',
  '[else if: seen ending Gone]',
  '— Marie: Again?',
  '[else]',
  '[exit: marie fade]',
  '[end]',
  '[loop]',
  '— Marie: Once more.',
  '[if: Mood is Calm]',
  '[break]',
  '[end]',
  '[set: Mood = Calm]',
  '[unset: Clues = Letter]',
  '[unset: Mood]',
  '[end]',
  '[remember: Secret]',
  '#',
  '[only if: Mood is not Angry or seen ending Gone]',
  '[transition: black 1.5s] [bg: rooftop] [tint: sepia]',
  '[enter: jules 35% facing-left]',
  '[move: jules center]',
  '— Jules: Cold.',
  'The wind did not stop. It never stops up here, and nobody ever came to see why that might be.',
  '[music: stop]',
  '[play: Rooftop talk]',
  '[ending: Gone]',
  '# Scene: Rooftop talk',
  "— Jules: Cold, isn't it? [shake: strong] [flash: red 0.2s]",
  '[fade out: white 2s]',
  'Then nothing.',
  '[illustration: Sunrise]',
  'Light.',
  '[cg: none]',
  '[fade in] [tint: none]',
  'Morning.',
].join('\n')

const structureOf = (chapters: ChapterDocument[]) => chapters.map(chapter => ({
  title: chapter.title,
  nodes: flattenStoredNodes(chapter.nodes).map(node => node.type === 'page' ? `${node.kind} ${node.text} (${node.commandsBefore.length}+${node.inlineCommands.map(command => command.offset).join(',')})` : node.type),
}))

describe('exportText', () => {
  it('writes what imports back into the same story', () => {
    const first = projectFrom(EVERYTHING)
    const exported = exportText(first.project, first.chapters, { declareDecisions: true, scenes: first.scenes })
    const second = projectFrom(exported)

    expect(exportText(second.project, second.chapters, { declareDecisions: true, scenes: second.scenes })).toBe(exported)
    expect(exported).toContain('[play: Rooftop talk]\n[ending: Gone]\n# Scene: Rooftop talk\n')
    expect(structureOf([...second.chapters, ...second.scenes])).toEqual(structureOf([...first.chapters, ...first.scenes]))
    expect(second.project.decisions.map(decision => [decision.name, decision.multiple, decision.values.map(value => value.name)]))
      .toEqual(first.project.decisions.map(decision => [decision.name, decision.multiple, decision.values.map(value => value.name)]))
  })

  it('writes each page as its own paragraph, directives where they were', () => {
    const { project, chapters } = projectFrom(EVERYTHING)
    const lines = exportText(project, chapters, { declareDecisions: true }).split('\n')

    // Answer is made by its choice: declared nowhere, it is not written as a declaration.
    expect(lines.slice(0, 13)).toEqual([
      '[import: story]',
      '[decision: Mood = Calm | Angry]',
      '[decision multi: Clues = Letter | Key]',
      '[style: Whisper = italic, small, grey]',
      '# Chapter 1 — The Letter',
      '[bg: classroom]',
      '[music: calm]',
      'The classroom was [style: italic]empty[style: none], [style: Whisper]or so it seemed.',
      '[enter: Marie left smile slide-from-left 0.8s wait]',
      '— Marie: I read your letter. [Marie: surprised]Then I found [wait: 0.6]the second one.',
      '— Theo: I said I would.',
      '— ???: Who is there?',
      '[choice: Answer]',
    ])
    expect(lines).toContain('[if: Answer is Truth and Mood is not Angry or remembered Secret]')
    expect(lines).toContain('#')
    expect(lines.filter(line => /wind|never|nobody/.test(line)).length).toBeGreaterThan(1)
  })

  it('writes conditions without parentheses, `and` distributed over `or`', () => {
    const { project, chapters } = projectFrom(['[decision: A = Yes | No]', '[decision: B = Yes | No]', '[decision: C = Yes | No]', '[if: A is Yes]', 'Hm.', '[end]'].join('\n'))
    const [a, b, c] = project.decisions.map(decision => ({ decisionId: decision.id, valueId: decision.values[0]!.id }))
    const condition = { type: 'and' as const, conditions: [{ type: 'is' as const, ...a!, negated: false }, { type: 'or' as const, conditions: [{ type: 'is' as const, ...b!, negated: false }, { type: 'is' as const, ...c!, negated: true }] }] }
    const chapter = chapters[0]!
    const edited = { ...chapter, nodes: chapter.nodes.map(node => node.type === 'condition' ? { ...node, branches: [{ ...node.branches[0]!, condition }] } : node) }

    expect(exportText(project, [edited], { declareDecisions: false })).toContain('[if: A is Yes and B is Yes or A is Yes and C is not Yes]')
  })
})

describe('text that could be misread', () => {
  it('keeps values written with commas, and pages starting with # or >, the same through export and import', () => {
    const first = projectFrom(['[choice: Answer]', '> Sure = Yes, please', '> No', '[if: Answer is Yes, please]', '[sound: bell]#1 rule of the house.', '[end]', '[wait: 0.2]>_< That hurt.'].join('\n'))
    const exported = exportText(first.project, first.chapters, { declareDecisions: true, scenes: first.scenes })
    const second = projectFrom(exported)
    expect(exportText(second.project, second.chapters, { declareDecisions: true, scenes: second.scenes })).toBe(exported)
    expect(second.chapters).toHaveLength(1)
    expect(second.project.decisions[0]!.values.map(value => value.name)).toEqual(['Yes please', 'B'])
  })
})

describe('replacing a chapter by its edited text', () => {
  it('keeps its place and identifier, so that saves inside it resume there', () => {
    const { project, chapters, environment } = projectFrom('# One\nHello.\n# Two\nThe end.\n# Three\nAfter.')
    const two = chapters[1]!
    const edited = exportText(project, [two], { declareDecisions: false }).replace('The end.', 'The end.\nReally the end.')

    const preview = previewImport(edited, project, monospaceLayout)
    expect(preview.problems).toEqual([])
    const applied = applyImport(preview, project, chapters, { type: 'replaceChapter', chapterId: two.id }, { fileName: 'two.txt' }, environment)

    expect(applied.project.chapterOrder).toEqual(project.chapterOrder)
    const replaced = applied.chapters.find(chapter => chapter.id === two.id)!
    expect(flattenStoredNodes(replaced.nodes).flatMap(node => node.type === 'page' ? [node.text] : [])).toEqual(['The end.', 'Really the end.'])

    const updatedChapters = chapters.map(chapter => applied.chapters.find(changed => changed.id === chapter.id) ?? chapter)
    const runtime = new StoryRuntime({ project: applied.project, chapters: updatedChapters, assetUrls: new Map() } satisfies { project: ProjectDocument; chapters: ChapterDocument[]; assetUrls: Map<string, string> })
    expect(runtime.restoreState({ ...runtime.exportState(), page: { chapterId: two.id, nodeId: 'gone' } })).toBe('chapterStart')
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('The end.')
  })
})
