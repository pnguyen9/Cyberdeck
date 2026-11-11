import { MAXIMUM_COUNTER_DECIMALS } from '../importer/readControl'
import {
  isSupportedFormatVersion,
  type AnimationSpec,
  type ChapterDocument,
  type InlineStageCommand,
  type ListPlace,
  type ListValue,
  type Placement,
  type ProjectDocument,
  type StageCommand,
  type Character,
  type StoredAskBound,
  type StoredChoice,
  type StoredCount,
  type StoredGrid,
  type VideoClip,
  type StoredCondition,
  type StoredNode,
  type StoredPage,
} from './storyFormat'
import { STYLE_PROPERTIES } from './textStyles'

/**
 * Checks documents that come from outside (a downloaded game) before anything uses them: every
 * field has the expected type, unknown fields are dropped (a newer minor version may add some),
 * and nesting is bounded. Throws a `DocumentError` naming the first faulty field.
 */
export class DocumentError extends Error {
  constructor(readonly path: string, expected: string) {
    super(`${path}: expected ${expected}`)
  }
}

/** Identifiers that become folder and file names once installed or backed up: nothing that could leave a folder. */
export function isPlainIdentifier(identifier: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(identifier)
}

/** Branches inside branches; far beyond any story, low enough to keep the stack safe. */
const MAXIMUM_NESTING = 64

type Check<Value> = (value: unknown, path: string) => Value

const string: Check<string> = (value, path) => typeof value === 'string' ? value : fail(path, 'a string')
const boolean: Check<boolean> = (value, path) => typeof value === 'boolean' ? value : fail(path, 'true or false')
const finiteNumber: Check<number> = (value, path) => typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a number')
const integer: Check<number> = (value, path) => Number.isSafeInteger(value) ? value as number : fail(path, 'a whole number')
const percentage: Check<number> = (value, path) => finiteNumber(value, path) >= 0 && (value as number) <= 100 ? value as number : fail(path, 'a percentage')
const duration: Check<number> = (value, path) => finiteNumber(value, path) >= 0 && (value as number) <= 600_000 ? value as number : fail(path, 'a duration')

function fail(path: string, expected: string): never {
  throw new DocumentError(path, expected)
}

function nullable<Value>(check: Check<Value>): Check<Value | null> {
  return (value, path) => value === null ? null : check(value, path)
}

function oneOf<const Values extends readonly string[]>(...values: Values): Check<Values[number]> {
  return (value, path) => values.includes(value as string) ? value as Values[number] : fail(path, values.join(' or '))
}

function array<Value>(check: Check<Value>): Check<Value[]> {
  return (value, path) => Array.isArray(value) ? value.map((item, index) => check(item, `${path}[${index}]`)) : fail(path, 'a list')
}

function record(value: unknown, path: string): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : fail(path, 'an object')
}

/** Keeps only the fields of the shape, each checked. */
function object<Shape extends object>(shape: { [Key in keyof Shape]: Check<Shape[Key]> }): Check<Shape> {
  return (value, path) => {
    const fields = record(value, path)
    return Object.fromEntries(Object.entries(shape).map(([key, check]) => [key, (check as Check<unknown>)(fields[key], `${path}.${key}`)])) as Shape
  }
}

/**
 * The shape's fields, plus a mark that is only ever true when present: `implicit` for a name declared
 * nowhere, `timeout` for the option a timed choice takes when time runs out, `forget` for a memory
 * taken away. Kept apart from the shape, which then never holds it false.
 */
function withFlag<Shape extends object, Field extends string>(field: Field, check: Check<Shape>): Check<Shape & { [Key in Field]?: true }> {
  return (value, path) => (record(value, path)[field] === true ? { ...check(value, path), [field]: true } : check(value, path)) as Shape & { [Key in Field]?: true }
}

/** A field kept only when there is one: a later version's, which earlier documents do not have. */
function withOptional<Shape extends object, Field extends string, Value>(field: Field, fieldCheck: Check<Value>, check: Check<Shape>): Check<Shape & { [Key in Field]?: Value }> {
  return (value, path) => {
    const written = record(value, path)[field]
    return (written === undefined ? check(value, path) : { ...check(value, path), [field]: fieldCheck(written, `${path}.${field}`) }) as Shape & { [Key in Field]?: Value }
  }
}

