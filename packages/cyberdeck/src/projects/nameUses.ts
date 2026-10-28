import type { IndexedName, NameUse, NameWarning, ProjectDocument, UseRole } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'
import { indexMessages, type UseGroup } from '../i18n/indexMessages'

/** How the uses of a name read in a list: `declared · given Accept, Refuse · tested Accept`. */
const USE_GROUPS: Readonly<Record<UseRole, UseGroup>> = {
  declared: 'declared',
  chosen: 'given',
  set: 'given',
  unset: 'emptied',
  changed: 'changed',
  tested: 'tested',
  remembered: 'remembered',
  reached: 'reached',
  used: 'used',
  played: 'played',
}
const GROUP_ORDER: readonly UseGroup[] = ['declared', 'given', 'emptied', 'changed', 'tested', 'remembered', 'reached', 'used', 'played']

/** The uses grouped by what they do, each with the values concerned, in a fixed order. */
export function summariseUses(name: IndexedName, uses: readonly NameUse[], project: ProjectDocument, locale: Locale = 'en'): string {
  const text = indexMessages[locale]
  const values = name.kind === 'decision' ? project.decisions.find(decision => decision.id === name.id)?.values ?? [] : []
  const groups = new Map<UseGroup, Set<string>>()
  for (const entry of uses) {
    const group = USE_GROUPS[entry.role]
    const groupValues = groups.get(group) ?? new Set<string>()
    const value = entry.valueId === undefined ? undefined : values.find(candidate => candidate.id === entry.valueId)?.name
    if (value !== undefined) {
      groupValues.add(value)
    }
    groups.set(group, groupValues)
  }
  return GROUP_ORDER.filter(group => groups.has(group)).map(group => {
    const word = text.useWord(group, name.kind)
    const groupValues = [...groups.get(group)!]
    return groupValues.length === 0 ? word : `${word} ${groupValues.join(', ')}`
  }).join(' · ')
}

/** What a use is, in the Index's list of places: `given Accept by a choice`, `tested Key`. */
export function describeUse(entry: NameUse, project: ProjectDocument, name: IndexedName, locale: Locale = 'en'): string {
  const text = indexMessages[locale]
  const decisionId = name.kind === 'decision' ? name.id : null
  const value = entry.valueId === undefined || decisionId === null
    ? null
    : project.decisions.find(decision => decision.id === decisionId)?.values.find(candidate => candidate.id === entry.valueId)?.name ?? null
  const word = text.useWord(USE_GROUPS[entry.role], name.kind)
  const withValue = value === null ? word : `${word} ${value}`
  switch (entry.role) {
    case 'chosen':
      return text.byChoice(withValue)
    case 'set':
      return text.bySet(withValue)
    case 'unset':
      return value === null ? word : text.takenAway(value)
    case 'tested':
      return entry.nodeId === null ? text.byChapter(withValue) : withValue
    default:
      return word
  }
}

export function warningMessage(warning: NameWarning, locale: Locale = 'en'): string {
  return indexMessages[locale].warning(warning)
}
