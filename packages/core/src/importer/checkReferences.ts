import { CLOCK_COUNTERS, ENDINGS_REACHED } from '../format/storyFormat'
import { STAGE_KEYWORDS } from '../stage/stageDirectives'
import { valueNamedIn } from '../format/valueTags'

/** Tags showing a picture, which a decision's value may name: besides a character's own, `[marie: {Mood}]`. */
const PICTURE_TAGS: ReadonlySet<string> = new Set(['enter', 'bg', 'background', 'illustration', 'cg'])
import { styleClassName } from '../format/authorCss'
import { placeholdersIn } from '../format/textValues'
import { readStyleProperty } from '../format/textStyles'
import type { Condition, ImportedChapter, ImportProblem, ImportResult, StoryNode } from './importTypes'
import { decimalsOf, decimalsWritten, readAmount, readDraw, readRandom } from './readControl'
import { flattenNodes, normalizeName } from './storyNodes'

/**
 * A decision, counter or style the project has. Declared somewhere else (`declaredIn` names where), it cannot
 * be declared again; in the project's definitions or in the text replaced (`declaredIn` null), a
 * declaration gives it its new values, which must keep those still used elsewhere (`usedValues`).
 * An implicit one was made by choices: later choices add values to it.
 */
export interface KnownDefinition {
  name: string
  declaredIn?: string | null
  implicit?: boolean
  /** A counter's decimals, when it counts with some. */
  decimals?: number
  /** A counter the clock gives: the story may test it, not change it. */
  clock?: boolean
}

export interface KnownDecision extends KnownDefinition {
  values: string[]
  usedValues?: string[]
}

/** Names the project already has, which an import may use without declaring them. */
export interface KnownNames {
  decisions: KnownDecision[]
  counters?: KnownDefinition[]
  /** Names the player gives, which `{Name}` shows. */
  askedNames?: string[]
  endings?: string[]
  memories?: string[]
  /** The project's styles; a name alone is declared elsewhere. */
  styles?: (string | KnownDefinition)[]
  /** Classes of the project's CSS: each is a style the text may use without declaring it. */
  styleClasses?: string[]
  /** The project's scenes, with the scenes each one plays: a scene playing itself, even through others, never ends. */
  scenes?: { name: string; plays: string[] }[]
}

const NO_KNOWN_NAMES: KnownNames = { decisions: [] }

/**
 * Checks the names an import uses: decisions and their values in choices, conditions, `[set]` and `[unset]`,
 * endings and memories in conditions, scenes in `[play]`. Names are compared ignoring case. A memory
 * or ending may be tested before the place that names it: the next playthrough is the point.
 * One named nowhere, in the import or the project, is a typo.
 *
 * A choice on a decision nobody declared declares it, with the values of its options: writers
 * only need `[decision: …]` to fix the values in advance. An `[add]` makes a counter the same way,
 * starting at 0. A counter takes numbers where a decision takes values: `[set: Trust = 3]`,
 * `Trust is 3`; no decision bears a counter's name.
 */
