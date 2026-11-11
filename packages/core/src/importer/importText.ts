import { DEFAULT_POSITION_PRESETS } from '../format/storyFormat'
import { languageCode } from '../format/languages'
import { alwaysStops, readingFlow } from '../format/readingFlow'
import { styleClassName } from '../format/authorCss'
import { addPossibleValue, counterTexts, isAskableName, MAXIMUM_ASKED_NAME_LENGTH, measuringValues, type PossibleValues } from '../format/textValues'
import { LARGE_WIDTH_SCALE, readStyleProperty } from '../format/textStyles'
import { paginate, type PageLayout } from '../pagination/paginate'
import type { TextRange } from '../pagination/textRange'
import {
  IMPORT_KINDS,
  type ChoiceNode,
  type ConditionNode,
  type GridNode,
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
import { readListItems } from '../format/lists'
import { MAXIMUM_GRID } from '../format/storyFormat'
import {
  argumentText,
  isControlDirective,
  readAddition,
  readAssignment,
  readChoiceHeading,
  readCondition,
  readCounterDeclaration,
  readDecisionDeclaration,
  readAskNumber,
  readGauge,
  readRandom,
  declarationKind,
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
  /** What each value of the project may show (`possibleValues`), for the `{…}` of pages. */
  possibleValues?: PossibleValues
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
/** More options than this fit on the screen only in a list that scrolls. */
const MANY_OPTIONS = 8

/** `[timeout]` on an option's line: the option taken when the time of the choice runs out. */
const OPTION_TIMEOUT = /\[\s*timeout\s*\]/i

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

/**
 * What each value may show once the text is read: the project's, and what the text declares, sets
 * or offers anywhere in it, above its first use or below, since pages are cut as lines are read.
 */
function valuesDeclaredIn(input: string, known: PossibleValues = new Map()): Map<string, string[]> {
  const possible = new Map([...known].map(([name, texts]) => [name, [...texts]]))
  let choiceName: string | null = null
  for (const line of input.split(/\r\n?|\n/)) {
    const trimmed = line.trim()
    const option = trimmed.startsWith('>') ? OPTION_WITH_VALUE.exec(trimmed.slice(1).replace(/\[[^\]]*\]/g, '').trim()) : null
    if (option !== null && choiceName !== null) {
      addPossibleValue(possible, choiceName, asInTags(option[2]!))
    }
    for (const tag of trimmed.matchAll(/\[\s*([a-z ]+?)\s*:([^\]]*)\]/gi)) {
      const name = tag[1]!.toLowerCase().replace(/\s+/g, ' ')
      const text = tag[2]!.trim()
      const declared = declarationKind(name)
      if (name === 'choice') {
        choiceName = readChoiceHeading(text).decision
      } else if (declared?.kind === 'decision') {
        const declaration = readDecisionDeclaration(text)
        if (declaration !== null) {
          for (const shown of declared.multiple ? [declaration.values.join(', ')] : declaration.values) {
            addPossibleValue(possible, declaration.name, shown)
          }
        }
      } else if (declared?.kind === 'counter') {
        const declaration = readCounterDeclaration(text)
        if (declaration !== null) {
          for (const shown of counterTexts(String(declaration.initial), declaration.decimals)) {
            addPossibleValue(possible, declaration.name, shown)
          }
        }
      } else if (name === 'set') {
        const assignment = readAssignment(text)
        const draw = assignment === null ? null : readRandom(assignment.value)
        if (assignment !== null) {
          for (const shown of draw === null ? [assignment.value] : [String(draw.minimum), String(draw.maximum)]) {
            addPossibleValue(possible, assignment.name, shown)
          }
        }
      }
    }
  }
  return possible
}

class TextImporter {
  private readonly result: ImportResult = { kind: null, language: null, decisions: [], counters: [], styles: [], chapters: [], scenes: [], shown: [], problems: [] }
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
  /** Pages are measured with each `{…}` as wide as the widest it may show. */
  private measureText: PageLayout['measureText']
  /** The decisions and counters the project and the text name, with what each may show. */
  private valuesKnown: ReadonlyMap<string, readonly string[]> = new Map()

  /** The language pages are cut for: the one given, unless the text says its own on its first line. */
  private locale: string