/** A picture a decision's value names, `[card1: {Drawn}]`: the decision, kept only when there is one. */
function withValueFrom<Shape extends object>(check: Check<Shape>): Check<Shape & { from?: string }> {
  return withOptional('from', string, check)
}

/** A counter's decimals, kept only when it has some: 1 to the most a counter may count with. */
function withDecimals<Shape extends object>(check: Check<Shape>): Check<Shape & { decimals?: number }> {
  return (value, path) => {
    const decimals = record(value, path).decimals
    if (decimals === undefined || decimals === 0) {
      return check(value, path)
    }
    return Number.isInteger(decimals) && (decimals as number) > 0 && (decimals as number) <= MAXIMUM_COUNTER_DECIMALS
      ? { ...check(value, path), decimals: decimals as number }
      : fail(`${path}.decimals`, `a number of decimals, 1 to ${MAXIMUM_COUNTER_DECIMALS}`)
  }
}

/** A language code, as a key or a value: letters, then subtags, nothing that could leave a folder. */
const languageCode: Check<string> = (value, path) => typeof value === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8}){0,3}$/.test(value) ? value : fail(path, 'a language code')

/** An object whose keys are language codes, each value checked. */
function byLanguage<Value>(check: Check<Value>): Check<Record<string, Value>> {
  return (value, path) => Object.fromEntries(Object.entries(record(value, path)).map(([key, item]) => [languageCode(key, `${path} key`), check(item, `${path}.${key}`)]))
}

/** Properties this version draws; those a newer version adds are dropped, the text shown without them. */
const styleProperties: Check<(typeof STYLE_PROPERTIES)[number][]> = (value, path) =>
  array(string)(value, path).filter((property): property is (typeof STYLE_PROPERTIES)[number] => (STYLE_PROPERTIES as readonly string[]).includes(property))

const formatVersion: Check<string> = (value, path) => isSupportedFormatVersion(string(value, path)) ? value as string : fail(path, 'a format version this player reads')

/** A bound of a number asked for: a number, or a counter. */
const askBound: Check<StoredAskBound> = (value, path) => {
  const fields = record(value, path)
  return fields.type === 'amount' ? { type: 'amount', amount: integer(fields.amount, `${path}.amount`) }
    : fields.type === 'counter' ? { type: 'counter', counterId: string(fields.counterId, `${path}.counterId`) }
      : fail(`${path}.type`, 'amount or counter')
}

const animationKind = oneOf('instant', 'fade', 'slide-from-left', 'slide-from-right', 'slide-to-left', 'slide-to-right')
const facing = oneOf('left', 'right')
const depth = oneOf('near', 'middle', 'far')

const animation: Check<AnimationSpec> = object({ kind: nullable(animationKind), durationMs: nullable(duration), wait: boolean })

const placement: Check<Placement> = (value, path) => {
  const fields = record(value, path)
  switch (fields.type) {
    case 'auto':
      return { type: 'auto' }
    case 'preset':
      return { type: 'preset', presetId: string(fields.presetId, `${path}.presetId`) }
    case 'exact':
      return { type: 'exact', x: percentage(fields.x, `${path}.x`) }
    default:
      return fail(`${path}.type`, 'auto, preset or exact')
  }
}

const STAGE_COMMANDS: { [Type in StageCommand['type']]: Check<Extract<StageCommand, { type: Type }>> } = {
  background: withValueFrom(object({ type: oneOf('background'), backgroundId: string })),
  transition: object({ type: oneOf('transition'), name: string, durationMs: nullable(duration) }),
  shake: object({ type: oneOf('shake'), strength: oneOf('light', 'strong'), durationMs: nullable(duration) }),
  flash: object({ type: oneOf('flash'), color: oneOf('white', 'red', 'black'), durationMs: nullable(duration) }),
  fade: object({ type: oneOf('fade'), direction: oneOf('out', 'in'), color: oneOf('black', 'white'), durationMs: nullable(duration) }),
  tint: object({ type: oneOf('tint'), tint: nullable(oneOf('sepia', 'night', 'grey')) }),
  continued: object({ type: oneOf('continued'), text: nullable(string) }),
  gameMode: object({ type: oneOf('gameMode'), on: boolean }),
  textMode: object({ type: oneOf('textMode'), mode: oneOf('box', 'full') }),
  clear: object({ type: oneOf('clear') }),
  illustration: withValueFrom(object({ type: oneOf('illustration'), illustrationId: nullable(string) })),
  music: object({ type: oneOf('music'), musicId: nullable(string) }),
  sound: object({ type: oneOf('sound'), soundId: string }),
  voice: object({ type: oneOf('voice'), soundId: string }),
  video: object({ type: oneOf('video'), videoId: string }),
  enter: withValueFrom(object({ type: oneOf('enter'), characterId: string, expressionId: string, placement, facing: nullable(facing), depth: nullable(depth), animation })),
  exit: object({ type: oneOf('exit'), characterId: string, animation }),
  move: object({ type: oneOf('move'), characterId: string, placement: nullable(placement), depth: nullable(depth), animation }),
  expression: withOptional('turn', withFlag('wait', object({ durationMs: duration })), withValueFrom(object({ type: oneOf('expression'), characterId: string, expressionId: string }))),
  wait: object({ type: oneOf('wait'), seconds: (value, path) => finiteNumber(value, path) >= 0 && (value as number) <= 600 ? value as number : fail(path, 'at most ten minutes, in seconds') }),
}

