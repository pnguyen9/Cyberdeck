import type { Condition, Directive, ImportResult, StoryNode, StyleDeclaration } from '../importer/importTypes'
import { flattenNodes, normalizeName } from '../importer/storyNodes'
import { interpretStageDirective } from '../stage/stageDirectives'
import { StageRegistry, type RegistryCreations } from './stageRegistry'
import {
  defaultEnvironment,
  FORMAT_VERSION,
  type ChapterDocument,
  type Decision,
  type DecisionValue,
  type Environment,
  type ProjectDocument,
  type StoredCondition,
  type StoredNode,
  type TextStyle,
} from './storyFormat'
import { readStyleProperty, type StyleProperty } from './textStyles'

export interface StoredImport {
  /** A new project document; the one given is left untouched. */
  project: ProjectDocument
  /** In the order of the import, already appended to `project.chapterOrder`. */
  chapters: ChapterDocument[]
  /** New scenes appended to `project.sceneOrder`; one named like a scene of the project replaces it, keeping its identifier. */
  scenes: ChapterDocument[]
  /** Registry entries the import created because the text named them. */
  created: RegistryCreations
}

/**
 * Turns a checked import into documents: identifiers for chapters and nodes, decisions,
 * characters, backgrounds and music added to the project, names replaced by identifiers.
 *
 * Speakers are registered first, so that a character takes the name as written for speech
 * (`Marie`) rather than as written in directives (`[enter: marie]`).
 *
 * Expects an import without errors, `checkReferences` included: a reference that cannot be
 * resolved throws. `knownScenes` are the scenes of the project, which `[play]` may name.
 */
export function storeImport(
  result: ImportResult,
  project: ProjectDocument,
  source: { fileName: string | null },
  environment: Environment = defaultEnvironment,
  knownScenes: readonly { name: string; id: string }[] = [],
): StoredImport {
  const now = environment.now()
  const decisions = new DecisionRegistry(project.decisions, environment)

  for (const declaration of result.decisions) {
    decisions.declare(declaration.name, declaration.values, declaration.multiple)
  }
  const importedNodes = [...result.chapters, ...result.scenes].flatMap(chapter => flattenNodes(chapter.nodes))
  for (const node of importedNodes) {
    if (node.type === 'choice') {
      decisions.declare(node.decision, node.options.map(option => option.value), false)
    }
  }

  const registry = new StageRegistry(project, environment)
  const toCommand = (directive: Directive) => {
    const instruction = interpretStageDirective(directive, registry.vocabulary())
    if (instruction === null) {
      throw new Error(`Invalid stage directive [${directive.name}]: the import reported it as an error`)
    }
    return registry.resolve(instruction)
  }
  for (const node of importedNodes) {
    if (node.type === 'page' && node.speaker !== null) {
      registry.character(node.speaker)
    }
  }
  for (const node of importedNodes) {
    if (node.type === 'page') {
      [...node.directivesBefore, ...node.inlineDirectives].forEach(toCommand)
    } else if (node.type === 'stage') {
      node.directives.forEach(toCommand)
    }
  }

  const endings = new NameRegistry(project.endings, environment)
  const memories = new NameRegistry(project.memories, environment)
  const toCondition = (condition: Condition) => storeCondition(condition, decisions, endings, memories)
  const styles = new StyleRegistry(project.styles, result.styles, environment)
  // Plays may name scenes written further down: every scene has its identifier before any node is stored.
  const sceneIds = new Map(knownScenes.map(scene => [normalizeName(scene.name), scene.id]))
  const importedSceneIds = result.scenes.map(scene => {
    const name = normalizeName(scene.title ?? '')
    const id = sceneIds.get(name) ?? environment.createId()
    sceneIds.set(name, id)
    return id
  })

  const storeNodes = (nodes: StoryNode[]): StoredNode[] => nodes.map((node): StoredNode => {
    const id = environment.createId()
    switch (node.type) {
      case 'page':
        return {
          type: 'page',
          id,
          kind: node.kind,
          speakerId: node.speaker === null ? null : registry.character(node.speaker).id,
          text: node.text,
          commandsBefore: node.directivesBefore.map(toCommand),
          inlineCommands: node.inlineDirectives.map(directive => ({ offset: directive.offset, ...toCommand(directive) })),
          ...(node.styles === undefined ? {} : { styles: node.styles.map(span => ({ start: span.start, end: span.end, styleId: styles.idOf(span.style) })) }),
        }
      case 'stage':
        return { type: 'stage', id, commands: node.directives.map(toCommand) }
      case 'choice': {
        const decision = decisions.find(node.decision)
        return {
          type: 'choice',
          id,
          decisionId: decision.id,
          options: node.options.map(option => ({
            id: environment.createId(),
            text: option.text,
            valueId: decisions.findValue(decision, option.value).id,
            condition: option.condition === undefined ? null : toCondition(option.condition),
          })),
        }
      }
      case 'condition':
        return {
          type: 'condition',
          id,
          branches: node.branches.map(branch => ({
            id: environment.createId(),
            condition: branch.condition === null ? null : toCondition(branch.condition),
            nodes: storeNodes(branch.nodes),
          })),
        }
      case 'loop':
        return { type: 'loop', id, nodes: storeNodes(node.nodes) }
      case 'break':
        return { type: 'break', id }
      case 'play': {
        const sceneId = sceneIds.get(normalizeName(node.scene))
        if (sceneId === undefined) {
          throw new Error(`Unknown scene "${node.scene}": check the import with checkReferences before storing it`)
        }
        return { type: 'play', id, sceneId }
      }
      case 'set': {
        const decision = decisions.find(node.decision)
        return { type: 'set', id, decisionId: decision.id, valueId: decisions.findValue(decision, node.value).id }
      }
      case 'unset': {
        const decision = decisions.find(node.decision)
        return { type: 'unset', id, decisionId: decision.id, valueId: node.value === null ? null : decisions.findValue(decision, node.value).id }
      }
      case 'ending':
        return { type: 'ending', id, endingId: endings.idOf(node.name) }
      case 'remember':
        return { type: 'remember', id, memoryId: memories.idOf(node.name) }
    }
  })

  const chapters = result.chapters.map((chapter): ChapterDocument => ({
    formatVersion: FORMAT_VERSION,
    id: environment.createId(),
    title: chapter.title,
    ...(chapter.condition === undefined ? {} : { condition: toCondition(chapter.condition) }),
    importedFrom: { fileName: source.fileName, importedAt: now },
    nodes: storeNodes(chapter.nodes),
    createdAt: now,
    updatedAt: now,
  }))

  const scenes = result.scenes.map((scene, index): ChapterDocument => ({
    formatVersion: FORMAT_VERSION,
    id: importedSceneIds[index]!,
    title: scene.title,
    importedFrom: { fileName: source.fileName, importedAt: now },
    nodes: storeNodes(scene.nodes),
    createdAt: now,
    updatedAt: now,
  }))

  return {
    project: {
      ...project,
      decisions: decisions.all(),
      endings: endings.all(),
      memories: memories.all(),
      styles: styles.all(),
      characters: registry.characters,
      backgrounds: registry.backgrounds,
      music: registry.music,
      sounds: registry.sounds,
      illustrations: registry.illustrations,
      chapterOrder: [...project.chapterOrder, ...chapters.map(chapter => chapter.id)],
      sceneOrder: [...project.sceneOrder, ...scenes.map(scene => scene.id).filter(sceneId => !project.sceneOrder.includes(sceneId))],
      updatedAt: now,
    },
    chapters,
    scenes,
    created: registry.created,
  }
}