export function checkReferences(result: ImportResult, knownNames: KnownNames = NO_KNOWN_NAMES): ImportProblem[] {
  const problems: ImportProblem[] = []
  const decisionValues = new Map<string, Set<string>>()
  const declaredDecisions = new Set<string>()
  const endings = new Set((knownNames.endings ?? []).map(normalizeName))
  const memories = new Set((knownNames.memories ?? []).map(normalizeName))

  const declare = (name: string, values: string[]) => {
    decisionValues.set(normalizeName(name), new Set(values.map(normalizeName)))
    declaredDecisions.add(normalizeName(name))
  }
  const knownByName = new Map(knownNames.decisions.map(decision => [normalizeName(decision.name), decision]))
  for (const decision of knownNames.decisions) {
    if (decision.implicit === true) {
      decisionValues.set(normalizeName(decision.name), new Set(decision.values.map(normalizeName)))
    } else {
      declare(decision.name, decision.values)
    }
  }
  const declaredHere = new Set<string>()
  for (const decision of result.decisions) {
    const name = normalizeName(decision.name)
    const known = knownByName.get(name)
    if (declaredHere.has(name) || (known !== undefined && typeof known.declaredIn === 'string')) {
      problems.push({ severity: 'error', code: 'duplicateDecision', line: decision.sourceLine, subject: decision.name, ...(declaredHere.has(name) ? {} : { suggestion: known!.declaredIn! }) })
      continue
    }
    declaredHere.add(name)
    declare(decision.name, decision.values)
    const values = new Set(decision.values.map(normalizeName))
    for (const used of known?.usedValues ?? []) {
      if (!values.has(normalizeName(used))) {
        problems.push({ severity: 'error', code: 'decisionValueStillUsed', line: decision.sourceLine, subject: `${decision.name}: ${used}` })
      }
    }
  }

  const allNodes = [...result.chapters, ...result.scenes].flatMap(chapter => flattenNodes(chapter.nodes))
  const counters = checkCounters(result, allNodes, knownNames.counters ?? [], problems)
  for (const name of counters) {
    // A choice on a counter's name, or a declaration, would make it a decision as well.
    const clash = result.decisions.find(declaration => normalizeName(declaration.name) === name)
      ?? allNodes.find(node => node.type === 'choice' && normalizeName(node.decision) === name)
    if (clash !== undefined || knownByName.has(name)) {
      const written = firstCounterWritten(result, allNodes, name)
      problems.push({ severity: 'error', code: 'counterNamedLikeDecision', line: clash?.sourceLine ?? written?.line ?? 1, subject: written?.name ?? name })
    }
  }
  // The clock's counters, for names no decision and no counter of the story bears: tested and shown,
  // never changed but by the clock.
  const decisionNames = new Set([...knownByName.keys(), ...result.decisions.map(declaration => normalizeName(declaration.name)), ...allNodes.flatMap(node => node.type === 'choice' ? [normalizeName(node.decision)] : [])])
  const ownCounters = new Set([...result.counters.map(declaration => normalizeName(declaration.name)), ...(knownNames.counters ?? []).filter(counter => counter.clock !== true).map(counter => normalizeName(counter.name))])
  for (const clock of CLOCK_COUNTERS) {
    const name = normalizeName(clock.name)
    if (decisionNames.has(name) || ownCounters.has(name)) {
      continue
    }
    counters.add(name)
    for (const node of allNodes) {
      const changed = node.type === 'add' || node.type === 'askNumber' ? node.counter : node.type === 'set' ? node.decision : null
      if (changed !== null && normalizeName(changed) === name) {
        problems.push({ severity: 'error', code: 'clockReadOnly', line: node.sourceLine, subject: changed })
      }
    }
  }
  // A tag showing a picture may name it by a decision's value, `[card1: {Drawn}]`; no other tag can.
  for (const node of allNodes) {
    const directives = node.type === 'page' ? [...node.directivesBefore, ...node.inlineDirectives] : node.type === 'stage' ? node.directives : []
    for (const directive of directives) {
      for (const [, braced] of directive.arguments.join(' ').matchAll(/\{([^{}]+)\}/g)) {
        const name = braced!.trim()
        const showsPicture = PICTURE_TAGS.has(directive.name) || !STAGE_KEYWORDS.includes(directive.name)
        if (!showsPicture) {
          problems.push({ severity: 'error', code: 'tagValueNotHere', line: node.sourceLine, subject: `${directive.name}: {${name}}` })
        } else if (counters.has(normalizeName(name))) {
          problems.push({ severity: 'error', code: 'tagValueNeedsDecision', line: node.sourceLine, subject: name })
        } else if (!decisionValues.has(normalizeName(name))) {
          problems.push({ severity: 'error', code: 'unknownDecision', line: node.sourceLine, subject: name })
        }
      }
    }
  }
  problems.push(...checkScenes(result, knownNames.scenes ?? []))
  problems.push(...checkStyles(result, allNodes, knownNames.styles ?? [], knownNames.styleClasses ?? []))

  for (const node of allNodes) {
    if (node.type === 'choice') {
      const decisionName = normalizeName(node.decision)
      if (declaredDecisions.has(decisionName)) {
        for (const option of node.options) {
          if (!decisionValues.get(decisionName)?.has(normalizeName(option.value))) {
            problems.push({ severity: 'error', code: 'unknownDecisionValue', line: option.sourceLine, subject: `${node.decision}: ${option.value}` })
          }
        }
      } else {
        const values = decisionValues.get(decisionName) ?? new Set<string>()
        node.options.forEach(option => values.add(normalizeName(option.value)))
        decisionValues.set(decisionName, values)
      }
    }
    if (node.type === 'ending') {
      endings.add(normalizeName(node.name))
    }
    if (node.type === 'remember' && node.forget !== true) {
      memories.add(normalizeName(node.name))
    }
  }

  const checkValue = (decision: string, value: string, line: number) => {
    const values = decisionValues.get(normalizeName(decision))
    if (values === undefined) {
      problems.push({ severity: 'error', code: 'unknownDecision', line, subject: decision })
    } else if (!values.has(normalizeName(value))) {
      problems.push({ severity: 'error', code: 'unknownDecisionValue', line, subject: `${decision}: ${value}` })
    }
  }

  /** The decimals each counter keeps, by name normalised: as declared here, or as the project has it. */
  const decimalsByCounter = new Map([
    ...(knownNames.counters ?? []).map(counter => [normalizeName(counter.name), counter.decimals ?? 0] as const),
    ...result.counters.map(declaration => [normalizeName(declaration.name), declaration.decimals] as const),
  ])
  // A counter an `[ask number]` makes keeps the decimals of the number it proposes.
  for (const node of allNodes) {
    if (node.type === 'askNumber' && !decimalsByCounter.has(normalizeName(node.counter))) {
      decimalsByCounter.set(normalizeName(node.counter), node.decimals)
    }
  }
  /** A number with more decimals than its counter keeps: `0.5` for a counter of whole numbers. */
  const checkPrecision = (name: string, decimals: number, written: string, line: number) => {
    const kept = decimalsByCounter.get(normalizeName(name)) ?? 0
    if (decimals > kept) {
      problems.push({ severity: 'error', code: 'counterTooPrecise', line, subject: `${name}: ${written}`, suggestion: String(kept) })
    }
  }
  /** A counter takes a number where a decision takes one of its values. */
  const checkCounterValue = (name: string, value: string, line: number, mayDraw = false) => {
    const draw = mayDraw ? readRandom(value) : null
    if (readAmount(value) === null && draw === null) {
      problems.push({ severity: 'error', code: 'counterNeedsNumber', line, subject: `${name}: ${value}` })
    } else {
      checkPrecision(name, draw === null ? decimalsWritten(value) : Math.max(decimalsOf(draw.minimum), decimalsOf(draw.maximum)), value, line)
    }
  }
  const isCounter = (name: string) => counters.has(normalizeName(name))

  const checkCondition = (condition: Condition | null | undefined, line: number) => {
    for (const part of partsOf(condition ?? null)) {
      if (part.type === 'is' && isCounter(part.decision)) {
        checkCounterValue(part.decision, part.value, line)
      } else if (part.type === 'is') {
        checkValue(part.decision, part.value, line)
      } else if (part.type === 'compare' && !isCounter(part.counter)) {
        problems.push({ severity: 'error', code: 'unknownCounter', line, subject: part.counter })
      } else if (part.type === 'compare') {
        checkPrecision(part.counter, decimalsOf(part.amount), String(part.amount), line)
      } else if (part.type === 'remembered' && !memories.has(normalizeName(part.memory))) {
        problems.push({ severity: 'error', code: 'unknownMemory', line, subject: part.memory })
      } else if (part.type === 'endingSeen' && !endings.has(normalizeName(part.ending))) {
        problems.push({ severity: 'error', code: 'unknownEnding', line, subject: part.ending })
      }
    }
  }

  for (const chapter of result.chapters) {
    checkCondition(chapter.condition, chapter.sourceLine + 1)
  }
  for (const node of allNodes) {
    if (node.type === 'condition') {
      node.branches.forEach(branch => checkCondition(branch.condition, branch.sourceLine))
    }
    if (node.type === 'choice') {
      node.options.forEach(option => checkCondition(option.condition, option.sourceLine))
    }
    if (node.type === 'set') {
      const draw = isCounter(node.decision) ? null : readDraw(node.value)
      const copied = isCounter(node.decision) ? null : valueNamedIn(node.value)
      if (copied !== null) {
        // A value named like another decision's: both must be decisions.
        for (const named of [node.decision, copied]) {
          if (!decisionValues.has(normalizeName(named))) {
            problems.push({ severity: 'error', code: isCounter(named) ? 'tagValueNeedsDecision' : 'unknownDecision', line: node.sourceLine, subject: named })
          }
        }
      } else if (isCounter(node.decision)) {
        checkCounterValue(node.decision, node.value, node.sourceLine, true)
      } else if (draw !== null) {
        // A value drawn at random: the decision, and the one whose values are left out, must be known.
        for (const named of [node.decision, ...(draw.notIn === null ? [] : [draw.notIn])]) {
          if (!decisionValues.has(normalizeName(named))) {
            problems.push({ severity: 'error', code: 'unknownDecision', line: node.sourceLine, subject: named })
          }
        }
      } else {
        checkValue(node.decision, node.value, node.sourceLine)
      }
    }
    if (node.type === 'add') {
      checkPrecision(node.counter, decimalsOf(node.amount), String(node.amount), node.sourceLine)
    }
    if (node.type === 'askNumber') {
      checkPrecision(node.counter, decimalsOf(node.defaultAmount), String(node.defaultAmount), node.sourceLine)
      for (const bound of [node.minimum, node.maximum]) {
        if (bound?.type === 'amount') {
          checkPrecision(node.counter, decimalsOf(bound.amount), String(bound.amount), node.sourceLine)
        } else if (bound?.type === 'counter' && !isCounter(bound.counter)) {
          problems.push({ severity: 'error', code: 'unknownCounter', line: node.sourceLine, subject: bound.counter })
        }
      }
    }
    if (node.type === 'unset') {
      if (isCounter(node.decision)) {
        problems.push({ severity: 'error', code: 'unsetCounter', line: node.sourceLine, subject: node.decision })
      } else if (node.value !== null) {
        checkValue(node.decision, node.value, node.sourceLine)
      } else if (!decisionValues.has(normalizeName(node.decision))) {
        problems.push({ severity: 'error', code: 'unknownDecision', line: node.sourceLine, subject: node.decision })
      }
    }
    // A memory forgotten that nothing remembers is most likely misspelled, as one tested would be.
    if (node.type === 'remember' && node.forget === true && !memories.has(normalizeName(node.name))) {
      problems.push({ severity: 'error', code: 'unknownMemory', line: node.sourceLine, subject: node.name })
    }
  }

  // `[shown]` names decisions and counters, or the endings reached.
  for (const declaration of result.shown) {
    for (const name of declaration.names) {
      const key = normalizeName(name)
      if (key !== ENDINGS_REACHED && !decisionValues.has(key) && !counters.has(key)) {
        problems.push({ severity: 'error', code: 'unknownShown', line: declaration.sourceLine, subject: name })
      }
    }
  }
  problems.push(...checkPlaceholders(result, allNodes, knownNames.askedNames ?? [], new Set([...decisionValues.keys(), ...counters])))
  return problems.sort((first, second) => first.line - second.line)
}

