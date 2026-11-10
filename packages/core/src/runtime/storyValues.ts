import { shownAmount, wholeAmount } from '../format/counterNumbers'
import type { ProjectDocument } from '../format/storyFormat'
import type { ValueOf } from '../format/textValues'
import { normalizeName } from '../importer/storyNodes'
import type { CounterState, DecisionState, ListState, NameState } from './storyRuntime'
import { listsOf, listPlaceSplitter } from '../format/lists'

/** What a playthrough holds: the values of its decisions, its counters and the names given. */
export interface HeldValues {
  decisions: DecisionState
  counters: CounterState
  names: NameState
  lists?: ListState
}

/**
 * Reads what a playthrough holds as the text shows it, by name: the name the player gave (its
 * default, or its own name, until then), a counter's number, a decision's values joined by commas
 * (nothing until it holds one). The project's names are looked up once, the values at each reading.
 */
export function valuesReader(project: ProjectDocument): (held: HeldValues) => ValueOf {
  const askedByName = new Map(project.askedNames.map(asked => [normalizeName(asked.name), asked]))
  const countersByName = new Map(project.counters.map(counter => [normalizeName(counter.name), counter]))
  const decisionsByName = new Map(project.decisions.map(decision => [normalizeName(decision.name), decision]))
  const lists = listsOf(project)
  const listsByName = new Map(lists.map(list => [normalizeName(list.name), list]))
  const splitPlace = listPlaceSplitter(lists.map(list => list.name))
  return held => name => {
    // `{Board 3}`, `{Board Cell}`, `{Board size}`: a place of a list, or how many values it holds.
    const placed = splitPlace(name)
    if (placed !== null) {
      const list = listsByName.get(normalizeName(placed.list))!
      const items = held.lists !== undefined && Object.hasOwn(held.lists, list.id) ? held.lists[list.id] ?? [] : list.initial
      if (normalizeName(placed.place) === 'size') {
        return String(items.length)
      }
      const counter = countersByName.get(normalizeName(placed.place))
      const number = /^\d+$/.test(placed.place) ? Number(placed.place)
        : counter === undefined ? Number.NaN : wholeAmount(Object.hasOwn(held.counters, counter.id) ? held.counters[counter.id] ?? 0 : counter.initial, counter)
      return items[number - 1] ?? ''
    }
    const key = normalizeName(name)
    const asked = askedByName.get(key)
    if (asked !== undefined) {
      return (Object.hasOwn(held.names, asked.id) ? held.names[asked.id] : undefined) || asked.defaultName || asked.name
    }
    const counter = countersByName.get(key)
    if (counter !== undefined) {
      return shownAmount(Object.hasOwn(held.counters, counter.id) ? held.counters[counter.id] ?? 0 : counter.initial, counter, project.locale)
    }
    const decision = decisionsByName.get(key)
    if (decision === undefined) {
      return undefined
    }
    const valueIds = Object.hasOwn(held.decisions, decision.id) ? held.decisions[decision.id] ?? [] : []
    return valueIds.map(valueId => decision.values.find(value => value.id === valueId)?.name ?? '').join(', ')
  }
}
