import { normalizeName } from '../importer/storyNodes'
import type { ProjectDocument, StageCommand } from './storyFormat'

/**
 * Tags whose picture a decision names, `[card1: {Drawn}]`, `[bg: {Place}]`: the expression,
 * background or illustration shown is the one named like the value the decision holds when the tag
 * plays. The entries for every value are made with the tag, so that each waits for its file.
 */

/** A name in braces, as a tag writes a value: `{Drawn}` → `Drawn`; null for an ordinary name. */
export function valueNamedIn(word: string): string | null {
  const braced = /^\{([^{}]+)\}$/.exec(word.trim())
  return braced === null ? null : braced[1]!.trim()
}

/** The commands a decision's value may choose a picture for. */
type ValueCommand = Extract<StageCommand, { type: 'enter' | 'expression' | 'background' | 'illustration' }>

function isValueCommand(command: StageCommand): command is ValueCommand & { from: string } {
  return (command.type === 'enter' || command.type === 'expression' || command.type === 'background' || command.type === 'illustration')
    && command.from !== undefined
}

/** The entries such a tag may show, one per value of its decision: what it uses, and what a game must carry. */
export function entriesNamedByValue(command: StageCommand, project: ProjectDocument): string[] {
  if (!isValueCommand(command)) {
    return []
  }
  const names = new Set(project.decisions.find(decision => decision.id === command.from)?.values.map(value => normalizeName(value.name)) ?? [])
  const named = (entries: readonly { id: string; name: string }[]) => entries.filter(entry => names.has(normalizeName(entry.name))).map(entry => entry.id)
  switch (command.type) {
    case 'background':
      return named(project.backgrounds)
    case 'illustration':
      return named(project.illustrations)
    case 'enter':
    case 'expression':
      return named(project.characters.find(character => character.id === command.characterId)?.expressions ?? [])
  }
}

/**
 * The command as it plays, its picture the one named like the value the decision holds; while the
 * decision holds none, or one naming no picture, the first value's.
 */
export function withValueChosen(command: StageCommand, project: ProjectDocument, decisions: Readonly<Record<string, readonly string[]>>): StageCommand {
  if (!isValueCommand(command)) {
    return command
  }
  const decision = project.decisions.find(candidate => candidate.id === command.from)
  const valueId = Object.hasOwn(decisions, command.from) ? decisions[command.from]?.[0] : undefined
  const valueName = decision?.values.find(value => value.id === valueId)?.name
  if (valueName === undefined) {
    return command
  }
  const find = (entries: readonly { id: string; name: string }[]) => entries.find(entry => normalizeName(entry.name) === normalizeName(valueName))?.id
  switch (command.type) {
    case 'background': {
      const backgroundId = find(project.backgrounds)
      return backgroundId === undefined ? command : { ...command, backgroundId }
    }
    case 'illustration': {
      const illustrationId = find(project.illustrations)
      return illustrationId === undefined ? command : { ...command, illustrationId }
    }
    case 'enter':
    case 'expression': {
      const expressionId = find(project.characters.find(character => character.id === command.characterId)?.expressions ?? [])
      return expressionId === undefined ? command : { ...command, expressionId }
    }
  }
}

/** How the tag writes the picture it shows by a value, `{Drawn}`; null for a picture named as such. */
export function valueWritten(command: StageCommand, project: ProjectDocument): string | null {
  if (!isValueCommand(command)) {
    return null
  }
  return `{${project.decisions.find(decision => decision.id === command.from)?.name ?? '?'}}`
}
