import {
  isSupportedFormatVersion,
  type AnimationSpec,
  type ChapterDocument,
  type InlineStageCommand,
  type Placement,
  type ProjectDocument,
  type StageCommand,
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

/** The shape's fields, plus `implicit` when it is true: the mark of a name declared nowhere, kept apart from the shape. */
function withImplicit<Shape extends object>(check: Check<Shape>): Check<Shape & { implicit?: true }> {
  return (value, path) => record(value, path).implicit === true ? { ...check(value, path), implicit: true } : check(value, path)
}

/** Properties this version draws; those a newer version adds are dropped, the text shown without them. */
const styleProperties: Check<(typeof STYLE_PROPERTIES)[number][]> = (value, path) =>
  array(string)(value, path).filter((property): property is (typeof STYLE_PROPERTIES)[number] => (STYLE_PROPERTIES as readonly string[]).includes(property))

const formatVersion: Check<string> = (value, path) => isSupportedFormatVersion(string(value, path)) ? value as string : fail(path, 'a format version this player reads')

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
  background: object({ type: oneOf('background'), backgroundId: string }),
  transition: object({ type: oneOf('transition'), name: string, durationMs: nullable(duration) }),
  shake: object({ type: oneOf('shake'), strength: oneOf('light', 'strong'), durationMs: nullable(duration) }),
  flash: object({ type: oneOf('flash'), color: oneOf('white', 'red', 'black'), durationMs: nullable(duration) }),
  fade: object({ type: oneOf('fade'), direction: oneOf('out', 'in'), color: oneOf('black', 'white'), durationMs: nullable(duration) }),
  tint: object({ type: oneOf('tint'), tint: nullable(oneOf('sepia', 'night', 'grey')) }),
  textMode: object({ type: oneOf('textMode'), mode: oneOf('box', 'full') }),
  clear: object({ type: oneOf('clear') }),
  illustration: object({ type: oneOf('illustration'), illustrationId: nullable(string) }),
  music: object({ type: oneOf('music'), musicId: nullable(string) }),
  sound: object({ type: oneOf('sound'), soundId: string }),
  voice: object({ type: oneOf('voice'), soundId: string }),
  video: object({ type: oneOf('video'), videoId: string }),
  enter: object({ type: oneOf('enter'), characterId: string, expressionId: string, placement, facing: nullable(facing), depth: nullable(depth), animation }),
  exit: object({ type: oneOf('exit'), characterId: string, animation }),
  move: object({ type: oneOf('move'), characterId: string, placement: nullable(placement), depth: nullable(depth), animation }),
  expression: object({ type: oneOf('expression'), characterId: string, expressionId: string }),
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
    return object({ type: oneOf('counter'), counterId: string, operator: oneOf('=', '!=', '<', '<=', '>', '>='), amount: integer })(value, path)
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
    case 'choice':
      return object({
        type: oneOf('choice'),
        id: string,
        decisionId: string,
        options: array(object({ id: string, text: string, valueId: string, condition: (option, optionPath) => option === null ? null : condition(option, optionPath, 0) })),
      })(value, path)
    case 'set':
      return object({ type: oneOf('set'), id: string, decisionId: string, valueId: string })(value, path)
    case 'unset':
      return object({ type: oneOf('unset'), id: string, decisionId: string, valueId: nullable(string) })(value, path)
    case 'count':
      return object({ type: oneOf('count'), id: string, counterId: string, operation: oneOf('add', 'set'), amount: integer })(value, path)
    case 'ending':
      return object({ type: oneOf('ending'), id: string, endingId: string })(value, path)
    case 'remember':
      return object({ type: oneOf('remember'), id: string, memoryId: string })(value, path)
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
}

/** Far beyond any project's styles; low enough that checking it stays quick. */
export const MAXIMUM_CSS_LENGTH = 200_000
/** Longer, the CSS is left out rather than the whole project or game refused: the story still plays, plainer. */
const css: Check<string> = (value, path) => string(value, path).length <= MAXIMUM_CSS_LENGTH ? value as string : ''

export const checkProjectDocument: Check<ProjectDocument> = (value, path) =>
  checkProjectFields(typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...LATER_PROJECT_FIELDS, ...value } : value, path)

const checkProjectFields: Check<ProjectDocument> = object({
  formatVersion,
  id: string,
  name: string,
  locale: string,
  chapterOrder: array(string),
  sceneOrder: array(string),
  decisions: array(withImplicit(object({ id: string, name: string, multiple: boolean, values: array(object({ id: string, name: string })) }))),
  counters: array(withImplicit(object({ id: string, name: string, initial: integer }))),
  endings: array(object({ id: string, name: string })),
  memories: array(object({ id: string, name: string })),
  styles: array(withImplicit(object({ id: string, name: string, properties: styleProperties }))),
  characters: array(object({ id: string, name: string, expressions: array(withAssetId), drawnFacing: nullable(facing) })),
  backgrounds: array(withAssetId),
  music: array(withAssetId),
  sounds: array(withAssetId),
  illustrations: array(withAssetId),
  videos: array(withAssetId),
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
  return chapter
}
