import { styleClassName } from '../format/authorCss'
import { readStyleProperty } from '../format/textStyles'
import type { Condition, ImportedChapter, ImportProblem, ImportResult, StoryNode } from './importTypes'
import { readAmount } from './readControl'
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
}

export interface KnownDecision extends KnownDefinition {
  values: string[]
  usedValues?: string[]
}

/** Names the project already has, which an import may use without declaring them. */
export interface KnownNames {
  decisions: KnownDecision[]
  counters?: KnownDefinition[]
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
    if (node.type === 'remember') {
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

  /** A counter takes a number where a decision takes one of its values. */
  const checkCounterValue = (name: string, value: string, line: number) => {
    if (readAmount(value) === null) {
      problems.push({ severity: 'error', code: 'counterNeedsNumber', line, subject: `${name}: ${value}` })
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
      if (isCounter(node.decision)) {
        checkCounterValue(node.decision, node.value, node.sourceLine)
      } else {
        checkValue(node.decision, node.value, node.sourceLine)
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
  }

  return problems.sort((first, second) => first.line - second.line)
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
    if (node.type === 'add') {
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
