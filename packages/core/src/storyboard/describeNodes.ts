import type { AnimationSpec, Placement, ProjectDocument, StageCommand, StoredCondition } from '../format/storyFormat'
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
      return `bg: ${project.backgrounds.find(background => background.id === command.backgroundId)?.name ?? '?'}`
    case 'transition':
    case 'shake':
    case 'flash':
    case 'fade':
    case 'tint':
      return effectText(command)
    case 'textMode':
      return `text: ${command.mode}`
    case 'clear':
      return 'clear'
    case 'illustration':
      return `illustration: ${command.illustrationId === null ? 'none' : project.illustrations.find(illustration => illustration.id === command.illustrationId)?.name ?? '?'}`
    case 'music':
      return command.musicId === null ? 'music: stop' : `music: ${project.music.find(track => track.id === command.musicId)?.name ?? '?'}`
    case 'sound':
      return `sound: ${project.sounds.find(sound => sound.id === command.soundId)?.name ?? '?'}`
    case 'enter':
      return `enter: ${[characterName(command.characterId), placementWords(command.placement, project), command.facing === null ? '' : `facing-${command.facing}`,
        command.depth ?? '', expressionName(command.characterId, command.expressionId), animationWords(command.animation)].filter(word => word !== '' && word !== 'normal').join(' ')}`
    case 'exit':
      return `exit: ${[characterName(command.characterId), animationWords(command.animation)].filter(word => word !== '').join(' ')}`
    case 'move':
      return `move: ${[characterName(command.characterId), command.placement === null ? '' : placementWords(command.placement, project), command.depth ?? '', animationWords(command.animation)].filter(word => word !== '').join(' ')}`
    case 'expression':
      return `${characterName(command.characterId)}: ${expressionName(command.characterId, command.expressionId)}`
    case 'wait':
      return `wait: ${command.seconds}`
  }
}

export function describeCondition(condition: StoredCondition, project: ProjectDocument): string {
  switch (condition.type) {
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

/** `Confession: Accept | Refuse`, `Clues (several): Letter | Key`, `Whisper: italic, small`. */
export function describeDefinition(kind: 'decision' | 'style', definedId: string, project: ProjectDocument, words: StoryWords = ENGLISH_STORY_WORDS): string {
  if (kind === 'decision') {
    const decision = project.decisions.find(candidate => candidate.id === definedId)
    return decision === undefined ? '?' : `${decision.name}${decision.multiple ? ` (${words.several})` : ''}${words.colon}${decision.values.map(value => value.name).join(' | ')}`
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