const stageCommand: Check<StageCommand> = (value, path) => {
  const type = record(value, path).type
  const check = Object.hasOwn(STAGE_COMMANDS, type as string) ? STAGE_COMMANDS[type as StageCommand['type']] : undefined
  return check === undefined ? fail(`${path}.type`, 'a stage command') : check(value, path)
}

const inlineStageCommand: Check<InlineStageCommand> = (value, path) =>
  ({ ...stageCommand(value, path), offset: finiteNumber(record(value, path).offset, `${path}.offset`) })

function condition(value: unknown, path: string, depth: number): StoredCondition {
  if (depth > MAXIMUM_NESTING) {
    return fail(path, `at most ${MAXIMUM_NESTING} nested conditions`)
  }
  const fields = record(value, path)
  if (fields.type === 'is') {
    return object({ type: oneOf('is'), decisionId: string, valueId: string, negated: boolean })(value, path)
  }
  if (fields.type === 'remembered') {
    return object({ type: oneOf('remembered'), memoryId: string, negated: boolean })(value, path)
  }
  if (fields.type === 'endingSeen') {
    return object({ type: oneOf('endingSeen'), endingId: string, negated: boolean })(value, path)
  }
  if (fields.type === 'counter') {
    return withOptional('otherCounterId', string, object({ type: oneOf('counter'), counterId: string, operator: oneOf('=', '!=', '<', '<=', '>', '>='), amount: integer }))(value, path)
  }
  if (fields.type === 'listItem') {
    return { type: 'listItem', listId: string(fields.listId, `${path}.listId`), place: listPlace(fields.place, `${path}.place`), value: listValue(fields.value, `${path}.value`), negated: boolean(fields.negated, `${path}.negated`) }
  }
  if (fields.type === 'listSize') {
    return object({ type: oneOf('listSize'), listId: string, operator: oneOf('=', '!=', '<', '<=', '>', '>='), amount: integer })(value, path)
  }
  if (fields.type === 'and' || fields.type === 'or') {
    const conditions = Array.isArray(fields.conditions) ? fields.conditions : fail(`${path}.conditions`, 'a list')
    return { type: fields.type, conditions: conditions.map((part, index) => condition(part, `${path}.conditions[${index}]`, depth + 1)) }
  }
  return fail(`${path}.type`, 'is, counter, remembered, endingSeen, and or or')
}

