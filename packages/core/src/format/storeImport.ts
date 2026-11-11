import { firstLanguageOf } from './languages'
import type { AskBound, Condition, Directive, ImportResult, ShownDeclaration, StoryNode, StyleDeclaration } from '../importer/importTypes'
import { readAmount, readCounterValue, readDraw, readRandom } from '../importer/readControl'
import { flattenNodes, normalizeName } from '../importer/storyNodes'
import { interpretStageDirective } from '../stage/stageDirectives'
import { checkAuthorCss, styleClassName } from './authorCss'
import { StageRegistry, type RegistryCreations } from './stageRegistry'
import {
  defaultEnvironment,
  FORMAT_VERSION,
  type AskedName,
  CLOCK_COUNTERS,
  type ChapterDocument,
  type Counter,
  type ListPlace,
  type ListValue,
  type StoryList,
  type Decision,
  type Ending,
  type DecisionValue,
  type Environment,
  type ProjectDocument,
  ENDINGS_REACHED,
  withShown,
  type ShownToPlayers,
  type ShownWhen,
  type StoredAskBound,
  type StoredCondition,
  type StoredNode,
  type TextStyle,
} from './storyFormat'
import { readStyleProperty, type StyleProperty } from './textStyles'
import { placeholdersIn } from './textValues'
import { listPlaceSplitter } from './lists'
import { valueNamedIn } from './valueTags'
import { unitsFromSaved as unitsOf } from './counterNumbers'

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
  source: { fileName: string | null; language?: string },
  environment: Environment = defaultEnvironment,
  knownScenes: readonly { name: string; id: string }[] = [],
): StoredImport {
  // The language the text is in: what it says, else what the import was told, else the story's first.
  const language = result.language ?? source.language ?? firstLanguageOf(project)
  const now = environment.now()
  const decisions = new DecisionRegistry(project.decisions, environment)

  for (const declaration of result.decisions) {
    decisions.declare(declaration.name, declaration.values, declaration.multiple, declaration.lasting)
  }
  const importedNodes = [...result.chapters, ...result.scenes].flatMap(chapter => flattenNodes(chapter.nodes))
  for (const node of importedNodes) {
    if (node.type === 'choice') {
      decisions.offer(node.decision, node.options.map(option => option.value))
    }
  }
  const counters = new CounterRegistry(project.counters, environment, name => decisions.has(name))
  for (const declaration of result.counters) {
    counters.declare(declaration.name, declaration.initial, declaration.lasting, declaration.decimals)
  }
  for (const node of importedNodes) {
    if (node.type === 'add' || node.type === 'grid') {
      counters.use(node.counter)
    } else if (node.type === 'askNumber') {
      counters.use(node.counter, node.decimals)
    }
  }
  // A clock's counter shown in the text, `{hour}`, is made as one tested would be.
  const clockNames = new Set(CLOCK_COUNTERS.map(clock => normalizeName(clock.name)))
  for (const node of importedNodes) {
    const texts = node.type === 'page' ? [node.text, node.speaker ?? ''] : node.type === 'choice' ? node.options.map(option => option.text) : node.type === 'grid' ? [node.caption ?? ''] : []
    texts.flatMap(placeholdersIn).filter(name => clockNames.has(normalizeName(name))).forEach(name => counters.get(name))
  }
  const lists = new ListRegistry(project.lists ?? [], environment)
  for (const declaration of result.lists ?? []) {
    lists.declare(declaration.name, declaration.items)
  }
  const splitPlace = listPlaceSplitter(lists.names())
  /** A place of a list as written: a number, or a counter's name. */
  const listPlace = (written: string): ListPlace => /^\d+$/.test(written.trim()) ? { type: 'number', number: Number(written.trim()) } : { type: 'counter', counterId: counters.find(written).id }
  /** A value as written: itself, or in braces what a place, a decision or a counter holds. */
  const listValue = (written: string): ListValue => {
    const braced = valueNamedIn(written)
    if (braced === null) {
      return { type: 'text', text: written.trim() }
    }
    const placed = splitPlace(braced)
    if (placed !== null) {
      return { type: 'item', listId: lists.find(placed.list).id, place: listPlace(placed.place) }
    }
    const decision = decisions.get(braced)
    return decision !== undefined ? { type: 'decision', decisionId: decision.id } : { type: 'counter', counterId: counters.find(braced).id }
  }
  const askedNames = new AskedNameRegistry(project.askedNames, environment)
  for (const node of importedNodes) {
    if (node.type === 'ask') {
      askedNames.ask(node.name, node.defaultName)
    }
  }

  // A tag may name a picture by a decision's value, `[card1: {Drawn}]`: its decision is looked up among those of the import.
  const registry = new StageRegistry(project, environment, name => decisions.get(name))
  for (const shared of result.sharedPictures ?? []) {
    registry.sharePictures(shared.name, shared.from)
  }
  // A grid's tiles show the pictures of a character named like the values its list may hold: what
  // lists hold at first, what the story writes in them, and every value of a decision it copies there.
  const gridCharacters = importedNodes.flatMap(node => node.type === 'grid' && node.character !== null ? [node.character] : [])
  if (gridCharacters.length > 0) {
    const written = importedNodes.flatMap(node => node.type === 'listAdd' ? [node.value] : node.type === 'set' && splitPlace(node.decision) !== null ? [node.value] : [])
    const tileNames = new Set([
      ...lists.all().flatMap(list => list.initial),
      ...written.filter(value => valueNamedIn(value) === null).map(value => value.trim()),
      ...written.flatMap(value => {
        const braced = valueNamedIn(value)
        return braced === null ? [] : decisions.get(braced)?.values.map(decisionValue => decisionValue.name) ?? []
      }),
    ].filter(name => name !== ''))
    for (const characterName of gridCharacters) {
      const character = registry.character(characterName)
      tileNames.forEach(name => registry.expression(character, name))
    }
  }
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
  const toCondition = (condition: Condition) => storeCondition(condition, decisions, counters, endings, memories, { lists, splitPlace, listPlace, listValue })
  const styles = new StyleRegistry(project.styles, result.styles, environment, new Set(checkAuthorCss(project.css).classes))
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
            ...(option.timeout === true ? { timeout: true as const } : {}),
          })),
          ...(node.timeLimitMs === undefined ? {} : { timeLimitMs: node.timeLimitMs }),
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
        // `[set: Board 3 = cat]`: a place of a list.
        const placed = splitPlace(node.decision)
        if (placed !== null) {
          return { type: 'list', id, listId: lists.find(placed.list).id, change: { type: 'set', place: listPlace(placed.place), value: listValue(node.value) } }
        }
        const counter = counters.get(node.decision)
        if (counter !== undefined) {
          const copied = readCounterValue(node.value)
          const fromPlace = copied === null ? null : splitPlace(copied.counter)
          if (fromPlace !== null) {
            return { type: 'count', id, counterId: counter.id, operation: 'set', amount: 0, fromItem: { listId: lists.find(fromPlace.list).id, place: listPlace(fromPlace.place) } }
          }
          if (copied !== null) {
            return { type: 'count', id, counterId: counter.id, operation: 'set', amount: 0, from: { counterId: counters.find(copied.counter).id, factor: copied.factor } }
          }
          const random = readRandom(node.value)
          return random === null
            ? { type: 'count', id, counterId: counter.id, operation: 'set', amount: unitsOf(amountOf(node.value), counter) }
            : { type: 'count', id, counterId: counter.id, operation: 'random', amount: unitsOf(random.minimum, counter), maximum: unitsOf(random.maximum, counter) }
        }
        const decision = decisions.find(node.decision)
        const copied = valueNamedIn(node.value)
        if (copied !== null) {
          return { type: 'copy', id, decisionId: decision.id, fromDecisionId: decisions.find(copied).id }
        }
        const draw = readDraw(node.value)
        if (draw !== null) {
          return { type: 'draw', id, decisionId: decision.id, notInDecisionId: draw.notIn === null ? null : decisions.find(draw.notIn).id }
        }
        return { type: 'set', id, decisionId: decision.id, valueId: decisions.findValue(decision, node.value).id }
      }
      case 'ask':
        return { type: 'ask', id, askedNameId: askedNames.find(node.name).id }
      case 'grid':
        return {
          type: 'grid',
          id,
          counterId: counters.find(node.counter).id,
          columns: typeof node.columns === 'number' ? node.columns : 1,
          rows: typeof node.rows === 'number' ? node.rows : 1,
          ...(typeof node.columns === 'string' ? { columnsFrom: counters.find(node.columns).id } : {}),
          ...(typeof node.rows === 'string' ? { rowsFrom: counters.find(node.rows).id } : {}),
          ...(node.caption === undefined ? {} : { caption: node.caption }),
          listId: lists.find(node.list).id,
          characterId: node.character === null ? null : registry.character(node.character).id,
        }
      case 'listAdd':
        return { type: 'list', id, listId: lists.find(node.list).id, change: { type: 'add', value: listValue(node.value) } }
      case 'shuffle':
        return { type: 'list', id, listId: lists.find(node.list).id, change: { type: 'shuffle' } }
      case 'take':
        return {
          type: 'take',
          id,
          listId: lists.find(node.list).id,
          end: node.end,
          into: decisions.has(node.into) ? { type: 'decision', decisionId: decisions.find(node.into).id } : { type: 'counter', counterId: counters.find(node.into).id },
        }
      case 'askNumber': {
        const counter = counters.find(node.counter)
        const bound = (written: AskBound | null): StoredAskBound | null => written === null ? null
          : written.type === 'amount' ? { type: 'amount', amount: unitsOf(written.amount, counter) } : { type: 'counter', counterId: counters.find(written.counter).id }
        return { type: 'askNumber', id, counterId: counter.id, defaultAmount: unitsOf(node.defaultAmount, counter), minimum: bound(node.minimum), maximum: bound(node.maximum) }
      }
      case 'add': {
        const counter = counters.find(node.counter)
        if (node.from !== undefined) {
          return { type: 'count', id, counterId: counter.id, operation: 'add', amount: 0, from: { counterId: counters.find(node.from.counter).id, factor: node.from.factor } }
        }
        return { type: 'count', id, counterId: counter.id, operation: 'add', amount: unitsOf(node.amount, counter) }
      }
      case 'unset': {
        if (lists.get(node.decision) !== undefined) {
          return { type: 'list', id, listId: lists.find(node.decision).id, change: { type: 'clear' } }
        }
        const decision = decisions.find(node.decision)
        return { type: 'unset', id, decisionId: decision.id, valueId: node.value === null ? null : decisions.findValue(decision, node.value).id }
      }
      case 'definition':
        return {
          type: 'definition',
          id,
          kind: node.kind,
          definedId: node.kind === 'decision' ? decisions.find(node.name).id : node.kind === 'counter' ? counters.find(node.name).id : styles.idOf(node.name),
        }
      case 'ending':
        return { type: 'ending', id, endingId: endings.idOf(node.name) }
      case 'remember':
        return { type: 'remember', id, memoryId: memories.idOf(node.name), ...(node.forget === true ? { forget: true as const } : {}) }
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
      counters: counters.all(),
      ...(lists.all().length === 0 ? {} : { lists: lists.all() }),
      shown: shownWith(project.shown, result.shown, decisions.all(), counters.all()),
      askedNames: askedNames.all(),
      endings: withEndingNames(endings.all(), importedNodes, language),
      memories: memories.all(),
      styles: styles.all(),
      characters: registry.characters,
      backgrounds: registry.backgrounds,
      music: registry.music,
      sounds: registry.sounds,
      illustrations: registry.illustrations,
      videos: registry.videos,
      chapterOrder: [...project.chapterOrder, ...chapters.map(chapter => chapter.id)],
      sceneOrder: [...project.sceneOrder, ...scenes.map(scene => scene.id).filter(sceneId => !project.sceneOrder.includes(sceneId))],
      updatedAt: now,
    },
    chapters,
    scenes,
    created: registry.created,
  }
}

