import { writtenAmount } from '../format/counterNumbers'
import { valueWritten } from '../format/valueTags'
import { listName, listPlaceText, listValueText } from '../format/lists'
import type { AnimationSpec, DefinitionKind, Placement, ProjectDocument, StageCommand, StoredAskBound, StoredAskNumber, StoredCondition, StoredCopy, StoredCount, StoredDraw, StoredGrid, StoredListChange, StoredTake } from '../format/storyFormat'
import { ENGLISH_STORY_WORDS, type StoryWords } from './storyWords'

/** Short descriptions of what nodes do, in the words of the writing syntax, for the storyboard. */

/** A transition or screen effect as written, defaults left out: `shake: strong 0.4s`, `fade out: white`, `tint: none`. */
export function effectText(command: Extract<StageCommand, { type: 'transition' | 'shake' | 'flash' | 'fade' | 'tint' }>): string {
  const seconds = (durationMs: number | null) => durationMs === null ? '' : `${durationMs / 1000}s`
  const written = (name: string, words: string[]) => {
    const argumentText = words.filter(word => word !== '').join(' ')
    return argumentText === '' ? name : `${name}: ${argumentText}`
  }
  switch (command.type) {
    case 'transition':
      return written('transition', [command.name, seconds(command.durationMs)])
    case 'shake':
      return written('shake', [command.strength === 'light' ? '' : command.strength, seconds(command.durationMs)])
    case 'flash':
      return written('flash', [command.color === 'white' ? '' : command.color, seconds(command.durationMs)])
    case 'fade':
      return written(`fade ${command.direction}`, [command.color === 'black' ? '' : command.color, seconds(command.durationMs)])
    case 'tint':
      return written('tint', [command.tint ?? 'none'])
  }
}

export function describeStageCommand(command: StageCommand, project: ProjectDocument): string {
  const characterName = (characterId: string) => project.characters.find(character => character.id === characterId)?.name ?? '?'
  const expressionName = (characterId: string, expressionId: string) =>
    project.characters.find(character => character.id === characterId)?.expressions.find(expression => expression.id === expressionId)?.name ?? '?'
  switch (command.type) {
    case 'background':
      return `bg: ${valueWritten(command, project) ?? project.backgrounds.find(background => background.id === command.backgroundId)?.name ?? '?'}`
    case 'transition':
    case 'shake':
    case 'flash':
    case 'fade':
    case 'tint':
      return effectText(command)
    case 'continued':
      return `to be continued: ${command.text ?? 'none'}`
    case 'textMode':
      return `text: ${command.mode}`
    case 'clear':
      return 'clear'
    case 'illustration':
      return `illustration: ${valueWritten(command, project) ?? (command.illustrationId === null ? 'none' : project.illustrations.find(illustration => illustration.id === command.illustrationId)?.name ?? '?')}`
    case 'music':
      return command.musicId === null ? 'music: stop' : `music: ${project.music.find(track => track.id === command.musicId)?.name ?? '?'}`
    case 'sound':
    case 'voice':
      return `${command.type}: ${project.sounds.find(sound => sound.id === command.soundId)?.name ?? '?'}`
    case 'video':
      return `video: ${project.videos.find(video => video.id === command.videoId)?.name ?? '?'}`
    case 'enter':
      return `enter: ${[characterName(command.characterId), placementWords(command.placement, project), command.facing === null ? '' : `facing-${command.facing}`,
        command.depth ?? '', valueWritten(command, project) ?? expressionName(command.characterId, command.expressionId), animationWords(command.animation)].filter(word => word !== '' && word !== 'normal').join(' ')}`
    case 'exit':
      return `exit: ${[characterName(command.characterId), animationWords(command.animation)].filter(word => word !== '').join(' ')}`
    case 'move':
      return `move: ${[characterName(command.characterId), command.placement === null ? '' : placementWords(command.placement, project), command.depth ?? '', animationWords(command.animation)].filter(word => word !== '').join(' ')}`
    case 'expression':
      return `${characterName(command.characterId)}: ${valueWritten(command, project) ?? expressionName(command.characterId, command.expressionId)}`
    case 'wait':
      return `wait: ${command.seconds}`
  }
}

/** A comparison as a condition reads: `is`, `is not`, or the sign itself. */
function operatorWords(operator: string): string {
  return operator === '=' ? 'is' : operator === '!=' ? 'is not' : operator
}

