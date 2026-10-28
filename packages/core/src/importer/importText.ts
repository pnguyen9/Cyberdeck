import { DEFAULT_POSITION_PRESETS } from '../format/storyFormat'
import { alwaysStops, readingFlow } from '../format/readingFlow'
import { styleClassName } from '../format/authorCss'
import { LARGE_WIDTH_SCALE, readStyleProperty } from '../format/textStyles'
import { paginate, type PageLayout } from '../pagination/paginate'
import type { TextRange } from '../pagination/textRange'
import {
  IMPORT_KINDS,
  type ChoiceNode,
  type ConditionNode,
  type LoopNode,
  type Directive,
  type ImportedChapter,
  type ImportKind,
  type ImportProblem,
  type ImportResult,
  type PageNode,
  type StyleSpan,
  type StoryNode,
} from './importTypes'
import { parseLine, type ParsedLine } from './parseLine'
import { closestStageKeyword, interpretStageDirective } from '../stage/stageDirectives'
import { flattenNodes, normalizeName } from './storyNodes'
import {
  argumentText,
  isControlDirective,
  readAddition,
  readAssignment,
  readCondition,
  readCounterDeclaration,
  readDecisionDeclaration,
} from './readControl'

export interface ImportOptions {
  layout: PageLayout
  /** Language of the text, for sentence boundaries: `fr`, `en`… */
  locale: string
  /** Characters the project already has: not suspected of being typos, and read whole when of several words. */
  knownCharacterNames?: readonly string[]
  /** Position presets of the project; the default ones when absent. */
  knownPositionNames?: readonly string[]
  /** The text goes inside a loop, a page edited there for instance: `[break]` belongs. */
  isInsideLoop?: boolean
  /**
   * How much wider than normal the project's styles draw text, by class name (`styleClassName`):
   * a paragraph holding one is cut as if all of it were that wide, so that its pages always fit.
   */
  styleWidthScales?: ReadonlyMap<string, number>
}

const CHAPTER_HEADING = /^#+\s*(.*)$/
const PLAIN_STYLE = 'plain'
/** `# Scene: Caught` opens a scene rather than a chapter. */
const SCENE_TITLE = /^scene\s*:(.*)$/i

/** `> Yes, I'll go out with you. = Accept`: the value follows the last ` = `. */
const OPTION_WITH_VALUE = /^(.*\S)\s+=\s*(\S.*)$/

/**
 * A name as tags read it: their words are split at spaces and commas, so `Yes, please` in a tag is
 * `Yes please`. Option lines are read whole: their values and conditions are made to match.
 */
function asInTags(text: string): string {
  return text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
}

/** `[if: …]` on an option's line, before or after its text. */
const OPTION_CONDITION = /\[\s*if\s*:([^\]]*)\]/i

/**
 * Turns a text into chapters of story nodes.
 *
 * Every non-empty line is a paragraph. A line starting with `#` opens a chapter, one starting
 * with `>` is an option of the choice above it. A paragraph longer than the textbox is cut into
 * several pages (see `paginate`). Directives alone on their line apply to the next page, unless
 * a choice, a block or the end of one comes first: they then become a stage node.
 *
 * The syntax is checked here, stage directives included since only the import knows the line
 * each one was written on; `checkReferences` checks the names of decisions, endings and memories.
 */
export function importText(input: string, options: ImportOptions): ImportResult {
  return new TextImporter(options).run(input)
}

class TextImporter {
  private readonly result: ImportResult = { kind: null, decisions: [], counters: [], styles: [], chapters: [], scenes: [], problems: [] }
  private currentChapter: ImportedChapter | null = null
  /** Names of the styles the text declares `large`. */
  private readonly largeStyles = new Set<string>()
  /** The chapter opened by content before any heading, rather than by one. */
  private untitledChapter: ImportedChapter | null = null
  /** Innermost last: nodes go into the last branch of the innermost open condition. */
  /** Conditions and loops not closed yet, the innermost last: `[end]` closes it. */
  private readonly openBlocks: (ConditionNode | LoopNode)[] = []
  private openChoice: ChoiceNode | null = null
  private pendingDirectives: Directive[] = []
  private pendingDirectivesLine: number | null = null
  private isFirstContentLine = true
  /** Checked once the whole text is read, when every speaker is known. */
  private readonly stageDirectives: { directive: Directive; line: number }[] = []
  private readonly speakers = new Set<string>()

  constructor(private readonly options: ImportOptions) {}