/**
 * `{…}` in a page, a speaker or an option naming nothing the story keeps: no name asked for, no
 * counter, no decision. A name asked for that is also a counter's or a decision's is reported where
 * it is asked: `{…}` could not tell which is meant.
 */
function checkPlaceholders(result: ImportResult, allNodes: readonly StoryNode[], knownAskedNames: readonly string[], counterAndDecisionNames: ReadonlySet<string>): ImportProblem[] {
  const asks = allNodes.flatMap(node => node.type === 'ask' ? [node] : [])
  const asked = new Set([...knownAskedNames, ...asks.map(node => node.name)].map(normalizeName))
  const textsOf = (node: StoryNode): string[] => node.type === 'page' ? [node.text, node.speaker ?? ''] : node.type === 'choice' ? node.options.map(option => option.text) : []
  const unknown = allNodes.flatMap(node => [...new Set(textsOf(node).flatMap(placeholdersIn))]
    .filter(name => !asked.has(normalizeName(name)) && !counterAndDecisionNames.has(normalizeName(name)))
    .map((name): ImportProblem => ({ severity: 'error', code: 'unknownValue', line: node.sourceLine, subject: name })))
  const taken = asks.filter(node => counterAndDecisionNames.has(normalizeName(node.name)))
    .map((node): ImportProblem => ({ severity: 'error', code: 'askedNameTaken', line: node.sourceLine, subject: node.name }))
  // A counter or a decision this text makes, named as a name asked in another chapter.
  const askedElsewhere = new Set(knownAskedNames.map(normalizeName))
  const named = [
    ...result.decisions.map(declaration => ({ name: declaration.name, line: declaration.sourceLine })),
    ...result.counters.map(declaration => ({ name: declaration.name, line: declaration.sourceLine })),
    ...allNodes.flatMap(node => node.type === 'add' ? [{ name: node.counter, line: node.sourceLine }]
      : node.type === 'choice' || node.type === 'set' ? [{ name: node.decision, line: node.sourceLine }] : []),
  ]
  const reported = new Set<string>()
  const clashing = named.filter(entry => {
    const key = normalizeName(entry.name)
    const isNew = askedElsewhere.has(key) && !reported.has(key)
    reported.add(key)
    return isNew
  }).map((entry): ImportProblem => ({ severity: 'error', code: 'nameIsAsked', line: entry.line, subject: entry.name }))
  return [...unknown, ...taken, ...clashing]
}