/** Endings with what players read of them in a language, as `[ending: Name = shown as]` says. */
function withEndingNames(endings: readonly Ending[], nodes: readonly StoryNode[], language: string): Ending[] {
  const shownAs = new Map(nodes.flatMap(node => node.type === 'ending' && node.shownAs !== undefined ? [[normalizeName(node.name), node.shownAs] as const] : []))
  return endings.map(ending => {
    const name = shownAs.get(normalizeName(ending.name))
    return name === undefined ? ending : { ...ending, translations: { ...ending.translations, [language]: name } }
  })
}

/**
 * What players may see, with what an import says: each name named again moves to what it says now.
 * Names neither a decision nor a counter are left out, `checkReferences` having reported them.
 */
export function shownWith(shown: ShownToPlayers, declarations: readonly ShownDeclaration[], decisions: readonly Decision[], counters: readonly Counter[]): ShownToPlayers {
  const idsByName = new Map([...decisions, ...counters].map(entry => [normalizeName(entry.name), entry.id]))
  let result = shown
  for (const declaration of declarations) {
    const when: ShownWhen = declaration.afterAnEnding ? 'afterAnEnding' : 'always'
    for (const name of declaration.names) {
      const id = idsByName.get(normalizeName(name))
      if (normalizeName(name) === ENDINGS_REACHED) {
        result = { ...result, endings: when }
      } else if (id !== undefined) {
        result = withShown(result, id, when)
      }
    }
  }
  return result
}