  run(input: string): ImportResult {
    // Styles declared large anywhere in the text, above their first use or below: pages are cut before declarations are all read.
    for (const declaration of input.matchAll(/\[\s*style\s*:([^=\]]+)=([^\]]*)\]/gi)) {
      if (/(^|[\s,])large($|[\s,])/i.test(declaration[2]!)) {
        this.largeStyles.add(normalizeName(declaration[1]!))
      }
    }
    input.replace(/\r\n?/g, '\n').split('\n').forEach((rawLine, lineIndex) => {
      this.readLine(rawLine.replace(/\t/g, ' ').trim(), lineIndex + 1)
    })
    this.finishChapter()
    this.dropPreamble()
    this.checkStageDirectives()
    this.checkReadingFlow()

    this.result.problems.sort((first, second) => first.line - second.line)
    return this.result
  }

  /**
   * Reports stage directives missing what they need, and those that would create a character
   * while their name looks like a misspelled keyword (`[backgound: rooftop]`).
   */

  /** Warns about endless loops, and once per run of nodes never reached, at its first one: a new chapter starts a new run. */
  private checkReadingFlow() {
    // A scene named twice is reported by the reference checks: the first one counts.
    const scenesByName = new Map(this.result.scenes.toReversed().map(scene => [normalizeName(scene.title ?? ''), scene]))
    const stopsByName = new Map<string, boolean>()
    const playStops = (play: StoryNode): boolean => {
      const name = play.type === 'play' ? normalizeName(play.scene) : ''
      if (!stopsByName.has(name)) {
        // A scene playing itself is reported by the reference checks; meanwhile it is taken to come back.
        stopsByName.set(name, false)
        const scene = scenesByName.get(name)
        stopsByName.set(name, scene !== undefined && alwaysStops(scene.nodes, playStops))
      }
      return stopsByName.get(name)!
    }
    const { unreachable, endlessLoops } = readingFlow(this.result.chapters.map(chapter => chapter.nodes), {
      scenes: this.result.scenes.map(scene => scene.nodes),
      playStops,
      conditionalChapters: new Set(this.result.chapters.flatMap((chapter, index) => chapter.condition === undefined ? [] : [index])),
    })
    for (const loop of endlessLoops) {
      this.result.problems.push({ severity: 'warning', code: 'endlessLoop', line: loop.sourceLine })
    }
    for (const chapter of [...this.result.chapters, ...this.result.scenes]) {
      let isAfterReached = true
      for (const node of flattenNodes(chapter.nodes)) {
        if (unreachable.has(node) && isAfterReached) {
          this.result.problems.push({ severity: 'warning', code: 'unreachable', line: node.sourceLine })
        }
        isAfterReached = !unreachable.has(node)
      }
    }
  }
  private checkStageDirectives() {
    const characterNames = [...(this.options.knownCharacterNames ?? []), ...this.speakers]
    const instructions = this.stageDirectives.map(({ directive, line }) => ({
      directive,
      line,
      instruction: interpretStageDirective(directive, {
        characterNames,
        positionNames: this.options.knownPositionNames ?? DEFAULT_POSITION_PRESETS.map(preset => preset.name),
      }),
    }))
    const knownCharacters = new Set([
      ...characterNames,
      ...instructions.flatMap(({ instruction }) => instruction?.type === 'enter' ? [instruction.character] : []),
    ].map(normalizeName))

    for (const { directive, line, instruction } of instructions) {
      if (instruction === null) {
        this.addProblem('error', 'invalidStageDirective', line, directive.name)
        continue
      }
      const suggestion = instruction.type === 'expression' && !knownCharacters.has(normalizeName(instruction.character))
        ? closestStageKeyword(instruction.character)
        : null
      if (suggestion !== null) {
        this.result.problems.push({ severity: 'warning', code: 'looksLikeStageKeyword', line, subject: directive.name, suggestion })
      }
    }
  }

  private readLine(line: string, lineNumber: number) {
    if (line === '') {
      return
    }
    if (line.startsWith('>')) {
      this.readOption(line.slice(1).trim(), lineNumber)
      this.isFirstContentLine = false
      return
    }
    this.closeChoice()

    const heading = CHAPTER_HEADING.exec(line)
    if (heading !== null) {
      this.finishChapter()
      const title = (heading[1] ?? '').trim()
      const scene = SCENE_TITLE.exec(title)
      if (scene === null) {
        this.currentChapter = { title: title === '' ? null : title, sourceLine: lineNumber, nodes: [] }
        this.result.chapters.push(this.currentChapter)
      } else {
        const name = (scene[1] ?? '').trim()
        if (name === '') {
          this.addProblem('error', 'missingSceneName', lineNumber)
        }
        this.currentChapter = { title: name, sourceLine: lineNumber, nodes: [] }
        this.result.scenes.push(this.currentChapter)
      }
      this.isFirstContentLine = false
      return
    }

    const parsedLine = parseLine(line)
    this.result.problems.push(...parsedLine.problems.map(problem => ({ ...problem, line: lineNumber })))
    this.takeImportDirectives(parsedLine, lineNumber)
    const styleSpans = this.takeStyleDirectives(parsedLine, lineNumber)
    this.isFirstContentLine = false
    if (parsedLine.speaker !== null) {
      this.speakers.add(parsedLine.speaker)
    }

    if (parsedLine.text === '') {
      for (const directive of parsedLine.directivesBefore) {
        if (isControlDirective(directive)) {
          this.readControlDirective(directive, lineNumber)
        } else {
          this.stageDirectives.push({ directive, line: lineNumber })
          this.addPendingDirective(directive, lineNumber)
        }
      }
      return
    }

    this.rejectControlDirectivesWithText(parsedLine, lineNumber)
    for (const directive of [...parsedLine.directivesBefore, ...parsedLine.inlineDirectives]) {
      this.stageDirectives.push({ directive, line: lineNumber })
    }
    this.addPages(parsedLine, lineNumber, styleSpans)
  }

  /**
   * Takes the `[style]` directives out of the line: declarations, which must be alone on it, and
   * the markers of styled parts, which become spans of the paragraph text. A style lasts until
   * `[style: none]`, another style, or the end of the paragraph.
   */
  private takeStyleDirectives(parsedLine: ParsedLine, lineNumber: number): StyleSpan[] {
    const markers = [
      ...parsedLine.directivesBefore.filter(directive => directive.name === 'style').map(directive => ({ directive, offset: 0 })),
      ...parsedLine.inlineDirectives.filter(directive => directive.name === 'style').map(directive => ({ directive, offset: directive.offset })),
    ]
    parsedLine.directivesBefore = parsedLine.directivesBefore.filter(directive => directive.name !== 'style')
    parsedLine.inlineDirectives = parsedLine.inlineDirectives.filter(directive => directive.name !== 'style')

    const spans: StyleSpan[] = []
    let open: { style: string; start: number } | null = null
    const close = (end: number) => {
      if (open !== null && end > open.start) {
        spans.push({ start: open.start, end, style: open.style })
      }
      open = null
    }
    for (const { directive, offset } of markers) {
      const text = argumentText(directive)
      if (text.includes('=')) {
        this.declareStyle(text, parsedLine.text === '', lineNumber)
      } else if (parsedLine.text === '') {
        this.addProblem('error', 'styleWithoutText', lineNumber)
      } else if (text !== '') {
        close(offset)
        open = text.toLowerCase() === 'none' ? null : { style: text, start: offset }
      }
    }
    close(parsedLine.text.length)
    return spans
  }

  private declareStyle(text: string, isAlone: boolean, lineNumber: number) {
    if (!isAlone) {
      this.addProblem('error', 'controlDirectiveWithText', lineNumber, 'style')
      return
    }
    const assignment = readAssignment(text)
    // `plain`: a style of no property of its own, drawn by the project's CSS alone.
    const words = assignment?.value.split(/[\s,]+/).filter(word => word !== '' && word.toLowerCase() !== PLAIN_STYLE) ?? []
    const isPlain = assignment !== null && words.length === 0 && assignment.value.trim().toLowerCase() === PLAIN_STYLE
    const invalidWord = assignment === null ? text : words.find(word => readStyleProperty(word) === null)
    if (invalidWord !== undefined || (words.length === 0 && !isPlain)) {
      this.addProblem('error', 'invalidStyle', lineNumber, invalidWord ?? text)
      return
    }
    this.result.styles.push({ sourceLine: lineNumber, name: assignment!.name, properties: words.map(word => readStyleProperty(word)!) })
    this.addNode({ type: 'definition', sourceLine: lineNumber, kind: 'style', name: assignment!.name })
  }

  private readOption(optionLine: string, lineNumber: number) {
    if (this.openChoice === null) {
      this.addProblem('error', 'optionOutsideChoice', lineNumber)
      return
    }
    if (optionLine === '') {
      this.addProblem('error', 'emptyOption', lineNumber)
      return
    }

    const conditionTag = OPTION_CONDITION.exec(optionLine)
    const condition = conditionTag === null ? undefined : readCondition(asInTags(conditionTag[1]!))
    if (condition?.type === 'invalid') {
      this.addProblem('error', 'invalidCondition', lineNumber, condition.text)
    }
    const optionText = conditionTag === null ? optionLine : optionLine.replace(conditionTag[0], ' ').replace(/\s+/g, ' ').trim()
    const optionWithValue = OPTION_WITH_VALUE.exec(optionText)
    const optionLetter = String.fromCharCode('A'.charCodeAt(0) + this.openChoice.options.length)
    this.openChoice.options.push({
      sourceLine: lineNumber,
      text: optionWithValue?.[1] ?? optionText,
      value: optionWithValue?.[2] === undefined ? optionLetter : asInTags(optionWithValue[2]),
      ...(condition === undefined ? {} : { condition }),
    })
  }

  private readControlDirective(directive: Directive, lineNumber: number) {
    const text = argumentText(directive)

    switch (directive.name) {
      case 'decision':
      case 'decision multi': {
        const declaration = readDecisionDeclaration(text)
        if (declaration === null) {
          this.addProblem('error', 'invalidDecision', lineNumber, text)
        } else {
          this.result.decisions.push({ sourceLine: lineNumber, ...declaration, multiple: directive.name === 'decision multi' })
          this.addNode({ type: 'definition', sourceLine: lineNumber, kind: 'decision', name: declaration.name })
        }
        return
      }
      case 'counter': {
        const declaration = readCounterDeclaration(text)
        if (declaration === null) {
          this.addProblem('error', 'invalidCounter', lineNumber, text)
        } else {
          this.result.counters.push({ sourceLine: lineNumber, ...declaration })
          this.addNode({ type: 'definition', sourceLine: lineNumber, kind: 'counter', name: declaration.name })
        }
        return
      }
      case 'add': {
        const addition = readAddition(text)
        if (addition === null) {
          this.addProblem('error', 'invalidAdd', lineNumber, text === '' ? undefined : text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'add', sourceLine: lineNumber, counter: addition.name, amount: addition.amount })
        return
      }
      case 'choice':
        if (text === '') {
          this.addProblem('error', 'missingDecisionName', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.openChoice = { type: 'choice', sourceLine: lineNumber, decision: text, options: [] }
        return
      case 'if': {
        this.flushPendingDirectives()
        const condition: ConditionNode = { type: 'condition', sourceLine: lineNumber, branches: [] }
        this.addNode(condition)
        this.openBlocks.push(condition)
        this.addBranch(condition, text, lineNumber)
        return
      }
      case 'else if':
      case 'else': {
        const condition = this.openBlocks.at(-1)
        if (condition?.type !== 'condition') {
          this.addProblem('error', 'elseWithoutIf', lineNumber)
          return
        }
        // After `[else]`, a branch would never be played.
        if (condition.branches.some(branch => branch.condition === null)) {
          this.addProblem('error', 'branchAfterElse', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addBranch(condition, directive.name === 'else' ? null : text, lineNumber)
        return
      }
      case 'end':
      case 'end if':
        if (this.openBlocks.length === 0) {
          this.addProblem('error', 'endWithoutIf', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.openBlocks.pop()
        return
      case 'loop': {
        this.flushPendingDirectives()
        const loop: LoopNode = { type: 'loop', sourceLine: lineNumber, nodes: [] }
        this.addNode(loop)
        this.openBlocks.push(loop)
        return
      }
      case 'only if': {
        // Only first in a chapter, definitions apart: a scene is played when asked, and a chapter cannot stop half way.
        const chapter = this.ensureChapter(lineNumber)
        if (this.result.scenes.includes(chapter) || chapter.nodes.some(node => node.type !== 'definition') || chapter.condition !== undefined || this.openChoice !== null) {
          this.addProblem('error', 'onlyIfMisplaced', lineNumber)
          return
        }
        const condition = readCondition(text)
        if (condition.type === 'invalid') {
          this.addProblem('error', 'invalidCondition', lineNumber, text)
        }
        chapter.condition = condition
        return
      }
      case 'play':
        if (text === '') {
          this.addProblem('error', 'missingSceneName', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'play', sourceLine: lineNumber, scene: text })
        return
      case 'break':
        if (!this.openBlocks.some(block => block.type === 'loop') && this.options.isInsideLoop !== true) {
          this.addProblem('error', 'breakOutsideLoop', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'break', sourceLine: lineNumber })
        return
      case 'set': {
        const assignment = readAssignment(text)
        if (assignment === null) {
          this.addProblem('error', 'invalidSet', lineNumber, text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'set', sourceLine: lineNumber, decision: assignment.name, value: assignment.value })
        return
      }
      case 'unset': {
        const assignment = text.includes('=') ? readAssignment(text) : text === '' ? null : { name: text, value: null }
        if (assignment === null) {
          this.addProblem('error', 'invalidUnset', lineNumber, text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'unset', sourceLine: lineNumber, decision: assignment.name, value: assignment.value })
        return
      }
      // Known, so as to explain what to write instead, rather than taken for a character named Jump.
      case 'label':
      case 'jump':
        this.addProblem('error', 'noJumps', lineNumber, directive.name)
        return
      case 'ending':
      case 'remember':
        if (text === '') {
          this.addProblem('error', directive.name === 'ending' ? 'missingEndingName' : 'missingMemoryName', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: directive.name, sourceLine: lineNumber, name: text })
        return
    }
  }

  /** `conditionText` is null for `[else]`. */
  private addBranch(condition: ConditionNode, conditionText: string | null, lineNumber: number) {
    const branchCondition = conditionText === null ? null : readCondition(conditionText)
    if (branchCondition?.type === 'invalid') {
      this.addProblem('error', 'invalidCondition', lineNumber, conditionText ?? undefined)
    }
    condition.branches.push({ sourceLine: lineNumber, condition: branchCondition, nodes: [] })
  }

  private addPages(parsedLine: ParsedLine, lineNumber: number, styleSpans: readonly StyleSpan[] = []) {
    const directivesBefore = [...this.pendingDirectives, ...parsedLine.directivesBefore]
    this.pendingDirectives = []
    this.pendingDirectivesLine = null

    const scale = Math.max(1, ...styleSpans.map(span => this.widthScaleOf(span.style)))
    const layout = scale === 1 ? this.options.layout : { ...this.options.layout, measureText: (text: string) => this.options.layout.measureText(text) * scale }
    const pageRanges = paginate(parsedLine.text, layout, this.options.locale)
    pageRanges.forEach((pageRange, pageIndex) => {
      const isLastPage = pageIndex === pageRanges.length - 1
      this.addNode(buildPage(parsedLine, pageRange, isLastPage, lineNumber, pageIndex === 0 ? directivesBefore : [], styleSpans))
    })
  }

  /** A style of the project, one declared above in the text, or a property alone: `large` draws text a little wider. */
  private widthScaleOf(styleName: string): number {
    const properties = this.largeStyles.has(normalizeName(styleName)) ? ['large'] : [readStyleProperty(styleName)]
    const fromProperties = properties.includes('large') ? LARGE_WIDTH_SCALE : 1
    return Math.max(fromProperties, this.options.styleWidthScales?.get(styleClassName(styleName)) ?? 1)
  }

  private addPendingDirective(directive: Directive, lineNumber: number) {
    this.ensureChapter(lineNumber)
    this.pendingDirectivesLine ??= lineNumber
    this.pendingDirectives.push(directive)
  }

  private flushPendingDirectives() {
    if (this.pendingDirectives.length > 0) {
      this.addNode({ type: 'stage', sourceLine: this.pendingDirectivesLine ?? 1, directives: this.pendingDirectives })
    }
    this.pendingDirectives = []
    this.pendingDirectivesLine = null
  }

  /** A choice ends at the first line that is not one of its options. */
  private closeChoice() {
    const choice = this.openChoice
    if (choice === null) {
      return
    }
    this.openChoice = null
    if (choice.options.length === 0) {
      this.addProblem('error', 'emptyChoice', choice.sourceLine, choice.decision)
      return
    }
    // The player skips a choice none of whose options holds: one always offered rules that out.
    if (choice.options.every(option => option.condition !== undefined)) {
      this.addProblem('warning', 'everyOptionConditional', choice.sourceLine)
    }
    this.addNode(choice)
  }

  private finishChapter() {
    this.closeChoice()
    this.flushPendingDirectives()
    for (const block of this.openBlocks.reverse()) {
      this.addProblem('error', block.type === 'loop' ? 'unclosedLoop' : 'unclosedIf', block.sourceLine)
    }
    this.openBlocks.length = 0
  }

  private addNode(node: StoryNode) {
    const innermostBlock = this.openBlocks.at(-1)
    const nodes = (innermostBlock?.type === 'loop' ? innermostBlock.nodes : innermostBlock?.branches.at(-1)?.nodes) ?? this.ensureChapter(node.sourceLine).nodes
    nodes.push(node)
  }

  private ensureChapter(sourceLine: number): ImportedChapter {
    if (this.currentChapter === null) {
      this.currentChapter = { title: null, sourceLine, nodes: [] }
      this.untitledChapter = this.currentChapter
      this.result.chapters.push(this.currentChapter)
    }
    return this.currentChapter
  }

  /**
   * Definitions written above the first heading of a text with headings belong to none of its
   * chapters: the whole story's, as an export writes them. They stay declared; only their place goes.
   */
  private dropPreamble() {
    const preamble = this.untitledChapter
    const hasHeadings = this.result.chapters.length + this.result.scenes.length > (preamble === null ? 0 : 1)
    if (preamble !== null && hasHeadings && preamble.condition === undefined && preamble.nodes.every(node => node.type === 'definition')) {
      this.result.chapters.splice(this.result.chapters.indexOf(preamble), 1)
    }
  }

  /** `[import: …]` declares the kind of import; it is not a stage directive. */
  private takeImportDirectives(parsedLine: ParsedLine, lineNumber: number) {
    const importDirectives = [...parsedLine.directivesBefore, ...parsedLine.inlineDirectives]
      .filter(directive => directive.name === 'import')
    parsedLine.directivesBefore = parsedLine.directivesBefore.filter(directive => directive.name !== 'import')
    parsedLine.inlineDirectives = parsedLine.inlineDirectives.filter(directive => directive.name !== 'import')

    for (const importDirective of importDirectives) {
      if (!this.isFirstContentLine) {
        this.addProblem('error', 'misplacedImportKind', lineNumber)
        continue
      }
      const declaredKind = argumentText(importDirective).toLowerCase()
      if (isImportKind(declaredKind)) {
        this.result.kind = declaredKind
      } else {
        this.addProblem('error', 'unknownImportKind', lineNumber, declaredKind)
      }
    }
  }

  /** Story structure cannot hide inside a paragraph: `[if]`, `[choice]`… must be alone on their line. */
  private rejectControlDirectivesWithText(parsedLine: ParsedLine, lineNumber: number) {
    for (const directive of [...parsedLine.directivesBefore, ...parsedLine.inlineDirectives].filter(isControlDirective)) {
      this.addProblem('error', 'controlDirectiveWithText', lineNumber, directive.name)
    }
    parsedLine.directivesBefore = parsedLine.directivesBefore.filter(directive => !isControlDirective(directive))
    parsedLine.inlineDirectives = parsedLine.inlineDirectives.filter(directive => !isControlDirective(directive))
  }

  private addProblem(severity: ImportProblem['severity'], code: ImportProblem['code'], line: number, subject?: string) {
    this.result.problems.push(subject === undefined ? { severity, code, line } : { severity, code, line, subject })
  }
}

function isImportKind(value: string): value is ImportKind {
  return (IMPORT_KINDS as readonly string[]).includes(value)
}

function buildPage(
  parsedLine: ParsedLine,
  pageRange: TextRange,
  isLastPage: boolean,
  sourceLine: number,
  directivesBefore: Directive[],
  styleSpans: readonly StyleSpan[],
): PageNode {
  const rawText = parsedLine.text.slice(pageRange.start, pageRange.end)
  const text = rawText.trim()
  const textStart = pageRange.start + (rawText.length - rawText.trimStart().length)

  const inlineDirectives = parsedLine.inlineDirectives
    .filter(directive => directive.offset >= pageRange.start && (directive.offset < pageRange.end || isLastPage))
    .map(directive => ({ ...directive, offset: Math.min(Math.max(directive.offset - textStart, 0), text.length) }))

  const styles = styleSpans
    .map(span => ({ ...span, start: Math.max(span.start - textStart, 0), end: Math.min(span.end - textStart, text.length) }))
    .filter(span => span.start < span.end)

  return {
    type: 'page',
    sourceLine,
    kind: parsedLine.kind,
    speaker: parsedLine.speaker,
    text,
    directivesBefore,
    inlineDirectives,
    ...(styles.length === 0 ? {} : { styles }),
  }
}
