import { entriesNamedByValue } from '../format/valueTags'
import { placeholdersIn } from '../format/textValues'
import { normalizeName } from '../importer/storyNodes'
import { flattenStoredNodes, type ChapterDocument, type ProjectDocument, type StageCommand, type StoredCondition, type StoredNode } from '../format/storyFormat'

/**
 * Names the text made by naming them, which it names no longer: a track replaced by another, a
 * background renamed, the values of options renamed since. They are left out of the project, unless
 * they hold something the author gave them (a file, the way a character was drawn looking), which
 * only the author may throw away.
 */
export type UnusedName =
  | { kind: 'character' | 'background' | 'music' | 'sound' | 'illustration' | 'video' | 'counter' | 'decision'; id: string; name: string; isKept: boolean }
  | { kind: 'expression'; id: string; characterId: string; name: string; isKept: boolean }
  | { kind: 'decisionValue'; id: string; decisionId: string; name: string; isKept: false }

/**
 * Every name of the project that `documents` no longer use: those made by use alone (decisions and
 * counters nobody declared, and their values) and every entry of the stage. `isKept` marks those
 * holding a file or a setting of the author's.
 */
export function unusedNames(project: ProjectDocument, documents: readonly ChapterDocument[]): UnusedName[] {
  const used = new Set<string>()
  const useCommand = (command: StageCommand) => {
    // A picture chosen by a decision's value uses the pictures of all its values.
    entriesNamedByValue(command, project).forEach(id => used.add(id))
    if ((command.type === 'enter' || command.type === 'expression' || command.type === 'background' || command.type === 'illustration') && command.from !== undefined) {
      used.add(command.from)
    }
    switch (command.type) {
      case 'background':
        used.add(command.backgroundId)
        break
      case 'music':
        if (command.musicId !== null) {
          used.add(command.musicId)
        }
        break
      case 'sound':
      case 'voice':
        used.add(command.soundId)
        break
      case 'illustration':
        if (command.illustrationId !== null) {
          used.add(command.illustrationId)
        }
        break
      case 'video':
        used.add(command.videoId)
        break
      case 'enter':
      case 'expression':
        used.add(command.characterId)
        used.add(command.expressionId)
        break
      case 'exit':
      case 'move':
        used.add(command.characterId)
        break
    }
  }
  const useCondition = (condition: StoredCondition | null | undefined): void => {
    if (condition == null) {
      return
    }
    switch (condition.type) {
      case 'is':
        used.add(condition.decisionId)
        used.add(condition.valueId)
        break
      case 'counter':
        used.add(condition.counterId)
        if (condition.otherCounterId !== undefined) {
          used.add(condition.otherCounterId)
        }
        break
      case 'and':
      case 'or':
        condition.conditions.forEach(useCondition)
        break
    }
  }
  const useNode = (node: StoredNode) => {
    switch (node.type) {
      case 'page':
        if (node.speakerId !== null) {
          used.add(node.speakerId)
        }
        node.commandsBefore.forEach(useCommand)
        node.inlineCommands.forEach(useCommand)
        break
      case 'stage':
        node.commands.forEach(useCommand)
        break
      case 'choice':
        used.add(node.decisionId)
        node.options.forEach(option => {
          used.add(option.valueId)
          useCondition(option.condition)
        })
        break
      case 'condition':
        node.branches.forEach(branch => useCondition(branch.condition))
        break
      case 'set':
        used.add(node.decisionId)
        used.add(node.valueId)
        break
      case 'unset':
        used.add(node.decisionId)
        if (node.valueId !== null) {
          used.add(node.valueId)
        }
        break
      case 'count':
        used.add(node.counterId)
        if (node.from !== undefined) {
          used.add(node.from.counterId)
        }
        break
      case 'grid':
        // A grid's tiles may show any of its character's pictures.
        used.add(node.counterId)
        if (node.characterId !== null) {
          used.add(node.characterId)
          project.characters.find(character => character.id === node.characterId)?.expressions.forEach(expression => used.add(expression.id))
        }
        break
      case 'copy':
        used.add(node.decisionId)
        used.add(node.fromDecisionId)
        break
      case 'draw':
        used.add(node.decisionId)
        if (node.notInDecisionId !== null) {
          used.add(node.notInDecisionId)
        }
        break
      case 'askNumber':
        used.add(node.counterId)
        for (const bound of [node.minimum, node.maximum]) {
          if (bound?.type === 'counter') {
            used.add(bound.counterId)
          }
        }
        break
      case 'definition':
        used.add(node.definedId)
        break
    }
  }
  for (const document of documents) {
    useCondition(document.condition)
    flattenStoredNodes(document.nodes).forEach(useNode)
  }

  const unused: UnusedName[] = []
  const entries = (kind: 'background' | 'music' | 'sound' | 'illustration' | 'video', list: readonly { id: string; name: string; assetId: string | null; captionsAssetId?: string }[]) => {
    for (const entry of list.filter(candidate => !used.has(candidate.id))) {
      unused.push({ kind, id: entry.id, name: entry.name, isKept: entry.assetId !== null || entry.captionsAssetId !== undefined })
    }
  }
  entries('background', project.backgrounds)
  entries('music', project.music)
  entries('sound', project.sounds)
  entries('illustration', project.illustrations)
  entries('video', project.videos)
  // A character whose pictures another shows is used, with all its pictures.
  for (const borrower of project.characters.filter(character => used.has(character.id) && character.picturesFrom !== undefined)) {
    used.add(borrower.picturesFrom!)
    project.characters.find(character => character.id === borrower.picturesFrom)?.expressions.forEach(expression => used.add(expression.id))
  }
  for (const character of project.characters) {
    const hasFile = character.expressions.some(expression => expression.assetId !== null)
    if (!used.has(character.id)) {
      unused.push({ kind: 'character', id: character.id, name: character.name, isKept: hasFile || character.drawnFacing !== null || character.nameColor !== undefined })
      continue
    }
    for (const expression of character.expressions.filter(candidate => !used.has(candidate.id))) {
      unused.push({ kind: 'expression', id: expression.id, characterId: character.id, name: expression.name, isKept: expression.assetId !== null })
    }
  }
  // Declared decisions and counters keep their values: the author wrote them down.
  for (const decision of project.decisions.filter(candidate => candidate.implicit === true)) {
    if (!used.has(decision.id)) {
      unused.push({ kind: 'decision', id: decision.id, name: decision.name, isKept: false })
      continue
    }
    for (const value of decision.values.filter(candidate => !used.has(candidate.id))) {
      unused.push({ kind: 'decisionValue', id: value.id, decisionId: decision.id, name: value.name, isKept: false })
    }
  }
  // A clock's counter is used where the text shows it, `{hour}`, as well as where a condition tests it.
  const shownNames = new Set(documents.flatMap(document => flattenStoredNodes(document.nodes)).flatMap(node =>
    node.type === 'page' ? placeholdersIn(node.text) : node.type === 'choice' ? node.options.flatMap(option => placeholdersIn(option.text)) : []).map(normalizeName))
  for (const counter of project.counters.filter(candidate => candidate.clock !== undefined && shownNames.has(normalizeName(candidate.name)))) {
    used.add(counter.id)
  }
  for (const counter of project.counters.filter(candidate => candidate.implicit === true && !used.has(candidate.id))) {
    unused.push({ kind: 'counter', id: counter.id, name: counter.name, isKept: false })
  }
  return unused
}

/** The project without these names; their files stay listed until `unusedAssetIds` lets them go. */
export function withoutNames(project: ProjectDocument, names: readonly UnusedName[]): ProjectDocument {
  if (names.length === 0) {
    return project
  }
  const removed = new Set(names.map(name => name.id))
  const kept = <Entry extends { id: string }>(list: readonly Entry[]) => list.filter(entry => !removed.has(entry.id))
  return {
    ...project,
    backgrounds: kept(project.backgrounds),
    music: kept(project.music),
    sounds: kept(project.sounds),
    illustrations: kept(project.illustrations),
    videos: kept(project.videos),
    characters: kept(project.characters).map(character => ({ ...character, expressions: kept(character.expressions) })),
    decisions: kept(project.decisions).map(decision => ({ ...decision, values: kept(decision.values) })),
    counters: kept(project.counters),
    shown: { ...project.shown, always: project.shown.always.filter(id => !removed.has(id)), afterAnEnding: project.shown.afterAnEnding.filter(id => !removed.has(id)) },
  }
}
