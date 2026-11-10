import { writtenAmount } from '../format/counterNumbers'
import { valueWritten } from '../format/valueTags'
import { counterValueText, describeAskNumber, describeCondition, describeCopy, describeDraw, describeGrid, describeListNode } from '../storyboard/describeNodes'
import { listName, listPlaceText, listsOf } from '../format/lists'
import { firstLanguageOf } from '../format/languages'
import { effectText } from '../storyboard/describeNodes'
import { ENDINGS_REACHED, flattenStoredNodes } from '../format/storyFormat'
import { isPropertyAlone } from '../format/textStyles'
import { measuringValues, possibleValues } from '../format/textValues'
import type { PageLayout } from '../pagination/paginate'
import { splitClauses, splitSentences } from '../pagination/splitText'
import { textOfRange, wholeTextRange } from '../pagination/textRange'
import { chunkRanges, isWrittenWithoutSpaces, wrapLines } from '../pagination/wrapLines'
import type {
  AnimationSpec,
  ChapterDocument,
  DefinitionKind,
  InlineStageCommand,
  Placement,
  ProjectDocument,
  StageCommand,
  StoredCondition,
  StoredNode,
  StoredPage,
} from '../format/storyFormat'

export interface TextExportOptions {
  /**
   * Declares every decision with its values first, for a text that becomes a new project. Left out
   * for chapters going back into their project, where the decisions already exist.
   */
  declareDecisions: boolean
  /** Scenes written after the chapters, as `# Scene: Name`; any scene the chapters play is named either way. */
  scenes?: readonly ChapterDocument[]
  /** The project's scenes, to name those the chapters play when they are not written. */
  allScenes?: readonly ChapterDocument[]
  /**
   * The text box the pages were cut for: given, the pages the import cut from one paragraph are
   * joined again, for a text that reads as written (to send to a translator). Without it, each page
   * is its own paragraph, which imports back cut exactly as it is.
   */
  paragraphsAsWrittenFor?: PageLayout
  /** The language the chapters are written in, for the names players read; the story's first by default. */
  language?: string
}

/**
 * Writes chapters back in the syntax they are imported from, with what was changed in Cyberdeck:
 * importing the text gives the same story. Each page is its own paragraph, so that the import cuts
 * pages where they were; directives written before a page stand on their own lines, those fired
 * during its text are written where the typewriter reaches them.
 */
export function exportText(project: ProjectDocument, chapters: readonly ChapterDocument[], options: TextExportOptions): string {
  const language = options.language ?? firstLanguageOf(project)
  const writer = new TextWriter(project, [...(options.allScenes ?? []), ...(options.scenes ?? [])], options.paragraphsAsWrittenFor === undefined ? null : pageJoiner(project, options.paragraphsAsWrittenFor, language), language)
  if (options.declareDecisions) {
    // The language is always written, so that a text sent to a translator comes back as a translation.
    writer.line(`[import: story ${language}]`)
    // Those of no chapter, above the first heading; those of a chapter are written where they are in it.
    for (const line of definitionLinesOfStory(project, [...chapters, ...(options.scenes ?? []), ...(options.allScenes ?? [])])) {
      writer.line(line)
    }
  } else {
    writer.line(`[import: ${chapters.length === 1 ? 'chapter' : 'story'} ${language}]`)
  }
  for (const chapter of chapters) {
    writer.line(chapter.title === null ? '#' : `# ${chapter.title}`)
    if (chapter.condition !== undefined) {
      writer.line(`[only if: ${writer.condition(chapter.condition)}]`)
    }
    writer.nodes(chapter.nodes)
  }
  for (const scene of options.scenes ?? []) {
    writer.line(`# Scene: ${scene.title ?? ''}`)
    writer.nodes(scene.nodes)
  }
  return writer.text()
}