/**
 * The names of every counter, normalised: the project's, those declared here and those an `[add]`
 * makes. A counter declared twice, or declared here while a chapter elsewhere declares it, is reported.
 */
function checkCounters(result: ImportResult, allNodes: readonly StoryNode[], knownCounters: readonly KnownDefinition[], problems: ImportProblem[]): Set<string> {
  const names = new Set(knownCounters.map(counter => normalizeName(counter.name)))
  const placeOf = new Map(knownCounters.flatMap(counter => typeof counter.declaredIn === 'string' ? [[normalizeName(counter.name), counter.declaredIn] as const] : []))
  const declaredHere = new Set<string>()
  for (const declaration of result.counters) {
    const name = normalizeName(declaration.name)
    if (declaredHere.has(name) || placeOf.has(name)) {
      const place = declaredHere.has(name) ? '' : placeOf.get(name) ?? ''
      problems.push({ severity: 'error', code: 'duplicateCounter', line: declaration.sourceLine, subject: declaration.name, ...(place === '' ? {} : { suggestion: place }) })
    }
    declaredHere.add(name)
    names.add(name)
  }
  for (const node of allNodes) {
    if (node.type === 'add' || node.type === 'askNumber') {
      names.add(normalizeName(node.counter))
    }
  }
  return names
}

