import { describe, expect, it } from 'vitest'
import {
  applyImport,
  applyNodeEdit,
  createProject,
  flattenStoredNodes,
  nodesText,
  previewImport,
  previewNodeEdit,
  type ChapterDocument,
  type NodeEditTarget,
  type ProjectDocument,
  type StoredPage,
} from '../../src/index'
import { monospaceLayout } from '../monospaceLayout'

const NOW = '2026-10-26T12:00:00.000Z'

function projectFrom(lines: string[]) {
  let nextId = 1
  const environment = { createId: () => `id-${nextId++}`, now: () => NOW }
  const project = createProject({ name: 'Game', locale: 'en' }, environment)
  const preview = previewImport(lines.join('\n'), project, monospaceLayout)
  expect(preview.problems).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null }, environment)
  return { project: applied.project, chapters: applied.chapters, environment }
}

function edit(state: { project: ProjectDocument; chapters: ChapterDocument[]; environment: { createId: () => string; now: () => string } }, target: NodeEditTarget, text: string) {
  const chapter = state.chapters[0]!
  const preview = previewNodeEdit(text, state.project, state.chapters, chapter.id, target, monospaceLayout)
  return { preview, applied: preview.hasErrors ? null : applyNodeEdit(preview, state.project, state.chapters, chapter.id, target, state.environment) }
}

const pageOf = (chapter: ChapterDocument, text: string) => flattenStoredNodes(chapter.nodes).find((node): node is StoredPage => node.type === 'page' && node.text === text)!
const pageTexts = (chapter: ChapterDocument) => flattenStoredNodes(chapter.nodes).flatMap(node => node.type === 'page' ? [node.text] : [])

describe('editing a page as text', () => {
  it('shows the page as the lines that import into it', () => {
    const { project, chapters } = projectFrom(['[bg: street]', '— Marie: I read it. [marie: surprised] Then I saw.'])
    const page = flattenStoredNodes(chapters[0]!.nodes)[0]!
    expect(nodesText(project, [page])).toBe('[bg: street]\n— Marie: I read it. [Marie: surprised]Then I saw.')
  })

  it('replaces the page, keeping its identifier for saves', () => {
    const state = projectFrom(['First.', '— Marie: Hello.', 'Last.'])
    const page = pageOf(state.chapters[0]!, 'Hello.')
    const { applied } = edit(state, { type: 'replace', nodeId: page.id }, '— Marie: Hello again. [marie: smile]')

    const chapter = applied!.chapter
    expect(pageTexts(chapter)).toEqual(['First.', 'Hello again.', 'Last.'])
    const edited = pageOf(chapter, 'Hello again.')
    expect(edited.id).toBe(page.id)
    expect(edited.inlineCommands).toHaveLength(1)
    expect(applied!.project.characters.find(character => character.name === 'Marie')?.expressions.map(expression => expression.name)).toEqual(['smile'])
  })

  it('cuts a page grown too long, as an import does', () => {
    const state = projectFrom(['Short.'])
    const page = pageOf(state.chapters[0]!, 'Short.')
    const { applied } = edit(state, { type: 'replace', nodeId: page.id }, 'The wind did not stop. It never stops up here, and nobody ever came to see why that might be.')
    expect(pageTexts(applied!.chapter).length).toBeGreaterThan(1)
    expect(applied!.nodeIds).toHaveLength(pageTexts(applied!.chapter).length)
  })

  it('inserts new pages at a slot, creating the characters they name', () => {
    const state = projectFrom(['First.', 'Last.'])
    const { applied } = edit(state, { type: 'insert', slot: { containerId: null, index: 1 } }, '— Jules: I am new here.')
    expect(pageTexts(applied!.chapter)).toEqual(['First.', 'I am new here.', 'Last.'])
    expect(applied!.project.characters.map(character => character.name)).toEqual(['Jules'])
  })

  it('accepts a break written inside a loop, and refuses one outside', () => {
    const state = projectFrom(['[loop]', 'Again.', '[break]', '[end]', 'After.'])
    const again = pageOf(state.chapters[0]!, 'Again.')
    expect(edit(state, { type: 'replace', nodeId: again.id }, 'Again.\n[break]').preview.problems).toEqual([])
    const after = pageOf(state.chapters[0]!, 'After.')
    expect(edit(state, { type: 'replace', nodeId: after.id }, 'After.\n[break]').preview.problems.map(problem => problem.code)).toEqual(['breakOutsideLoop'])
  })

  it('refuses unknown names and chapter headings', () => {
    const state = projectFrom(['Hello.'])
    const page = pageOf(state.chapters[0]!, 'Hello.')
    expect(edit(state, { type: 'replace', nodeId: page.id }, '[if: Mood is Sad]\nHm.\n[end]').preview.problems.map(problem => problem.code)).toEqual(['unknownDecision'])
    expect(edit(state, { type: 'replace', nodeId: page.id }, '# Another chapter\nHm.').preview.problems.map(problem => problem.code)).toEqual(['chapterHeadingInEdit'])
  })
})
