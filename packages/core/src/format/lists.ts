import { normalizeName } from '../importer/storyNodes'
import type { ListPlace, ListValue, ProjectDocument, StoryList } from './storyFormat'

/**
 * Lists, `[list: Board = 16 × none]`: a place is written after the list's name, a number or a
 * counter's name, `Board 3`, `Board Cell`; `Board size` is how many values it holds.
 */

/** The project's lists; none before 3.0. */
export function listsOf(project: ProjectDocument): readonly StoryList[] {
  return project.lists ?? []
}

/** `16 × none` (or `x`, `*`), `cat | dog | cat`, or nothing: what a list holds at first. Null for anything else. */
export function readListItems(text: string): string[] | null {
  const trimmed = text.trim()
  if (trimmed === '') {
    return []
  }
  const repeated = /^(\d{1,4})\s*[×x*]\s*(\S.*)$/i.exec(trimmed)
  if (repeated !== null) {
    const count = Number(repeated[1])
    return count > 0 && count <= 2000 ? Array.from({ length: count }, () => repeated[2]!.trim()) : null
  }
  const items = trimmed.split('|').map(item => item.trim())
  return items.some(item => item === '') ? null : items
}

/** A name written with a place, `Board Cell`, `Board 3`, `Board size`, split by the lists known: the list, and what follows. */
export function splitListPlace(written: string, listNames: readonly string[]): { list: string; place: string } | null {
  const normalized = normalizeName(written)
  // The longest list name first: `Board` must not take what `Board game` would.
  for (const name of [...listNames].sort((first, second) => second.length - first.length)) {
    const key = normalizeName(name)
    if (normalized.startsWith(`${key} `) && normalized.length > key.length + 1) {
      return { list: name, place: written.trim().slice(written.trim().length - (normalized.length - key.length - 1)).trim() }
    }
  }
  return null
}

/** A place as a tag writes it: `3`, or a counter's name. */
export function listPlaceText(place: ListPlace, project: ProjectDocument): string {
  return place.type === 'number' ? String(place.number) : project.counters.find(counter => counter.id === place.counterId)?.name ?? '?'
}

/** A value as a tag writes it: `cat`, `{Animal}`, `{Board 3}`. */
export function listValueText(value: ListValue, project: ProjectDocument): string {
  switch (value.type) {
    case 'text':
      return value.text
    case 'decision':
      return `{${project.decisions.find(decision => decision.id === value.decisionId)?.name ?? '?'}}`
    case 'counter':
      return `{${project.counters.find(counter => counter.id === value.counterId)?.name ?? '?'}}`
    case 'item':
      return `{${listName(value.listId, project)} ${listPlaceText(value.place, project)}}`
  }
}

export function listName(listId: string, project: ProjectDocument): string {
  return listsOf(project).find(list => list.id === listId)?.name ?? '?'
}

/** The decisions, counters and lists a place or a value reads. */
export function idsReadBy(place: ListPlace | null, value: ListValue | null): string[] {
  const fromPlace = (read: ListPlace | null) => read?.type === 'counter' ? [read.counterId] : []
  const fromValue = (read: ListValue | null): string[] => read === null ? []
    : read.type === 'decision' ? [read.decisionId]
      : read.type === 'counter' ? [read.counterId]
        : read.type === 'item' ? [read.listId, ...fromPlace(read.place)] : []
  return [...fromPlace(place), ...fromValue(value)]
}