/** Where a counter is first written in the import, its declaration or its first `[add]`, and its name there; undefined when only the project has it. */
function firstCounterWritten(result: ImportResult, allNodes: readonly StoryNode[], name: string): { line: number; name: string } | undefined {
  const declaration = result.counters.find(candidate => normalizeName(candidate.name) === name)
  if (declaration !== undefined) {
    return { line: declaration.sourceLine, name: declaration.name }
  }
  const addition = allNodes.find(node => node.type === 'add' && normalizeName(node.counter) === name)
  return addition?.type === 'add' ? { line: addition.sourceLine, name: addition.counter } : undefined
}

/** Styles declared twice, and styles used that are neither declared nor a property alone (`italic`). */
function checkStyles(result: ImportResult, allNodes: readonly StoryNode[], knownStyles: readonly (string | KnownDefinition)[], styleClasses: readonly string[]): ImportProblem[] {
  const classes = new Set(styleClasses)
  const problems: ImportProblem[] = []
  const known = knownStyles.map(style => typeof style === 'string' ? { name: style, declaredIn: '' } : style)
  const declared = new Set(known.map(style => normalizeName(style.name)))
  const placeOf = new Map(known.flatMap(style => typeof style.declaredIn === 'string' ? [[normalizeName(style.name), style.declaredIn] as const] : []))
  const declaredHere = new Set<string>()
  for (const declaration of result.styles) {
    const name = normalizeName(declaration.name)
    if (declaredHere.has(name) || placeOf.has(name)) {
      const place = declaredHere.has(name) ? '' : placeOf.get(name) ?? ''
      problems.push({ severity: 'error', code: 'duplicateStyle', line: declaration.sourceLine, subject: declaration.name, ...(place === '' ? {} : { suggestion: place }) })
    }
    declaredHere.add(name)
    declared.add(name)
  }
  for (const node of allNodes) {
    for (const span of node.type === 'page' ? node.styles ?? [] : []) {
      if (!declared.has(normalizeName(span.style)) && readStyleProperty(span.style) === null && !classes.has(styleClassName(span.style))) {
        problems.push({ severity: 'error', code: 'unknownStyle', line: node.sourceLine, subject: span.style })
      }
    }
  }
  return problems
}

