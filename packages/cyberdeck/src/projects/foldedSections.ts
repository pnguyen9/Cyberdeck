import { computed, ref, type Ref } from 'vue'

/**
 * Sections of a tab folded until opened, and a filter showing one kind alone. A kind filtered on
 * that disappears, its last entry removed, gives way to all of them again.
 */
export function useFoldedSections<Kind extends string>(kindsPresent: Readonly<Ref<readonly Kind[]>>) {
  const chosenKind = ref<Kind | 'all'>('all') as Ref<Kind | 'all'>
  const kindShown = computed(() => chosenKind.value === 'all' || kindsPresent.value.includes(chosenKind.value) ? chosenKind.value : 'all')
  const openSections = ref(new Set<Kind>()) as Ref<Set<Kind>>

  function toggleSection(kind: Kind, isOpen: boolean) {
    const kinds = new Set(openSections.value)
    if (isOpen) {
      kinds.add(kind)
    } else {
      kinds.delete(kind)
    }
    openSections.value = kinds
  }

  /** Shows one kind alone, its section opened, or every kind. */
  function showKind(kind: Kind | 'all') {
    chosenKind.value = kind
    if (kind !== 'all') {
      toggleSection(kind, true)
    }
  }

  const isShown = (kind: Kind) => kindsPresent.value.includes(kind) && (kindShown.value === 'all' || kindShown.value === kind)
  const isOpen = (kind: Kind) => openSections.value.has(kind)

  return { kindShown, showKind, isShown, isOpen, toggleSection, openSections }
}