  constructor(private readonly options: ImportOptions) {
    this.measureText = options.layout.measureText
    this.locale = options.locale
  }

  run(input: string): ImportResult {
    // Styles declared large anywhere in the text, above their first use or below: pages are cut before declarations are all read.
    for (const declaration of input.matchAll(/\[\s*style\s*:([^=\]]+)=([^\]]*)\]/gi)) {
      if (/(^|[\s,])large($|[\s,])/i.test(declaration[2]!)) {
        this.largeStyles.add(normalizeName(declaration[1]!))
      }
    }
    this.valuesKnown = valuesDeclaredIn(input, this.options.possibleValues)
    this.measureText = measuringValues(this.options.layout.measureText, this.valuesKnown)
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
    if (line.startsWith('>') && this.gridAwaitingCaption !== null && this.openChoice === null) {
      // The line right under a grid is what the text box shows while it waits.
      this.gridAwaitingCaption.caption = line.slice(1).trim()
      this.gridAwaitingCaption = null
      return
    }
    this.gridAwaitingCaption = null
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

    const timeoutTag = OPTION_TIMEOUT.exec(optionLine)
    const withoutTimeout = timeoutTag === null ? optionLine : optionLine.replace(timeoutTag[0], ' ')
    const conditionTag = OPTION_CONDITION.exec(withoutTimeout)
    const condition = conditionTag === null ? undefined : readCondition(asInTags(conditionTag[1]!))
    if (condition?.type === 'invalid') {
      this.addProblem('error', 'invalidCondition', lineNumber, condition.text)
    }
    const optionText = (conditionTag === null ? withoutTimeout : withoutTimeout.replace(conditionTag[0], ' ')).replace(/\s+/g, ' ').trim()
    const optionWithValue = OPTION_WITH_VALUE.exec(optionText)
    const optionLetter = String.fromCharCode('A'.charCodeAt(0) + this.openChoice.options.length)
    this.openChoice.options.push({
      sourceLine: lineNumber,
      text: optionWithValue?.[1] ?? optionText,
      value: optionWithValue?.[2] === undefined ? optionLetter : asInTags(optionWithValue[2]),
      ...(condition === undefined ? {} : { condition }),
      ...(timeoutTag === null ? {} : { timeout: true as const }),
    })
  }

  private readControlDirective(directive: Directive, lineNumber: number) {
    const text = argumentText(directive)

    switch (directive.name) {
      case 'decision':
      case 'decision multi':
      case 'decision lasting':
      case 'decision multi lasting': {
        const declaration = readDecisionDeclaration(text)
        const { multiple, lasting } = declarationKind(directive.name)!
        if (declaration === null) {
          this.addProblem('error', 'invalidDecision', lineNumber, text)
        } else {
          this.result.decisions.push({ sourceLine: lineNumber, ...declaration, multiple, lasting })
          this.addNode({ type: 'definition', sourceLine: lineNumber, kind: 'decision', name: declaration.name })
        }
        return
      }
      case 'list': {
        // `[list: Board = 16 × none]`, `[list: Hand = cat | dog]`, `[list: Queue]`.
        const assignment = text.includes('=') ? readAssignment(text) : { name: text.trim(), value: '' }
        const items = assignment === null ? null : readListItems(assignment.value)
        if (assignment === null || assignment.name === '' || items === null) {
          this.addProblem('error', 'invalidList', lineNumber, text === '' ? undefined : text)
          return
        }
        this.result.lists = [...this.result.lists ?? [], { sourceLine: lineNumber, name: assignment.name, items }]
        return
      }
      case 'shuffle':
        if (text.trim() === '') {
          this.addProblem('error', 'invalidList', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'shuffle', sourceLine: lineNumber, list: text.trim() })
        return
      case 'take': {
        const take = /^(.+?)\s*=\s*(first|last)\s+of\s+(.+)$/i.exec(directive.written ?? text)
        if (take === null) {
          this.addProblem('error', 'invalidTake', lineNumber, text === '' ? undefined : text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'take', sourceLine: lineNumber, into: take[1]!.trim(), end: take[2]!.toLowerCase() as 'first' | 'last', list: take[3]!.trim() })
        return
      }
      case 'character': {
        // A character showing another's pictures: `[character: card1 = card]`.
        const assignment = readAssignment(text)
        if (assignment === null || normalizeName(assignment.name) === normalizeName(assignment.value)) {
          this.addProblem('error', 'invalidSharedPictures', lineNumber, text === '' ? undefined : text)
          return
        }
        this.result.sharedPictures = [...this.result.sharedPictures ?? [], { sourceLine: lineNumber, name: assignment.name, from: assignment.value }]
        return
      }
      case 'shown':
      case 'shown after an ending': {
        // Names are listed with commas, `[shown: Bag, Trust]`, which no name in a tag holds.
        const names = (directive.written ?? text).split(',').map(name => name.trim().replace(/\s+/g, ' ')).filter(name => name !== '')
        if (names.length > 0) {
          this.result.shown.push({ sourceLine: lineNumber, names, afterAnEnding: directive.name === 'shown after an ending' })
        }
        return
      }
      case 'counter':
      case 'counter lasting': {
        const declaration = readCounterDeclaration(text)
        if (declaration === null) {
          this.addProblem('error', 'invalidCounter', lineNumber, text)
        } else {
          this.result.counters.push({ sourceLine: lineNumber, ...declaration, lasting: declarationKind(directive.name)!.lasting })
          this.addNode({ type: 'definition', sourceLine: lineNumber, kind: 'counter', name: declaration.name })
        }
        return
      }
      case 'add': {
        // `[add: Queue = {Cell}]`: a value at the end of a list.
        const appended = (directive.written ?? text).includes('=') ? readAssignment(directive.written ?? text) : null
        if (appended !== null) {
          this.flushPendingDirectives()
          this.addNode({ type: 'listAdd', sourceLine: lineNumber, list: appended.name, value: appended.value })
          return
        }
        const addition = readAddition(text)
        if (addition === null) {
          this.addProblem('error', 'invalidAdd', lineNumber, text === '' ? undefined : text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'add', sourceLine: lineNumber, counter: addition.name, amount: addition.amount, ...(addition.from === undefined ? {} : { from: addition.from }) })
        return
      }
      case 'choice': {
        if (text === '') {
          this.addProblem('error', 'missingDecisionName', lineNumber)
          return
        }
        // `[choice: Cell grid 4 × 4 from Shown with tile]`: a grid of picture buttons, no options written.
        // `, marking Flag` at the end: a second way to pick a tile, which gives its number to another counter.
        const marking = /(?:,\s*|\s+)marking\s+(\S.*)$/i.exec(text.trim())
        const gridText = marking === null ? text.trim() : text.trim().slice(0, marking.index).trim()
        const grid = /^(.+?)\s+grid\s+(\d{1,2}|\{[^{}]+\})\s*[×x*]\s*(\d{1,2}|\{[^{}]+\})\s+from\s+(.+?)(?:\s+with\s+(.+))?$/i.exec(gridText)
        if (grid !== null || /\sgrid\s/i.test(` ${text} `)) {
          const size = (written: string | undefined, largest: number): number | string | null => written === undefined ? null
            : written.startsWith('{') ? written.slice(1, -1).trim()
              : Number(written) >= 1 && Number(written) <= largest ? Number(written) : null
          const columns = size(grid?.[2], MAXIMUM_GRID.columns)
          const rows = size(grid?.[3], MAXIMUM_GRID.rows)
          if (grid === null || columns === null || rows === null) {
            this.addProblem('error', 'invalidGrid', lineNumber, text)
            return
          }
          this.flushPendingDirectives()
          const gridNode: GridNode = { type: 'grid', sourceLine: lineNumber, counter: grid[1]!.trim(), columns, rows, list: grid[4]!.trim(), character: grid[5]?.trim() ?? null, ...(marking === null ? {} : { marking: marking[1]!.trim() }) }
          this.addNode(gridNode)
          this.gridAwaitingCaption = gridNode
          return
        }
        this.flushPendingDirectives()
        const heading = readChoiceHeading(text, name => this.valuesKnown.has(normalizeName(name)))
        this.openChoice = { type: 'choice', sourceLine: lineNumber, decision: heading.decision, options: [], ...(heading.timeLimitMs === null ? {} : { timeLimitMs: heading.timeLimitMs }), ...(heading.below ? { below: true as const } : {}) }
        return
      }
      case 'ask': {
        const assignment = text.includes('=') ? readAssignment(text) : { name: text, value: '' }
        if (assignment === null || !isAskableName(assignment.name) || [...assignment.value].length > MAXIMUM_ASKED_NAME_LENGTH) {
          this.addProblem('error', 'invalidAsk', lineNumber, text === '' ? undefined : text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'ask', sourceLine: lineNumber, name: assignment.name, defaultName: assignment.value === '' ? null : assignment.value })
        return
      }
      case 'ask number': {
        const asked = readAskNumber(directive.written ?? text)
        if (asked === null) {
          this.addProblem('error', 'invalidAskNumber', lineNumber, text === '' ? undefined : text)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'askNumber', sourceLine: lineNumber, counter: asked.counter, defaultAmount: asked.defaultAmount, decimals: asked.decimals, minimum: asked.minimum, maximum: asked.maximum })
        return
      }
      case 'gauge': {
        const reading = readGauge(directive.written ?? text)
        if ('problem' in reading) {
          this.addProblem('error', reading.problem, lineNumber, reading.subject === '' ? undefined : reading.subject)
          return
        }
        this.flushPendingDirectives()
        this.addNode({ type: 'gauge', sourceLine: lineNumber, ...reading.gauge })
        return
      }
      case 'timeout':
        this.addProblem('error', 'timeoutOutsideOption', lineNumber)
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
      case 'forget':
        if (text === '') {
          this.addProblem('error', directive.name === 'ending' ? 'missingEndingName' : 'missingMemoryName', lineNumber)
          return
        }
        this.flushPendingDirectives()
        this.addNode(directive.name === 'ending' ? endingNode(text, lineNumber)
          : { type: 'remember', sourceLine: lineNumber, name: text, ...(directive.name === 'forget' ? { forget: true as const } : {}) })
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
    const measureText = this.measureText
    const layout = { ...this.options.layout, measureText: scale === 1 ? measureText : (text: string) => measureText(text) * scale }
    const pageRanges = paginate(parsedLine.text, layout, this.locale)
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
    const timeouts = choice.options.filter(option => option.timeout === true)
    if (choice.timeLimitMs !== undefined && timeouts.length === 0) {
      this.addProblem('error', 'timedChoiceWithoutTimeout', choice.sourceLine, choice.decision)
    } else if (choice.timeLimitMs === undefined && timeouts.length > 0) {
      this.addProblem('error', 'timeoutWithoutTime', timeouts[0]!.sourceLine, choice.decision)
    } else if (timeouts.length > 1) {
      this.addProblem('error', 'severalTimeouts', timeouts[1]!.sourceLine, choice.decision)
    }
    // Players read a long list in a list that scrolls: past this many, they are told it is long.
    if (choice.options.length > MANY_OPTIONS) {
      this.addProblem('warning', 'manyOptions', choice.sourceLine, String(choice.options.length))
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

  /** A grid just read, which the line under it, `> …`, may give a caption. */
  private gridAwaitingCaption: GridNode | null = null

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
      // `[import: story fr]`: the kind, then the language the text is written in, if it says.
      const [declaredKind = '', declaredLanguage] = importDirective.arguments.map(argument => argument.toLowerCase())
      if (isImportKind(declaredKind)) {
        this.result.kind = declaredKind
      } else {
        this.addProblem('error', 'unknownImportKind', lineNumber, argumentText(importDirective))
      }
      if (declaredLanguage !== undefined) {
        const language = languageCode(declaredLanguage)
        if (language === null) {
          this.addProblem('error', 'unknownLanguage', lineNumber, declaredLanguage)
        } else {
          this.result.language = language
          this.locale = language
        }
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

/** `[ending: Name]`, or `[ending: Name = what players read]`, the name before `=` the one the story knows it by. */
function endingNode(text: string, lineNumber: number): StoryNode {
  const equals = text.indexOf('=')
  const name = equals === -1 ? text : text.slice(0, equals).trim()
  const shownAs = equals === -1 ? '' : text.slice(equals + 1).trim()
  return { type: 'ending', sourceLine: lineNumber, name, ...(shownAs === '' ? {} : { shownAs }) }
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