/** Scenes named twice, plays of scenes that exist nowhere, and scenes that would play themselves. */
function checkScenes(result: ImportResult, knownScenes: readonly { name: string; plays: string[] }[]): ImportProblem[] {
  const problems: ImportProblem[] = []
  const playsOf = (scene: ImportedChapter) => flattenNodes(scene.nodes).flatMap(node => node.type === 'play' ? [node] : [])
  // Scenes the import writes replace those of the project bearing their name.
  const playsByScene = new Map(knownScenes.map(scene => [normalizeName(scene.name), scene.plays.map(normalizeName)]))
  const written: ImportedChapter[] = []
  for (const scene of result.scenes) {
    const name = normalizeName(scene.title ?? '')
    if (name === '') {
      continue
    }
    if (written.some(other => normalizeName(other.title ?? '') === name)) {
      problems.push({ severity: 'error', code: 'duplicateScene', line: scene.sourceLine, subject: scene.title ?? '' })
      continue
    }
    written.push(scene)
    playsByScene.set(name, playsOf(scene).map(play => normalizeName(play.scene)))
  }

  const reaches = (from: string, target: string, seen: Set<string>): boolean => {
    if (from === target) {
      return true
    }
    if (seen.has(from)) {
      return false
    }
    seen.add(from)
    return (playsByScene.get(from) ?? []).some(next => reaches(next, target, seen))
  }
  for (const scene of written) {
    for (const play of playsOf(scene)) {
      if (reaches(normalizeName(play.scene), normalizeName(scene.title ?? ''), new Set())) {
        problems.push({ severity: 'error', code: 'sceneCallsItself', line: play.sourceLine, subject: play.scene })
      }
    }
  }
  for (const play of [...result.chapters, ...result.scenes].flatMap(playsOf)) {
    if (!playsByScene.has(normalizeName(play.scene))) {
      problems.push({ severity: 'error', code: 'unknownScene', line: play.sourceLine, subject: play.scene })
    }
  }
  return problems
}

type ConditionPart = Extract<Condition, { type: 'is' | 'compare' | 'remembered' | 'endingSeen' }>

function partsOf(condition: Condition | null): ConditionPart[] {
  if (condition === null || condition.type === 'invalid') {
    return []
  }
  return 'conditions' in condition ? condition.conditions.flatMap(partsOf) : [condition]
}
