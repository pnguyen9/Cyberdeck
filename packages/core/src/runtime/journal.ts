import type { ProjectDocument } from '../format/storyFormat'
import type { HeldValues } from './storyValues'

/** A decision or a counter as the journal shows it: a decision's values held, a counter's number. */
export interface JournalEntry {
  id: string
  name: string
  kind: 'decision' | 'counter'
  /** The values a decision holds, each an item; a counter's number alone. */
  items: string[]
}

export interface Journal {
  entries: JournalEntry[]
  /** The endings reached, when the author shows them; null otherwise. */
  endings: { reached: string[]; total: number } | null
}

/**
 * What the player may see of what they hold, as the author chose with `[shown]`: what is shown
 * always, and once the profile has reached any ending, what is shown after one. A decision shows
 * while it holds something, a bag its items until they are taken away; a counter its number.
 */
export function journalOf(project: ProjectDocument, held: HeldValues, endingIds: readonly string[]): Journal {
  const afterAnEnding = endingIds.length > 0
  const shownIds = [...project.shown.always, ...(afterAnEnding ? project.shown.afterAnEnding : [])]
  const decisions = new Map(project.decisions.map(decision => [decision.id, decision]))
  const counters = new Map(project.counters.map(counter => [counter.id, counter]))
  const entries = shownIds.flatMap((id): JournalEntry[] => {
    const decision = decisions.get(id)
    if (decision !== undefined) {
      const valueIds = Object.hasOwn(held.decisions, id) ? held.decisions[id] ?? [] : []
      const items = valueIds.flatMap(valueId => decision.values.find(value => value.id === valueId)?.name ?? [])
      return items.length === 0 ? [] : [{ id, name: decision.name, kind: 'decision', items }]
    }
    const counter = counters.get(id)
    if (counter !== undefined) {
      const count = Object.hasOwn(held.counters, id) ? held.counters[id] ?? 0 : counter.initial
      return [{ id, name: counter.name, kind: 'counter', items: [String(count)] }]
    }
    return []
  })
  const showsEndings = project.shown.endings === 'always' || (project.shown.endings === 'afterAnEnding' && afterAnEnding)
  const named = project.endings.filter(ending => endingIds.includes(ending.id)).map(ending => ending.name)
  return { entries, endings: showsEndings ? { reached: named, total: project.endings.length } : null }
}

/** Whether the story shows players anything at all, now: otherwise the menu offers no journal. */
export function hasJournal(project: ProjectDocument, endingIds: readonly string[]): boolean {
  const { always, afterAnEnding, endings } = project.shown
  return always.length > 0 || endings === 'always' || (endingIds.length > 0 && (afterAnEnding.length > 0 || endings === 'afterAnEnding'))
}
