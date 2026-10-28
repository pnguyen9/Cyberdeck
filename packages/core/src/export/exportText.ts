import { effectText } from '../storyboard/describeNodes'
import { flattenStoredNodes } from '../format/storyFormat'
import { isPropertyAlone } from '../format/textStyles'
import type {
  AnimationSpec,
  ChapterDocument,
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
}

/**
 * Writes chapters back in the syntax they are imported from, with what was changed in Cyberdeck:
 * importing the text gives the same story. Each page is its own paragraph, so that the import cuts
 * pages where they were; directives written before a page stand on their own lines, those fired
 * during its text are written where the typewriter reaches them.
 */
export function exportText(project: ProjectDocument, chapters: readonly ChapterDocument[], options: TextExportOptions): string {
  const writer = new TextWriter(project, [...(options.allScenes ?? []), ...(options.scenes ?? [])])
  if (options.declareDecisions) {
    writer.line('[import: story]')
    // Those of no chapter, above the first heading; those of a chapter are written where they are in it.
    for (const line of definitionLinesOfStory(project, [...chapters, ...(options.scenes ?? []), ...(options.allScenes ?? [])])) {
      writer.line(line)
    }
  } else {
    writer.line(chapters.length === 1 ? '[import: chapter]' : '[import: story]')
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

/** The declaration of a decision or a style, as written; null for one the project no longer has. */
export function definitionLine(project: ProjectDocument, kind: 'decision' | 'style', definedId: string): string | null {
  if (kind === 'decision') {
    const decision = project.decisions.find(candidate => candidate.id === definedId)
    return decision === undefined ? null : `[decision${decision.multiple ? ' multi' : ''}: ${decision.name} = ${decision.values.map(value => value.name).join(' | ')}]`
  }
  const style = project.styles.find(candidate => candidate.id === definedId)
  return style === undefined ? null : `[style: ${style.name} = ${style.properties.length === 0 ? 'plain' : style.properties.join(', ')}]`
}

/**
 * The declarations of the project's own definitions: those of no chapter, and not made by use alone
 * (a decision by its choices, a style named after a property).
 */
export function globalDefinitionLines(project: ProjectDocument, documents: readonly ChapterDocument[]): string[] {
  const nodes = documents.flatMap(document => flattenStoredNodes(document.nodes))
  const homed = new Set(nodes.flatMap(node => node.type === 'definition' ? [node.definedId] : []))
  const chosen = new Set(nodes.flatMap(node => node.type === 'choice' ? [node.decisionId] : []))
  return [
    ...project.decisions.filter(decision => !homed.has(decision.id) && !(decision.implicit === true && chosen.has(decision.id))).map(decision => definitionLine(project, 'decision', decision.id)!),
    ...project.styles.filter(style => style.implicit !== true && !homed.has(style.id) && !isPropertyAlone(style)).map(style => definitionLine(project, 'style', style.id)!),
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
export function nodesText(project: ProjectDocument, nodes: readonly StoredNode[], scenes: readonly ChapterDocument[] = []): string {
  const writer = new TextWriter(project, scenes)
  writer.nodes(nodes)
  return writer.text().replace(/\n$/, '')
}

class TextWriter {
  private readonly lines: string[] = []

  constructor(private readonly project: ProjectDocument, private readonly scenes: readonly ChapterDocument[]) {}

  line(text: string) {
    this.lines.push(text)
  }

  text(): string {
    return `${this.lines.join('\n')}\n`
  }

  nodes(nodes: readonly StoredNode[]) {
    for (const node of nodes) {
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
          this.line(`[choice: ${decision?.name ?? '?'}]`)
          for (const option of node.options) {
            const condition = option.condition === null ? '' : ` [if: ${this.condition(option.condition)}]`
            this.line(`> ${option.text} = ${decision?.values.find(value => value.id === option.valueId)?.name ?? '?'}${condition}`)
          }
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
        case 'unset': {
          const decision = this.decision(node.decisionId)
          const value = node.valueId === null ? '' : ` = ${decision?.values.find(value => value.id === node.valueId)?.name ?? '?'}`
          this.line(`[unset: ${decision?.name ?? '?'}${value}]`)
          break
        }
        case 'ending':
          this.line(`[ending: ${this.project.endings.find(ending => ending.id === node.endingId)?.name ?? '?'}]`)
          break
        case 'remember':
          this.line(`[remember: ${this.project.memories.find(memory => memory.id === node.memoryId)?.name ?? '?'}]`)
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

  private directive(command: StageCommand | InlineStageCommand): string {
    switch (command.type) {
      case 'background':
        return `[bg: ${this.project.backgrounds.find(background => background.id === command.backgroundId)?.name ?? '?'}]`
      case 'transition':
      case 'shake':
      case 'flash':
      case 'fade':
      case 'tint':
        return `[${effectText(command)}]`
      case 'textMode':
        return `[text: ${command.mode}]`
      case 'clear':
        return '[clear]'
      case 'illustration':
        return `[illustration: ${command.illustrationId === null ? 'none' : this.project.illustrations.find(illustration => illustration.id === command.illustrationId)?.name ?? '?'}]`
      case 'music':
        return `[music: ${command.musicId === null ? 'stop' : this.project.music.find(track => track.id === command.musicId)?.name ?? '?'}]`
      case 'sound':
        return `[sound: ${this.project.sounds.find(sound => sound.id === command.soundId)?.name ?? '?'}]`
      case 'enter': {
        const expression = this.expressionName(command.characterId, command.expressionId)
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
        return `[${this.characterName(command.characterId)}: ${this.expressionName(command.characterId, command.expressionId)}]`
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
