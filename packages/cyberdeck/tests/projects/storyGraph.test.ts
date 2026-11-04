import { applyImport, createProject, previewImport } from '@cyberdeck/core'
import { describe, expect, it } from 'vitest'
import { layOutStoryGraph, type GraphWords } from '../../src/projects/storyGraph'

const layout = { lineWidth: 40, maxLines: 2, measureText: (text: string) => [...text].length }
const WORDS: GraphWords = {
  pages: count => `${count} pages`,
  untitledChapter: 'Untitled',
  scene: title => `Scene: ${title}`,
  onlyIf: condition => `only if ${condition}`,
  loop: 'loop',
  outOfTheLoop: 'out of the loop',
  otherwise: 'else',
  elseIf: condition => `else if ${condition}`,
  ifCondition: condition => `if ${condition}`,
  choice: decision => `Choice: ${decision}`,
}

function graphOf(text: string) {
  const project = createProject({ name: 'Graph', locale: 'en' })
  const preview = previewImport(text, project, layout)
  expect(preview.problems.filter(problem => problem.severity === 'error')).toEqual([])
  const applied = applyImport(preview, project, [], { type: 'newChapters' }, { fileName: null })
  const byId = new Map(applied.chapters.map(chapter => [chapter.id, chapter]))
  const ordered = (ids: string[]) => ids.map(id => byId.get(id)!)
  return layOutStoryGraph(applied.project, ordered(applied.project.chapterOrder), ordered(applied.project.sceneOrder), WORDS)
}

describe('the graph of the story', () => {
  it('forks a block into its branches side by side, and goes round it when it has no [else]', () => {
    const graph = graphOf('# One\nA.\n[choice: Door]\n> Open\n> Leave\n[if: Door is A]\nInside.\n[ending: In]\n[else if: Door is B]\nOutside.\n[end]\nAfter.')
    expect(graph.boxes.map(box => `${box.kind} ${box.label}`)).toEqual([
      'chapter One',
      'pages 1 pages',
      'choice Choice: Door',
      'fork if Door is A',
      'branch if Door is A',
      'pages 1 pages',
      'ending ★ In',
      'branch else if Door is B',
      'pages 1 pages',
      'pages 1 pages',
    ])
    const [first, second] = graph.boxes.filter(box => box.kind === 'branch')
    expect(first!.y).toBe(second!.y)
    expect(first!.x).toBeLessThan(second!.x)
    // Into each branch, out of the one that does not end, and round the block: no [else].
    const fork = graph.boxes.find(box => box.kind === 'fork')!
    expect(graph.edges.filter(edge => edge.points[0]!.y === fork.y + fork.height)).toHaveLength(3)
  })

  it('sets scenes apart, linked to each play that calls them', () => {
    const graph = graphOf('# One\n[play: Caught]\nAfter.\n# Scene: Caught\nStop.\n[ending: Caught]')
    const scene = graph.boxes.find(box => box.kind === 'scene')!
    const play = graph.boxes.find(box => box.kind === 'play')!
    expect(play.label).toBe('▷ Scene: Caught')
    expect(scene.x).toBeGreaterThan(play.x + play.width)
    expect(graph.edges.filter(edge => edge.kind === 'play')).toHaveLength(1)
  })
})