/**
 * The project's styles, those the import declares, and the styles named after a single property,
 * created on first use: `[style: italic]` needs no declaration.
 */
class StyleRegistry {
  private readonly styles: TextStyle[]

  constructor(existing: readonly TextStyle[], declared: readonly StyleDeclaration[], private readonly environment: Environment, private readonly cssClasses: ReadonlySet<string> = new Set()) {
    this.styles = [...existing]
    for (const declaration of declared) {
      const properties = declaration.properties as StyleProperty[]
      const index = this.styles.findIndex(style => normalizeName(style.name) === normalizeName(declaration.name))
      // Declared again where it may be (the project's definitions, the text it is replaced from): same identifier, new properties.
      if (index === -1) {
        this.styles.push({ id: environment.createId(), name: declaration.name, properties })
      } else {
        this.styles[index] = { id: this.styles[index]!.id, name: declaration.name, properties }
      }
    }
  }

  idOf(name: string): string {
    const style = this.styles.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (style !== undefined) {
      return style.id
    }
    const property = readStyleProperty(name)
    if (property === null) {
      // A class of the project's CSS is a style of its own, drawn by the CSS alone.
      if (this.cssClasses.has(styleClassName(name))) {
        const drawnByCss: TextStyle = { id: this.environment.createId(), name, properties: [], implicit: true }
        this.styles.push(drawnByCss)
        return drawnByCss.id
      }
      throw new Error(`Unknown style "${name}": check the import with checkReferences before storing it`)
    }
    const created: TextStyle = { id: this.environment.createId(), name: property, properties: [property], implicit: true }
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

  /**
   * A declaration: creates the decision, or gives one declared again its values, those it already
   * had keeping their identifiers. `checkReferences` made sure no value dropped is still used.
   */
  declare(name: string, valueNames: string[], multiple: boolean, lasting: boolean) {
    const index = this.decisions.findIndex(candidate => normalizeName(candidate.name) === normalizeName(name))
    const existing = this.decisions[index]
    // A value written twice, whatever its case, is one value.
    const distinctNames = valueNames.filter((valueName, valueIndex) => valueNames.findIndex(other => normalizeName(other) === normalizeName(valueName)) === valueIndex)
    const values = distinctNames.map(valueName => existing?.values.find(value => normalizeName(value.name) === normalizeName(valueName)) ?? { id: this.environment.createId(), name: valueName })
    const decision: Decision = { id: existing?.id ?? this.environment.createId(), name, multiple, values, ...(lasting ? { lasting: true as const } : {}) }
    if (existing === undefined) {
      this.decisions.push(decision)
    } else {
      this.decisions[index] = decision
    }
  }

  /** A choice: makes the decision it names when nobody declared it, or adds the values it lacks to one made by choices. */
  offer(name: string, valueNames: string[]) {
    let decision = this.decisions.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (decision === undefined) {
      decision = { id: this.environment.createId(), name, multiple: false, values: [], implicit: true }
      this.decisions.push(decision)
    }
    for (const valueName of valueNames) {
      if (!decision.values.some(value => normalizeName(value.name) === normalizeName(valueName))) {
        decision.values.push({ id: this.environment.createId(), name: valueName })
      }
    }
  }

  get(name: string): Decision | undefined {
    const wanted = normalizeName(name)
    return this.decisions.find(candidate => normalizeName(candidate.name) === wanted)
  }

  has(name: string): boolean {
    return this.get(name) !== undefined
  }

  find(name: string): Decision {
    const decision = this.get(name)
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

/** The project's counters plus those the import declares or adds to, looked up by name ignoring case. */
class CounterRegistry {
  private readonly counters: Counter[]

  constructor(existing: readonly Counter[], private readonly environment: Environment, private readonly isDecision: (name: string) => boolean = () => false) {
    this.counters = [...existing]
  }

  /** A declaration: creates the counter, or gives one declared again its initial value, keeping its identifier. */
  declare(name: string, initial: number, lasting: boolean, decimals = 0) {
    const existing = this.get(name)
    const counter: Counter = {
      id: existing?.id ?? this.environment.createId(),
      name,
      initial: unitsOf(initial, { decimals }),
      ...(decimals === 0 ? {} : { decimals }),
      ...(lasting ? { lasting: true as const } : {}),
    }
    if (existing === undefined) {
      this.counters.push(counter)
    } else {
      this.counters[this.counters.indexOf(existing)] = counter
    }
  }

  /** An `[add]` or an `[ask number]`: makes the counter it names when nobody declared it, starting at 0. */
  use(name: string, decimals = 0) {
    if (this.get(name) === undefined) {
      this.counters.push({ id: this.environment.createId(), name, initial: 0, implicit: true, ...(decimals === 0 ? {} : { decimals }) })
    }
  }

  /** A counter by name; one of the clock's, made when first named, unless a decision bears that name. */
  get(name: string): Counter | undefined {
    const found = this.counters.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    const clock = CLOCK_COUNTERS.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (found !== undefined || clock === undefined || this.isDecision(name)) {
      return found
    }
    const counter: Counter = { id: this.environment.createId(), name: clock.name, initial: 0, implicit: true, clock: clock.clock }
    this.counters.push(counter)
    return counter
  }

  find(name: string): Counter {
    const counter = this.get(name)
    if (counter === undefined) {
      throw new Error(`Unknown counter "${name}": check the import with checkReferences before storing it`)
    }
    return counter
  }

  all(): Counter[] {
    return this.counters
  }
}

/** The names the player is asked for: created by the first `[ask]`, the latest default given kept. */
class AskedNameRegistry {
  private readonly names: AskedName[]

  constructor(existing: readonly AskedName[], private readonly environment: Environment) {
    this.names = existing.map(asked => ({ ...asked }))
  }

  ask(name: string, defaultName: string | null) {
    const existing = this.names.find(asked => normalizeName(asked.name) === normalizeName(name))
    if (existing === undefined) {
      this.names.push({ id: this.environment.createId(), name, defaultName: defaultName ?? '' })
    } else if (defaultName !== null) {
      existing.defaultName = defaultName
    }
  }

  find(name: string): AskedName {
    const asked = this.names.find(candidate => normalizeName(candidate.name) === normalizeName(name))
    if (asked === undefined) {
      throw new Error(`Unknown asked name "${name}"`)
    }
    return asked
  }

  all(): AskedName[] {
    return this.names
  }
}

function amountOf(value: string): number {
  const amount = readAmount(value)
  if (amount === null) {
    throw new Error(`"${value}" is no number: check the import with checkReferences before storing it`)
  }
  return amount
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

/** How a condition reads lists: their registry, and places and values as written. */
interface ListReading {
  lists: ListRegistry
  splitPlace: (written: string) => { list: string; place: string } | null
  listPlace: (written: string) => ListPlace
  listValue: (written: string) => ListValue
}

function storeCondition(condition: Condition, decisions: DecisionRegistry, counters: CounterRegistry, endings: NameRegistry, memories: NameRegistry, reading: ListReading): StoredCondition {
  switch (condition.type) {
    case 'is': {
      const placed = reading.splitPlace(condition.decision)
      if (placed !== null && normalizeName(placed.place) === 'size') {
        const amount = readAmount(condition.value) ?? 0
        return { type: 'listSize', listId: reading.lists.find(placed.list).id, operator: condition.negated ? '!=' : '=', amount }
      }
      if (placed !== null) {
        return { type: 'listItem', listId: reading.lists.find(placed.list).id, place: reading.listPlace(placed.place), value: reading.listValue(condition.value), negated: condition.negated }
      }
      const counter = counters.get(condition.decision)
      if (counter !== undefined) {
        const other = valueNamedIn(condition.value)
        if (other !== null) {
          return { type: 'counter', counterId: counter.id, operator: condition.negated ? '!=' : '=', amount: 0, otherCounterId: counters.find(other).id }
        }
        return { type: 'counter', counterId: counter.id, operator: condition.negated ? '!=' : '=', amount: unitsOf(amountOf(condition.value), counter) }
      }
      const decision = decisions.find(condition.decision)
      return { type: 'is', decisionId: decision.id, valueId: decisions.findValue(decision, condition.value).id, negated: condition.negated }
    }
    case 'compare': {
      const sized = reading.splitPlace(condition.counter)
      if (sized !== null && normalizeName(sized.place) === 'size') {
        return { type: 'listSize', listId: reading.lists.find(sized.list).id, operator: condition.operator, amount: condition.amount }
      }
      const counter = counters.find(condition.counter)
      if (condition.other !== undefined) {
        return { type: 'counter', counterId: counter.id, operator: condition.operator, amount: 0, otherCounterId: counters.find(condition.other).id }
      }
      return { type: 'counter', counterId: counter.id, operator: condition.operator, amount: unitsOf(condition.amount, counter) }
    }
    case 'remembered':
      return { type: 'remembered', memoryId: memories.idOf(condition.memory), negated: condition.negated }
    case 'endingSeen':
      return { type: 'endingSeen', endingId: endings.idOf(condition.ending), negated: condition.negated }
    case 'and':
    case 'or':
      return { type: condition.type, conditions: condition.conditions.map(part => storeCondition(part, decisions, counters, endings, memories, reading)) }
    case 'invalid':
      throw new Error(`Invalid condition "${condition.text}": the import reported it as an error`)
  }
}

/** The project's lists plus those the import declares, looked up by name ignoring case. */
class ListRegistry {
  private readonly lists: StoryList[]

  constructor(existing: readonly StoryList[], private readonly environment: Environment) {
    this.lists = [...existing]
  }

  /** A declaration: makes the list, or gives one declared again what it starts with, keeping its identifier. */
  declare(name: string, initial: string[]) {
    const existing = this.get(name)
    const list: StoryList = { id: existing?.id ?? this.environment.createId(), name, initial }
    if (existing === undefined) {
      this.lists.push(list)
    } else {
      this.lists[this.lists.indexOf(existing)] = list
    }
  }

  get(name: string): StoryList | undefined {
    return this.lists.find(candidate => normalizeName(candidate.name) === normalizeName(name))
  }

  find(name: string): StoryList {
    const list = this.get(name)
    if (list === undefined) {
      throw new Error(`Unknown list "${name}": check the import with checkReferences before storing it`)
    }
    return list
  }

  names(): string[] {
    return this.lists.map(list => list.name)
  }

  all(): StoryList[] {
    return this.lists
  }
}