/** The declaration of a decision, a counter or a style, as written; null for one the project no longer has. */
export function definitionLine(project: ProjectDocument, kind: DefinitionKind, definedId: string): string | null {
  if (kind === 'decision') {
    const decision = project.decisions.find(candidate => candidate.id === definedId)
    return decision === undefined ? null : `[decision${decision.multiple ? ' multi' : ''}${decision.lasting === true ? ' lasting' : ''}: ${decision.name} = ${decision.values.map(value => value.name).join(' | ')}]`
  }
  if (kind === 'counter') {
    const counter = project.counters.find(candidate => candidate.id === definedId)
    return counter === undefined ? null : `[counter${counter.lasting === true ? ' lasting' : ''}: ${counter.name} = ${writtenAmount(counter.initial, counter)}]`
  }
  const style = project.styles.find(candidate => candidate.id === definedId)
  return style === undefined ? null : `[style: ${style.name} = ${style.properties.length === 0 ? 'plain' : style.properties.join(', ')}]`
}

/**
 * The declarations of the project's own definitions: those of no chapter, and not made by use alone
 * (a decision by its choices, a counter by its `[add]`, a style named after a property).
 */
export function globalDefinitionLines(project: ProjectDocument, documents: readonly ChapterDocument[]): string[] {
  const nodes = documents.flatMap(document => flattenStoredNodes(document.nodes))
  const homed = new Set(nodes.flatMap(node => node.type === 'definition' ? [node.definedId] : []))
  const chosen = new Set(nodes.flatMap(node => node.type === 'choice' ? [node.decisionId] : []))
  // Counters an `[add]` or an `[ask number]` makes come back with it, needing no declaration.
  const added = new Set(nodes.flatMap(node => (node.type === 'count' && node.operation === 'add') || node.type === 'askNumber' ? [node.counterId] : []))
  return [
    ...project.decisions.filter(decision => !homed.has(decision.id) && !(decision.implicit === true && chosen.has(decision.id))).map(decision => definitionLine(project, 'decision', decision.id)!),
    // The clock's counters are every story's: never declared.
    ...project.counters.filter(counter => counter.clock === undefined && !homed.has(counter.id) && !(counter.implicit === true && added.has(counter.id))).map(counter => definitionLine(project, 'counter', counter.id)!),
    ...project.styles.filter(style => style.implicit !== true && !homed.has(style.id) && !isPropertyAlone(style)).map(style => definitionLine(project, 'style', style.id)!),
    // Lists are every chapter's: declared with the definitions.
    ...listsOf(project).map(list => `[list: ${list.name}${listItemsText(list.initial)}]`),
    ...project.characters.flatMap(character => {
      const lender = project.characters.find(candidate => candidate.id === character.picturesFrom)
      return lender === undefined ? [] : [`[character: ${character.name} = ${lender.name}]`]
    }),
    ...shownLines(project),
  ]
}

/** `[shown: …]` and `[shown after an ending: …]`, as the definitions write what players may see. */
function shownLines(project: ProjectDocument): string[] {
  const nameOf = new Map([...project.decisions, ...project.counters].map(entry => [entry.id, entry.name]))
  const names = (ids: readonly string[], endings: boolean) => [...ids.flatMap(id => nameOf.get(id) ?? []), ...(endings ? [ENDINGS_REACHED] : [])]
  const always = names(project.shown.always, project.shown.endings === 'always')
  const afterAnEnding = names(project.shown.afterAnEnding, project.shown.endings === 'afterAnEnding')
  return [
    ...(always.length === 0 ? [] : [`[shown: ${always.join(', ')}]`]),
    ...(afterAnEnding.length === 0 ? [] : [`[shown after an ending: ${afterAnEnding.join(', ')}]`]),
  ]
}

/**
 * The declarations a text needs to become a project again: the project's own, those decisions made by
 * choices no longer there, and the styles drawn by the CSS alone, as `plain` (the CSS stays in the project).
 */
function definitionLinesOfStory(project: ProjectDocument, documents: readonly ChapterDocument[]): string[] {
  const drawnByCss = project.styles.filter(style => style.implicit === true && style.properties.length === 0)
  return [...globalDefinitionLines(project, documents), ...drawnByCss.map(style => `[style: ${style.name} = plain]`)]
}

/** Nodes as the lines that import back into them: what the storyboard shows for editing a page or a marker. */
export function nodesText(project: ProjectDocument, nodes: readonly StoredNode[], scenes: readonly ChapterDocument[] = [], language: string = firstLanguageOf(project)): string {
  const writer = new TextWriter(project, scenes, null, language)
  writer.nodes(nodes)
  return writer.text().replace(/\n$/, '')
}