/**
 * The project's styles, those the import declares, and the styles named after a single property,
 * created on first use: `[style: italic]` needs no declaration.
 */
class StyleRegistry {
  private readonly styles: TextStyle[]

  constructor(existing: readonly TextStyle[], declared: readonly StyleDeclaration[], private readonly environment: Environment) {
    this.styles = [...existing]
    for (const declaration of declared) {
      this.styles.push({ id: environment.createId(), name: declaration.name, properties: declaration.properties as StyleProperty[] })
    }
  }

  idOf(name: string): string {
    const style = this.styles.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (style !== undefined) {
      return style.id
    }
    const property = readStyleProperty(name)
    if (property === null) {
      throw new Error(`Unknown style "${name}": check the import with checkReferences before storing it`)
    }
    const created: TextStyle = { id: this.environment.createId(), name: property, properties: [property] }
    this.styles.push(created)
    return created.id
  }

  all(): TextStyle[] {
    return this.styles
  }
}

/** The project's decisions plus those the import adds, looked up by name ignoring case. */
class DecisionRegistry {
  private readonly decisions: Decision[]

  constructor(existingDecisions: Decision[], private readonly environment: Environment) {
    this.decisions = existingDecisions.map(decision => ({ ...decision, values: [...decision.values] }))
  }

  /** Creates the decision, or adds the values it lacks. */
  declare(name: string, valueNames: string[], multiple: boolean) {
    let decision = this.decisions.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (decision === undefined) {
      decision = { id: this.environment.createId(), name, multiple, values: [] }
      this.decisions.push(decision)
    }
    for (const valueName of valueNames) {
      if (!decision.values.some(value => normalizeName(value.name) === normalizeName(valueName))) {
        decision.values.push({ id: this.environment.createId(), name: valueName })
      }
    }
  }

  find(name: string): Decision {
    const decision = this.decisions.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (decision === undefined) {
      throw new Error(`Unknown decision "${name}": check the import with checkReferences before storing it`)
    }
    return decision
  }

  findValue(decision: Decision, valueName: string): DecisionValue {
    const value = decision.values.find(candidate => normalizeName(candidate.name) === normalizeName(valueName))
    if (value === undefined) {
      throw new Error(`Unknown value "${valueName}" of decision "${decision.name}": check the import with checkReferences before storing it`)
    }
    return value
  }

  all(): Decision[] {
    return this.decisions
  }
}

/** Endings and memories: created by being named, found again by name ignoring case. */
class NameRegistry {
  private readonly entries: { id: string; name: string }[]

  constructor(existing: readonly { id: string; name: string }[], private readonly environment: Environment) {
    this.entries = [...existing]
  }

  idOf(name: string): string {
    const existing = this.entries.find(entry => normalizeName(entry.name) === normalizeName(name))
    if (existing !== undefined) {
      return existing.id
    }
    const entry = { id: this.environment.createId(), name }
    this.entries.push(entry)
    return entry.id
  }

  all(): { id: string; name: string }[] {
    return this.entries
  }
}

function storeCondition(condition: Condition, decisions: DecisionRegistry, endings: NameRegistry, memories: NameRegistry): StoredCondition {
  switch (condition.type) {
    case 'is': {
      const decision = decisions.find(condition.decision)
      return { type: 'is', decisionId: decision.id, valueId: decisions.findValue(decision, condition.value).id, negated: condition.negated }
    }
    case 'remembered':
      return { type: 'remembered', memoryId: memories.idOf(condition.memory), negated: condition.negated }
    case 'endingSeen':
      return { type: 'endingSeen', endingId: endings.idOf(condition.ending), negated: condition.negated }
    case 'and':
    case 'or':
      return { type: condition.type, conditions: condition.conditions.map(part => storeCondition(part, decisions, endings, memories)) }
    case 'invalid':
      throw new Error(`Invalid condition "${condition.text}": the import reported it as an error`)
  }
}