function node(value: unknown, path: string, depth: number): StoredNode {
  const fields = record(value, path)
  switch (fields.type) {
    case 'page': {
      const page: StoredPage = object({
        type: oneOf('page'),
        id: string,
        kind: oneOf('narration', 'dialogue'),
        speakerId: nullable(string),
        text: string,
        commandsBefore: array(stageCommand),
        inlineCommands: array(inlineStageCommand),
      })(value, path)
      // Players reach inline commands in the order of the text.
      page.inlineCommands.sort((first, second) => first.offset - second.offset)
      if (fields.styles !== undefined) {
        page.styles = array(object({ start: finiteNumber, end: finiteNumber, styleId: string }))(fields.styles, `${path}.styles`)
        page.styles.forEach((span, index) => {
          if (span.start < 0 || span.start > span.end || span.end > page.text.length) {
            fail(`${path}.styles[${index}]`, 'a part of the page text')
          }
        })
      }
      return page
    }
    case 'stage':
      return object({ type: oneOf('stage'), id: string, commands: array(stageCommand) })(value, path)
    case 'choice': {
      const choice: StoredChoice = object({
        type: oneOf('choice'),
        id: string,
        decisionId: string,
        options: array(withFlag('timeout', object({ id: string, text: string, valueId: string, condition: (option, optionPath) => option === null ? null : condition(option, optionPath, 0) }))),
      })(value, path)
      if (fields.timeLimitMs !== undefined) {
        choice.timeLimitMs = duration(fields.timeLimitMs, `${path}.timeLimitMs`)
      }
      return choice
    }
    case 'ask':
      return object({ type: oneOf('ask'), id: string, askedNameId: string })(value, path)
    case 'list': {
      const change = record(fields.change, `${path}.change`)
      const id = string(fields.id, `${path}.id`)
      const listId = string(fields.listId, `${path}.listId`)
      switch (change.type) {
        case 'set':
          return { type: 'list', id, listId, change: { type: 'set', place: listPlace(change.place, `${path}.change.place`), value: listValue(change.value, `${path}.change.value`) } }
        case 'add':
          return { type: 'list', id, listId, change: { type: 'add', value: listValue(change.value, `${path}.change.value`) } }
        case 'shuffle':
        case 'clear':
          return { type: 'list', id, listId, change: { type: change.type } }
        default:
          return fail(`${path}.change.type`, 'set, add, shuffle or clear')
      }
    }
    case 'grid': {
      const grid: Check<StoredGrid> = object({ type: oneOf('grid'), id: string, counterId: string, columns: integer, rows: integer, listId: string, characterId: nullable(string) })
      return withOptional('rowsFrom', string, withOptional('columnsFrom', string, grid))(value, path)
    }
    case 'take': {
      const into = record(fields.into, `${path}.into`)
      return {
        type: 'take',
        id: string(fields.id, `${path}.id`),
        listId: string(fields.listId, `${path}.listId`),
        end: oneOf('first', 'last')(fields.end, `${path}.end`),
        into: into.type === 'decision' ? { type: 'decision', decisionId: string(into.decisionId, `${path}.into.decisionId`) } : { type: 'counter', counterId: string(into.counterId, `${path}.into.counterId`) },
      }
    }
    case 'copy':
      return object({ type: oneOf('copy'), id: string, decisionId: string, fromDecisionId: string })(value, path)
    case 'draw':
      return object({ type: oneOf('draw'), id: string, decisionId: string, notInDecisionId: nullable(string) })(value, path)
    case 'askNumber':
      return object({ type: oneOf('askNumber'), id: string, counterId: string, defaultAmount: integer, minimum: nullable(askBound), maximum: nullable(askBound) })(value, path)
    case 'set':
      return object({ type: oneOf('set'), id: string, decisionId: string, valueId: string })(value, path)
    case 'unset':
      return object({ type: oneOf('unset'), id: string, decisionId: string, valueId: nullable(string) })(value, path)
    case 'count': {
      const count: StoredCount = object({ type: oneOf('count'), id: string, counterId: string, operation: oneOf('add', 'set', 'random'), amount: integer })(value, path)
      if (fields.from !== undefined) {
        const from = record(fields.from, `${path}.from`)
        count.from = { counterId: string(from.counterId, `${path}.from.counterId`), factor: finiteNumber(from.factor, `${path}.from.factor`) }
      }
      if (fields.fromItem !== undefined) {
        const fromItem = record(fields.fromItem, `${path}.fromItem`)
        count.fromItem = { listId: string(fromItem.listId, `${path}.fromItem.listId`), place: listPlace(fromItem.place, `${path}.fromItem.place`) }
      }
      if (count.operation === 'random') {
        const maximum = integer(fields.maximum, `${path}.maximum`)
        count.maximum = maximum >= count.amount ? maximum : fail(`${path}.maximum`, 'a number at least the lowest one')
      }
      return count
    }
    case 'ending':
      return object({ type: oneOf('ending'), id: string, endingId: string })(value, path)
    case 'remember':
      return withFlag('forget', object({ type: oneOf('remember'), id: string, memoryId: string }))(value, path)
    case 'definition':
      return object({ type: oneOf('definition'), id: string, kind: oneOf('decision', 'counter', 'style'), definedId: string })(value, path)
    case 'break':
      return object({ type: oneOf('break'), id: string })(value, path)
    case 'play':
      return object({ type: oneOf('play'), id: string, sceneId: string })(value, path)
    case 'loop': {
      if (depth > MAXIMUM_NESTING) {
        return fail(path, `at most ${MAXIMUM_NESTING} nested blocks`)
      }
      const nodes = Array.isArray(fields.nodes) ? fields.nodes : fail(`${path}.nodes`, 'a list')
      return { type: 'loop', id: string(fields.id, `${path}.id`), nodes: nodes.map((inner, index) => node(inner, `${path}.nodes[${index}]`, depth + 1)) }
    }
    case 'condition': {
      if (depth > MAXIMUM_NESTING) {
        return fail(path, `at most ${MAXIMUM_NESTING} nested branches`)
      }
      const branches = Array.isArray(fields.branches) ? fields.branches : fail(`${path}.branches`, 'a list')
      return {
        type: 'condition',
        id: string(fields.id, `${path}.id`),
        branches: branches.map((branch, index) => {
          const branchPath = `${path}.branches[${index}]`
          const branchFields = record(branch, branchPath)
          const nodes = Array.isArray(branchFields.nodes) ? branchFields.nodes : fail(`${branchPath}.nodes`, 'a list')
          return {
            id: string(branchFields.id, `${branchPath}.id`),
            condition: branchFields.condition === null ? null : condition(branchFields.condition, `${branchPath}.condition`, 0),
            nodes: nodes.map((inner, innerIndex) => node(inner, `${branchPath}.nodes[${innerIndex}]`, depth + 1)),
          }
        }),
      }
    }
    default:
      return fail(`${path}.type`, 'a story node')
  }
}