export function describeCondition(condition: StoredCondition, project: ProjectDocument): string {
  switch (condition.type) {
    case 'listItem':
      return `${listName(condition.listId, project)} ${listPlaceText(condition.place, project)} ${condition.negated ? 'is not' : 'is'} ${listValueText(condition.value, project)}`
    case 'listSize': {
      return `${listName(condition.listId, project)} size ${operatorWords(condition.operator)} ${condition.amount}`
    }
    case 'counter': {
      const counter = project.counters.find(candidate => candidate.id === condition.counterId)
      const operator = operatorWords(condition.operator)
      const other = condition.otherCounterId === undefined ? null : project.counters.find(candidate => candidate.id === condition.otherCounterId)
      return `${counter?.name ?? '?'} ${operator} ${condition.otherCounterId === undefined ? writtenAmount(condition.amount, counter ?? {}) : `{${other?.name ?? '?'}}`}`
    }
    case 'is': {
      const decision = project.decisions.find(candidate => candidate.id === condition.decisionId)
      const value = decision?.values.find(candidate => candidate.id === condition.valueId)
      return `${decision?.name ?? '?'} ${condition.negated ? 'is not' : 'is'} ${value?.name ?? '?'}`
    }
    case 'remembered':
      return `${condition.negated ? 'not ' : ''}remembered ${project.memories.find(memory => memory.id === condition.memoryId)?.name ?? '?'}`
    case 'endingSeen':
      return `${condition.negated ? 'not ' : ''}seen ending ${project.endings.find(ending => ending.id === condition.endingId)?.name ?? '?'}`
    case 'and':
    case 'or':
      return condition.conditions.map(part => part.type !== 'and' && part.type !== 'or' || part.type === condition.type
        ? describeCondition(part, project)
        : `(${describeCondition(part, project)})`).join(` ${condition.type} `)
  }
}

export function describeAssignment(decisionId: string, valueId: string, project: ProjectDocument): string {
  const decision = project.decisions.find(candidate => candidate.id === decisionId)
  return `${decision?.name ?? '?'} = ${decision?.values.find(value => value.id === valueId)?.name ?? '?'}`
}

/** `Trust + 2`, `Trust − 1`, `Trust = 3`, `Weather = random 1–6`. */
export function describeCount(node: StoredCount, project: ProjectDocument): string {
  const counter = project.counters.find(candidate => candidate.id === node.counterId)
  const name = counter?.name ?? '?'
  const amount = (units: number) => writtenAmount(units, counter ?? {})
  if (node.fromItem !== undefined) {
    return `${name} = ${listValueText({ type: 'item', ...node.fromItem }, project)}`
  }
  if (node.from !== undefined) {
    const value = counterValueText(node.from, project)
    return node.operation === 'set' ? `${name} = ${value}` : `${name} + ${value}`
  }
  return node.operation === 'set' ? `${name} = ${amount(node.amount)}`
    : node.operation === 'random' ? `${name} = random ${amount(node.amount)}–${amount(node.maximum ?? node.amount)}`
      : `${name} ${node.amount < 0 ? '−' : '+'} ${amount(Math.abs(node.amount))}`
}

/** Another counter's value as a tag writes it: `{Bet}`, `-{Bet}`, `{Bet} * 2.5`. */
export function counterValueText(from: { counterId: string; factor: number }, project: ProjectDocument): string {
  const name = project.counters.find(counter => counter.id === from.counterId)?.name ?? '?'
  const size = Math.abs(from.factor)
  return `${from.factor < 0 ? '-' : ''}{${name}}${size === 1 ? '' : ` * ${size}`}`
}

/** `choice: Cell grid 4 × 4 from Shown with tile`, as the tag is written. */
export function describeGrid(node: StoredGrid, project: ProjectDocument): string {
  const counter = project.counters.find(candidate => candidate.id === node.counterId)?.name ?? '?'
  const character = node.characterId === null ? null : project.characters.find(candidate => candidate.id === node.characterId)?.name ?? '?'
  const size = (counterId: string | undefined, written: number) => counterId === undefined ? String(written) : `{${project.counters.find(candidate => candidate.id === counterId)?.name ?? '?'}}`
  return `choice: ${counter} grid ${size(node.columnsFrom, node.columns)} × ${size(node.rowsFrom, node.rows)} from ${listName(node.listId, project)}${character === null ? '' : ` with ${character}`}`
}