/**
 * Whether a page continues the paragraph of the one before it, by the import's own rules in reverse:
 * the import fills a page sentence after sentence and starts the next only when the next sentence
 * does not fit. So two pages of the same voice, the second with no note alone on a line before it,
 * were one paragraph when the second's first sentence would not have fitted on the first; had it
 * fitted, the import would have put it there, and they were two paragraphs.
 */
type PageJoiner = (previous: StoredPage, next: StoredPage) => boolean

/** The end of a sentence: its mark, then any closing quote or bracket. */
const SENTENCE_END = /[.!?…。！？][)"'»”’」』]*\s*$/u

function pageJoiner(project: ProjectDocument, layout: PageLayout, language: string): PageJoiner {
  const measureText = measuringValues(layout.measureText, possibleValues(project))
  return (previous, next) => {
    if (next.commandsBefore.length > 0 || previous.kind !== next.kind || previous.speakerId !== next.speakerId) {
      return false
    }
    const separator = isWrittenWithoutSpaces(language) ? '' : ' '
    const fits = (text: string) => wrapLines(text.trim(), layout.lineWidth, measureText, language).length <= layout.maxLines
    // The piece the import would have tried to add: the first sentence, or when it is longer than a
    // page, its first clause, or when that is too, its first word.
    const firstSentence = splitSentences(next.text, language)[0] ?? wholeTextRange(next.text)
    const firstClause = splitClauses(next.text, firstSentence)[0] ?? firstSentence
    // A first sentence running to the end of the page without ending was longer than a page: the
    // import cut it, and tried its first clause on the page before.
    const isCutSentence = firstSentence.end >= next.text.trimEnd().length && !SENTENCE_END.test(next.text)
    const piece = [...(isCutSentence ? [] : [firstSentence]), firstClause, chunkRanges(next.text, firstClause, language)[0] ?? firstClause]
      .map(range => textOfRange(next.text, range))
      .find(fits) ?? next.text
    return !fits(`${previous.text}${separator}${piece.trim()}`)
  }
}

/** Two pages as the paragraph they were cut from: the text joined as the language writes it, styles and notes moved along with it. */
function joinedPages(first: StoredPage, second: StoredPage, separator: string): StoredPage {
  const offset = first.text.length + separator.length
  const shifted = (second.styles ?? []).map(span => ({ ...span, start: span.start + offset, end: span.end + offset }))
  // A style running to the end of the first page and from the start of the second is one span.
  const styles = [...(first.styles ?? [])]
  for (const span of shifted) {
    const last = styles.at(-1)
    if (last !== undefined && last.styleId === span.styleId && last.end === first.text.length && span.start === offset) {
      styles[styles.length - 1] = { ...last, end: span.end }
    } else {
      styles.push(span)
    }
  }
  return {
    ...first,
    text: `${first.text}${separator}${second.text}`,
    inlineCommands: [...first.inlineCommands, ...second.inlineCommands.map(command => ({ ...command, offset: command.offset + offset }))],
    ...(styles.length === 0 ? {} : { styles }),
  }
}

class TextWriter {
  private readonly lines: string[] = []

  constructor(
    private readonly project: ProjectDocument,
    private readonly scenes: readonly ChapterDocument[],
    private readonly joins: PageJoiner | null = null,
    private readonly language: string = firstLanguageOf(project),
  ) {}

  /** The nodes with the pages of one paragraph joined, when the text is written as it was. */
  private paragraphs(nodes: readonly StoredNode[]): readonly StoredNode[] {
    const joins = this.joins
    if (joins === null) {
      return nodes
    }
    const result: StoredNode[] = []
    // The last page as stored, which the next is measured against; the one written may already be joined.
    let lastPage: StoredPage | null = null
    for (const node of nodes) {
      const written = result.at(-1)
      if (node.type === 'page' && written?.type === 'page' && lastPage !== null && joins(lastPage, node)) {
        result[result.length - 1] = joinedPages(written, node, isWrittenWithoutSpaces(this.language) ? '' : ' ')
      } else {
        result.push(node)
      }
      lastPage = node.type === 'page' ? node : null
    }
    return result
  }