const withAssetId = object({ id: string, name: string, assetId: nullable(string) })

/** Fields added to projects after documents were first written: absent from those, they take these values. */
const LATER_PROJECT_FIELDS = {
  counters: [],
  askedNames: [],
  illustrations: [],
  videos: [],
  fonts: [],
  styles: [],
  sounds: [],
  sceneOrder: [],
  endings: [],
  memories: [],
  details: { description: '', credits: '', coverAssetId: null },
  css: '',
  chapterTitleCards: false,
  frames: { textBox: null, namePlate: null },
  shown: { always: [], afterAnEnding: [], endings: null },
  languages: [],
}

/** Far beyond any project's styles; low enough that checking it stays quick. */
export const MAXIMUM_CSS_LENGTH = 200_000
/** Longer, the CSS is left out rather than the whole project or game refused: the story still plays, plainer. */
const css: Check<string> = (value, path) => string(value, path).length <= MAXIMUM_CSS_LENGTH ? value as string : ''

export const checkProjectDocument: Check<ProjectDocument> = (value, path) => {
  const project = checkProjectFields(typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...LATER_PROJECT_FIELDS, ...value } : value, path)
  // Lists, since 3.0: kept only by projects that have some.
  return withOptional('lists', array(object({ id: string, name: string, initial: array(string) })), () => project)(value, path)
}

/** A place in a list: a number from 1, or a counter. */
const listPlace: Check<ListPlace> = (value, path) => {
  const fields = record(value, path)
  return fields.type === 'number' ? { type: 'number', number: integer(fields.number, `${path}.number`) }
    : fields.type === 'counter' ? { type: 'counter', counterId: string(fields.counterId, `${path}.counterId`) }
      : fail(`${path}.type`, 'number or counter')
}

/** A value given to or tested in a list. */
const listValue: Check<ListValue> = (value, path) => {
  const fields = record(value, path)
  switch (fields.type) {
    case 'text':
      return { type: 'text', text: string(fields.text, `${path}.text`) }
    case 'decision':
      return { type: 'decision', decisionId: string(fields.decisionId, `${path}.decisionId`) }
    case 'counter':
      return { type: 'counter', counterId: string(fields.counterId, `${path}.counterId`) }
    case 'item':
      return { type: 'item', listId: string(fields.listId, `${path}.listId`), place: listPlace(fields.place, `${path}.place`) }
    default:
      return fail(`${path}.type`, 'text, decision, counter or item')
  }
}