/** A list's change or a value taken from it, as the tag is written: `set: Board 3 = cat`, `shuffle: Board`. */
export function describeListNode(node: StoredListChange | StoredTake, project: ProjectDocument): string {
  const name = listName(node.listId, project)
  if (node.type === 'take') {
    const target = node.into
    const into = target.type === 'counter' ? project.counters.find(counter => counter.id === target.counterId)?.name
      : project.decisions.find(decision => decision.id === target.decisionId)?.name
    return `take: ${into ?? '?'} = ${node.end} of ${name}`
  }
  switch (node.change.type) {
    case 'set':
      return `set: ${name} ${listPlaceText(node.change.place, project)} = ${listValueText(node.change.value, project)}`
    case 'add':
      return `add: ${name} = ${listValueText(node.change.value, project)}`
    case 'shuffle':
      return `shuffle: ${name}`
    case 'clear':
      return `unset: ${name}`
  }
}

/** `Dealt = {Drawn}`, as the tag is written. */
export function describeCopy(node: StoredCopy, project: ProjectDocument): string {
  const name = (decisionId: string) => project.decisions.find(decision => decision.id === decisionId)?.name ?? '?'
  return `${name(node.decisionId)} = {${name(node.fromDecisionId)}}`
}

/** `Drawn = random`, `Drawn = random not in Dealt`, as the tag is written. */
export function describeDraw(node: StoredDraw, project: ProjectDocument): string {
  const name = (decisionId: string | null) => project.decisions.find(decision => decision.id === decisionId)?.name ?? '?'
  return `${name(node.decisionId)} = random${node.notInDecisionId === null ? '' : ` not in ${name(node.notInDecisionId)}`}`
}

/** `ask number: Bet = 10, from 1 to {Money}`, as the tag is written. */
export function describeAskNumber(node: StoredAskNumber, project: ProjectDocument): string {
  const counter = project.counters.find(candidate => candidate.id === node.counterId)
  const bound = (written: StoredAskBound | null) => written === null ? null
    : written.type === 'amount' ? writtenAmount(written.amount, counter ?? {})
      : `{${project.counters.find(candidate => candidate.id === written.counterId)?.name ?? '?'}}`
  const minimum = bound(node.minimum)
  const maximum = bound(node.maximum)
  const bounds = [...(minimum === null ? [] : [`from ${minimum}`]), ...(maximum === null ? [] : [`to ${maximum}`])].join(' ')
  return `ask number: ${counter?.name ?? '?'} = ${writtenAmount(node.defaultAmount, counter ?? {})}${bounds === '' ? '' : `, ${bounds}`}`
}

/** `Confession: Accept | Refuse`, `Clues (several): Letter | Key`, `Trust: starts at 2`, `Whisper: italic, small`. */
export function describeDefinition(kind: DefinitionKind, definedId: string, project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): string {
  if (kind === 'decision') {
    const decision = project.decisions.find(candidate => candidate.id === definedId)
    return decision === undefined ? '?' : `${decision.name}${decision.multiple ? ` (${words.several})` : ''}${words.colon}${decision.values.map(value => value.name).join(' | ')}`
  }
  if (kind === 'counter') {
    const counter = project.counters.find(candidate => candidate.id === definedId)
    return counter === undefined ? '?' : `${counter.name}${words.colon}${words.startsAt(writtenAmount(counter.initial, counter))}`
  }
  const style = project.styles.find(candidate => candidate.id === definedId)
  return style === undefined ? '?' : `${style.name}${words.colon}${style.properties.join(', ') || words.fromTheCss}`
}

/** `Clues: no more Key`, or `Clues: none` when every value is taken away. */
export function describeUnset(decisionId: string, valueId: string | null, project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): string {
  const decision = project.decisions.find(candidate => candidate.id === decisionId)
  return valueId === null
    ? `${decision?.name ?? '?'}${words.colon}${words.none}`
    : `${decision?.name ?? '?'}${words.colon}${words.noMore(decision?.values.find(value => value.id === valueId)?.name ?? '?')}`
}

function placementWords(placement: Placement, project: ProjectDocument): string {
  switch (placement.type) {
    case 'auto':
      return ''
    case 'preset':
      return project.positions.find(position => position.id === placement.presetId)?.name ?? '?'
    case 'exact':
      return `${placement.x}%`
  }
}

function animationWords(animation: AnimationSpec): string {
  return [animation.kind ?? '', animation.durationMs === null ? '' : `${animation.durationMs / 1000}s`, animation.wait ? 'wait' : '']
    .filter(word => word !== '').join(' ')
}