  line(text: string) {
    this.lines.push(text)
  }

  text(): string {
    return `${this.lines.join('\n')}\n`
  }

  nodes(nodes: readonly StoredNode[]) {
    for (const node of this.paragraphs(nodes)) {
      switch (node.type) {
        case 'page': {
          const text = this.page(node)
          if (node.kind === 'narration' && /^[#>]/.test(text)) {
            // Alone on its line, this text would read as a heading or an option: what comes before the page opens the line instead.
            const opening = node.commandsBefore.length === 0 ? '[wait: 0]' : node.commandsBefore.map(command => this.directive(command)).join(' ')
            this.line(`${opening}${text}`)
          } else {
            node.commandsBefore.forEach(command => this.line(this.directive(command)))
            this.line(text)
          }
          break
        }
        case 'stage':
          node.commands.forEach(command => this.line(this.directive(command)))
          break
        case 'choice': {
          const decision = this.decision(node.decisionId)
          this.line(`[choice: ${decision?.name ?? '?'}${node.timeLimitMs === undefined ? '' : ` ${node.timeLimitMs / 1000}s`}]`)
          for (const option of node.options) {
            const condition = option.condition === null ? '' : ` [if: ${this.condition(option.condition)}]`
            const timeout = option.timeout === true ? ' [timeout]' : ''
            this.line(`> ${option.text} = ${decision?.values.find(value => value.id === option.valueId)?.name ?? '?'}${condition}${timeout}`)
          }
          break
        }
        case 'askNumber':
          this.line(`[${describeAskNumber(node, this.project)}]`)
          break
        case 'draw':
          this.line(`[set: ${describeDraw(node, this.project)}]`)
          break
        case 'copy':
          this.line(`[set: ${describeCopy(node, this.project)}]`)
          break
        case 'list':
        case 'take':
          this.line(`[${describeListNode(node, this.project)}]`)
          break
        case 'grid':
          this.line(`[${describeGrid(node, this.project)}]`)
          break
        case 'ask': {
          const asked = this.project.askedNames.find(candidate => candidate.id === node.askedNameId)
          this.line(`[ask: ${asked?.name ?? '?'}${asked === undefined || asked.defaultName === '' ? '' : ` = ${asked.defaultName}`}]`)
          break
        }
        case 'condition': {
          const first = node.branches[0]
          if (first?.condition === null) {
            // A first branch without a test is always played: its nodes are all there is to write.
            this.nodes(first.nodes)
            break
          }
          for (const [index, branch] of node.branches.entries()) {
            this.line(branch.condition === null ? '[else]' : `[${index === 0 ? 'if' : 'else if'}: ${this.condition(branch.condition)}]`)
            this.nodes(branch.nodes)
          }
          this.line('[end]')
          break
        }
        case 'loop':
          this.line('[loop]')
          this.nodes(node.nodes)
          this.line('[end]')
          break
        case 'break':
          this.line('[break]')
          break
        case 'play':
          this.line(`[play: ${this.scenes.find(scene => scene.id === node.sceneId)?.title ?? '?'}]`)
          break
        case 'set': {
          const decision = this.decision(node.decisionId)
          this.line(`[set: ${decision?.name ?? '?'} = ${decision?.values.find(value => value.id === node.valueId)?.name ?? '?'}]`)
          break
        }
        case 'count': {
          const name = this.counterName(node.counterId)
          const amount = (units: number) => this.amount(units, node.counterId)
          const from = node.fromItem !== undefined ? `{${listName(node.fromItem.listId, this.project)} ${listPlaceText(node.fromItem.place, this.project)}}`
            : node.from === undefined ? null : counterValueText(node.from, this.project)
          this.line(node.operation === 'add' ? `[add: ${name} ${from ?? amount(node.amount)}]`
            : node.operation === 'random' ? `[set: ${name} = random ${amount(node.amount)} ${amount(node.maximum ?? node.amount)}]`
              : `[set: ${name} = ${from ?? amount(node.amount)}]`)
          break
        }
        case 'unset': {
          const decision = this.decision(node.decisionId)
          const value = node.valueId === null ? '' : ` = ${decision?.values.find(value => value.id === node.valueId)?.name ?? '?'}`
          this.line(`[unset: ${decision?.name ?? '?'}${value}]`)
          break
        }
        case 'ending':
          this.line(this.endingLine(node.endingId))
          break
        case 'remember':
          this.line(`[${node.forget === true ? 'forget' : 'remember'}: ${this.project.memories.find(memory => memory.id === node.memoryId)?.name ?? '?'}]`)
          break
        case 'definition': {
          const line = definitionLine(this.project, node.kind, node.definedId)
          if (line !== null) {
            this.line(line)
          }
          break
        }
      }
    }
  }

  /**
   * The text with its inline directives put back where the typewriter reaches them, after who
   * speaks, and its styled parts between `[style: …]` and `[style: none]`, which the end of the
   * paragraph makes needless.
   */
  private page(page: StoredPage): string {
    // Dialogue is always a dash and a name when imported; pages without a speaker, from older projects, come back as an unknown voice.
    const opening = page.kind === 'narration'
      ? ''
      : `— ${page.speakerId === null ? '???' : this.characterName(page.speakerId)}: `
    // At one offset, a style ends before the next begins, and both come before the commands there.
    const insertions = [
      ...(page.styles ?? []).flatMap(span => [
        ...(span.end < page.text.length ? [{ offset: span.end, order: 0, text: '[style: none]' }] : []),
        { offset: span.start, order: 1, text: `[style: ${this.project.styles.find(style => style.id === span.styleId)?.name ?? '?'}]` },
      ]),
      ...page.inlineCommands.map(command => ({ offset: command.offset, order: 2, text: this.directive(command) })),
    ].sort((first, second) => first.offset - second.offset || first.order - second.order)
    let text = ''
    let position = 0
    for (const insertion of insertions) {
      text += page.text.slice(position, insertion.offset) + insertion.text
      position = insertion.offset
    }
    return opening + text + page.text.slice(position)
  }

  /** `[ending: Name]`, with what players read of it in the language written, when it has its own. */
  private endingLine(endingId: string): string {
    const ending = this.project.endings.find(candidate => candidate.id === endingId)
    const shownAs = ending?.translations?.[this.language]
    return `[ending: ${ending?.name ?? '?'}${shownAs === undefined ? '' : ` = ${shownAs}`}]`
  }

  private directive(command: StageCommand | InlineStageCommand): string {
    switch (command.type) {
      case 'background':
        return `[bg: ${valueWritten(command, this.project) ?? this.project.backgrounds.find(background => background.id === command.backgroundId)?.name ?? '?'}]`
      case 'transition':
      case 'shake':
      case 'flash':
      case 'fade':
      case 'tint':
        return `[${effectText(command)}]`
      case 'continued':
        return `[to be continued: ${command.text ?? 'none'}]`
      case 'textMode':
        return `[text: ${command.mode}]`
      case 'clear':
        return '[clear]'
      case 'illustration':
        return `[illustration: ${valueWritten(command, this.project) ?? (command.illustrationId === null ? 'none' : this.project.illustrations.find(illustration => illustration.id === command.illustrationId)?.name ?? '?')}]`
      case 'music':
        return `[music: ${command.musicId === null ? 'stop' : this.project.music.find(track => track.id === command.musicId)?.name ?? '?'}]`
      case 'sound':
      case 'voice':
        return `[${command.type}: ${this.project.sounds.find(sound => sound.id === command.soundId)?.name ?? '?'}]`
      case 'video':
        return `[video: ${this.project.videos.find(video => video.id === command.videoId)?.name ?? '?'}]`
      case 'enter': {
        const expression = valueWritten(command, this.project) ?? this.expressionName(command.characterId, command.expressionId)
        return `[enter: ${words(
          this.characterName(command.characterId),
          this.placement(command.placement),
          command.facing === null ? '' : `facing-${command.facing}`,
          command.depth ?? '',
          expression === 'normal' ? '' : expression,
          animationWords(command.animation),
        )}]`
      }
      case 'exit':
        return `[exit: ${words(this.characterName(command.characterId), animationWords(command.animation))}]`
      case 'move':
        return `[move: ${words(this.characterName(command.characterId), command.placement === null ? '' : this.placement(command.placement), command.depth ?? '', animationWords(command.animation))}]`
      case 'expression':
        return `[${this.characterName(command.characterId)}: ${valueWritten(command, this.project) ?? this.expressionName(command.characterId, command.expressionId)}]`
      case 'wait':
        return `[wait: ${command.seconds}]`
    }
  }

  /** Conditions are written as alternatives of requirements, `and` binding tighter than `or`, since the syntax has no parentheses. */
  condition(condition: StoredCondition): string {
    return alternativesOf(condition)
      .map(requirements => requirements.map(requirement => this.requirement(requirement)).join(' and '))
      .join(' or ')
  }

  private requirement(requirement: Exclude<StoredCondition, { type: 'and' | 'or' }>): string {
    if (requirement.type === 'counter') {
      const name = this.counterName(requirement.counterId)
      const amount = requirement.otherCounterId === undefined ? this.amount(requirement.amount, requirement.counterId) : `{${this.counterName(requirement.otherCounterId)}}`
      return requirement.operator === '=' ? `${name} is ${amount}`
        : requirement.operator === '!=' ? `${name} is not ${amount}`
          : `${name} ${requirement.operator} ${amount}`
    }
    if (requirement.type === 'listItem' || requirement.type === 'listSize') {
      return describeCondition(requirement, this.project)
    }
    const not = requirement.negated ? 'not ' : ''
    switch (requirement.type) {
      case 'is': {
        const decision = this.decision(requirement.decisionId)
        return `${decision?.name ?? '?'} is ${not}${decision?.values.find(value => value.id === requirement.valueId)?.name ?? '?'}`
      }
      case 'remembered':
        return `${not}remembered ${this.project.memories.find(memory => memory.id === requirement.memoryId)?.name ?? '?'}`
      case 'endingSeen':
        return `${not}seen ending ${this.project.endings.find(ending => ending.id === requirement.endingId)?.name ?? '?'}`
    }
  }

  private placement(placement: Placement): string {
    switch (placement.type) {
      case 'auto':
        return ''
      case 'preset':
        return this.project.positions.find(position => position.id === placement.presetId)?.name ?? '?'
      case 'exact':
        return `${placement.x}%`
    }
  }

  private decision(decisionId: string) {
    return this.project.decisions.find(decision => decision.id === decisionId)
  }

  /** A number in a counter's units, as a tag writes it: with the decimals the counter keeps. */
  private amount(units: number, counterId: string): string {
    return writtenAmount(units, this.project.counters.find(counter => counter.id === counterId) ?? {})
  }

  private counterName(counterId: string): string {
    return this.project.counters.find(counter => counter.id === counterId)?.name ?? '?'
  }

  private characterName(characterId: string): string {
    return this.project.characters.find(character => character.id === characterId)?.name ?? '?'
  }

  private expressionName(characterId: string, expressionId: string): string {
    return this.project.characters.find(character => character.id === characterId)?.expressions.find(expression => expression.id === expressionId)?.name ?? '?'
  }

}

/** The condition as alternatives (`or`) of requirements (`and`), distributing `and` over `or` where needed. */
function alternativesOf(condition: StoredCondition): Exclude<StoredCondition, { type: 'and' | 'or' }>[][] {
  switch (condition.type) {
    case 'or':
      return condition.conditions.flatMap(alternativesOf)
    case 'and':
      return condition.conditions.map(alternativesOf).reduce(
        (combined, part) => combined.flatMap(left => part.map(right => [...left, ...right])),
        [[]] as Exclude<StoredCondition, { type: 'and' | 'or' }>[][],
      )
    default:
      return [[condition]]
  }
}

function animationWords(animation: AnimationSpec): string {
  return words(animation.kind ?? '', animation.durationMs === null ? '' : `${animation.durationMs / 1000}s`, animation.wait ? 'wait' : '')
}

function words(...parts: string[]): string {
  return parts.filter(part => part !== '').join(' ')
}

/** What a list holds at first, as its declaration writes it: ` = 16 × none`, ` = cat | dog`, or nothing. */
function listItemsText(items: readonly string[]): string {
  if (items.length === 0) {
    return ''
  }
  return items.length > 1 && items.every(item => item === items[0]) ? ` = ${items.length} × ${items[0]}` : ` = ${items.join(' | ')}`
}