const checkProjectFields: Check<ProjectDocument> = object({
  formatVersion,
  id: string,
  name: string,
  locale: string,
  languages: array(languageCode),
  chapterOrder: array(string),
  sceneOrder: array(string),
  decisions: array(withFlag('lasting', withFlag('implicit', object({ id: string, name: string, multiple: boolean, values: array(object({ id: string, name: string })) })))),
  counters: array(withOptional('clock', oneOf('hour', 'weekday', 'timeAway'), withDecimals(withFlag('lasting', withFlag('implicit', object({ id: string, name: string, initial: integer })))))),
  askedNames: array(object({ id: string, name: string, defaultName: string })),
  endings: array((ending, endingPath) => {
    const checked = object({ id: string, name: string })(ending, endingPath)
    const translations = record(ending, endingPath).translations
    return translations === undefined ? checked : { ...checked, translations: byLanguage(string)(translations, `${endingPath}.translations`) }
  }),
  memories: array(object({ id: string, name: string })),
  styles: array(withFlag('implicit', object({ id: string, name: string, properties: styleProperties }))),
  characters: array((value, path) => {
    const character: Character = object({ id: string, name: string, expressions: array(withAssetId), drawnFacing: nullable(facing) })(value, path)
    const { nameColor: color, picturesFrom } = record(value, path)
    const colored = color === undefined ? character : { ...character, nameColor: /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color) : fail(`${path}.nameColor`, 'a colour, #rrggbb') }
    return picturesFrom === undefined ? colored : { ...colored, picturesFrom: string(picturesFrom, `${path}.picturesFrom`) }
  }),
  backgrounds: array(withAssetId),
  music: array(withAssetId),
  sounds: array(withAssetId),
  illustrations: array(withAssetId),
  videos: array((value, path) => {
    const video: VideoClip = withAssetId(value, path)
    const captions = record(value, path).captionsAssetId
    return captions === undefined ? video : { ...video, captionsAssetId: string(captions, `${path}.captionsAssetId`) }
  }),
  fonts: array(object({ id: string, name: string, assetId: nullable(string), widthScale: (value, path) => finiteNumber(value, path) > 0 && (value as number) <= 4 ? value as number : fail(path, 'a width scale') })),
  assets: array(object({ id: string, fileName: string, mediaType: string, byteSize: finiteNumber })),
  positions: array(object({ id: string, name: string, x: percentage })),
  stageDefaults: object({
    enter: object({ kind: animationKind, durationMs: duration }),
    exit: object({ kind: animationKind, durationMs: duration }),
    move: object({ durationMs: duration }),
  }),
  details: object({ description: string, credits: string, coverAssetId: nullable(string) }),
  css,
  chapterTitleCards: boolean,
  frames: object({ textBox: nullable(string), namePlate: nullable(string) }),
  shown: object({ always: array(string), afterAnEnding: array(string), endings: nullable(oneOf('always', 'afterAnEnding')) }),
  createdAt: string,
  updatedAt: string,
})

export const checkChapterDocument: Check<ChapterDocument> = (value, path) => {
  const fields = record(value, path)
  const nodes = Array.isArray(fields.nodes) ? fields.nodes : fail(`${path}.nodes`, 'a list')
  const chapter: ChapterDocument = {
    formatVersion: formatVersion(fields.formatVersion, `${path}.formatVersion`),
    id: string(fields.id, `${path}.id`),
    title: nullable(string)(fields.title, `${path}.title`),
    nodes: nodes.map((inner, index) => node(inner, `${path}.nodes[${index}]`, 0)),
    createdAt: string(fields.createdAt, `${path}.createdAt`),
    updatedAt: string(fields.updatedAt, `${path}.updatedAt`),
  }
  if (fields.condition !== undefined) {
    chapter.condition = condition(fields.condition, `${path}.condition`, 0)
  }
  // Kept in project backups; game archives leave it out.
  if (fields.importedFrom !== undefined) {
    chapter.importedFrom = object({ fileName: nullable(string), importedAt: string })(fields.importedFrom, `${path}.importedFrom`)
  }
  if (fields.translations !== undefined) {
    chapter.translations = byLanguage((translation, translationPath) => {
      const translationFields = record(translation, translationPath)
      const translatedNodes = Array.isArray(translationFields.nodes) ? translationFields.nodes : fail(`${translationPath}.nodes`, 'a list')
      return {
        title: nullable(string)(translationFields.title, `${translationPath}.title`),
        nodes: translatedNodes.map((inner, index) => node(inner, `${translationPath}.nodes[${index}]`, 0)),
        ...(translationFields.importedFrom === undefined ? {} : { importedFrom: object({ fileName: nullable(string), importedAt: string })(translationFields.importedFrom, `${translationPath}.importedFrom`) }),
      }
    })(fields.translations, `${path}.translations`)
  }
  if (fields.hollow === true) {
    chapter.hollow = true
  }
  return chapter
}
