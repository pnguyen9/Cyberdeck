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

/** The decision whose value names the picture a command shows; null for a picture named as such. */
export function decisionChoosingPicture(command: StageCommand): string | null {
  return isValueCommand(command) ? command.from : null
}

/** The pictures a command may show: the backgrounds, the illustrations, or its character's expressions. */
function picturesFor(command: ValueCommand, project: ProjectDocument): readonly { id: string; name: string }[] {
  switch (command.type) {
    case 'background':
      return project.backgrounds
    case 'illustration':
      return project.illustrations
    case 'enter':
    case 'expression':
      return project.characters.find(character => character.id === command.characterId)?.expressions ?? []
  }
}

/** The entries such a tag may show, one per value of its decision: what it uses, and what a game must carry. */
export function entriesNamedByValue(command: StageCommand, project: ProjectDocument): string[] {
  if (!isValueCommand(command)) {
    return []
  }
  const names = new Set(project.decisions.find(decision => decision.id === command.from)?.values.map(value => normalizeName(value.name)) ?? [])
  return picturesFor(command, project).filter(entry => names.has(normalizeName(entry.name))).map(entry => entry.id)
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
  const wanted = normalizeName(valueName)
  const pictureId = picturesFor(command, project).find(entry => normalizeName(entry.name) === wanted)?.id
  if (pictureId === undefined) {
    return command
  }
  switch (command.type) {
    case 'background':
      return { ...command, backgroundId: pictureId }
    case 'illustration':
      return { ...command, illustrationId: pictureId }
    case 'enter':
    case 'expression':
      return { ...command, expressionId: pictureId }
  }
}

/** How the tag writes the picture it shows by a value, `{Drawn}`; null for a picture named as such. */
export function valueWritten(command: StageCommand, project: ProjectDocument): string | null {
  if (!isValueCommand(command)) {
    return null
  }
  return `{${project.decisions.find(decision => decision.id === command.from)?.name ?? '?'}}`
}
