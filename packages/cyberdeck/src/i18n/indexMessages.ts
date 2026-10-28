import type { NameKind, NameWarning } from '@cyberdeck/core'

/** What a place does with a name, grouped as the Index lists them. */
export type UseGroup = 'declared' | 'given' | 'emptied' | 'tested' | 'remembered' | 'reached' | 'used' | 'played'

/** The Index, and how the uses of names read wherever they are listed. */
const en = {
  kindLabels: { decision: 'Decision', memory: 'Memory', ending: 'Ending', style: 'Style', scene: 'Scene' } satisfies Record<NameKind, string>,
  /** `declared`, `given`: said of a name of the kind. */
  useWord: (group: UseGroup, _kind: NameKind): string => group,
  byChoice: (given: string) => `${given} by a choice`,
  bySet: (given: string) => `${given} by [set]`,
  byChapter: (tested: string) => `${tested} by the chapter`,
  takenAway: (value: string) => `${value} taken away`,
  warning: (warning: NameWarning): string => {
    switch (warning.code) {
      case 'declaredNeverUsed':
        return 'declared, but nothing gives it a value or tests it.'
      case 'testedNeverGiven':
        return 'tested, but no choice or [set] gives it a value: those conditions never hold.'
      case 'valueTestedNeverGiven':
        return `${warning.valueName} is tested, but no choice or [set] gives it: those conditions never hold.`
      case 'givenNeverTested':
        return 'given a value, but never tested: it changes nothing yet.'
      case 'memoryTestedNeverRemembered':
        return 'tested, but never remembered: those conditions never hold.'
      case 'memoryNeverTested':
        return 'remembered, but never tested.'
      case 'endingNeverReached':
        return 'no path reaches it.'
      case 'styleNeverUsed':
        return 'declared, but no page uses it.'
      case 'sceneNeverPlayed':
        return 'no path plays it.'
    }
  },
  /** Where a card is in its chapter. */
  toLookAt: 'To look at',
  nothingToLookAt: 'Nothing: every decision is given and tested, every ending reached, every scene played.',
  find: 'Find a decision or a memory',
  findPlaceholder: 'Part of its name',
  decisions: 'Decisions',
  memories: 'Memories',
  noneYet: (_kind: NameKind) => 'None yet.',
  noneOfThatName: (_kind: NameKind) => 'None of that name.',
  several: ' (several)',
  placeCount: (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`,
  usedNowhere: (_kind: NameKind) => 'used nowhere',
  declaredIn: (place: string) => `declared in ${place}`,
  declaredInDefinitions: 'declared in Definitions',
  madeByChoices: 'made by its choices',
}

type IndexMessages = typeof en

/** Decisions, endings and scenes are feminine; memories and styles masculine. */
const isFeminine = (kind: NameKind) => kind === 'decision' || kind === 'ending' || kind === 'scene'
const agreed = (masculine: string, kind: NameKind) => isFeminine(kind) ? `${masculine}e` : masculine

const FRENCH_USE_WORDS: Readonly<Record<UseGroup, string>> = {
  declared: 'déclaré',
  given: 'donné',
  emptied: 'vidé',
  tested: 'testé',
  remembered: 'retenu',
  reached: 'atteint',
  used: 'utilisé',
  played: 'joué',
}

const fr: IndexMessages = {
  kindLabels: { decision: 'Décision', memory: 'Souvenir', ending: 'Fin', style: 'Style', scene: 'Scène' },
  useWord: (group, kind) => agreed(FRENCH_USE_WORDS[group], kind),
  byChoice: given => `${given} par un choix`,
  bySet: given => `${given} par [set]`,
  byChapter: tested => `${tested} par la condition du chapitre`,
  takenAway: value => `retrait de ${value}`,
  warning: warning => {
    const kind = warning.name.kind
    const pronoun = isFeminine(kind) ? 'la' : 'le'
    switch (warning.code) {
      case 'declaredNeverUsed':
        return `${agreed('déclaré', kind)}, mais rien ne lui donne de valeur ni ne ${pronoun} teste.`
      case 'testedNeverGiven':
        return `${agreed('testé', kind)}, mais aucun choix ni [set] ne lui donne de valeur : ces conditions ne sont jamais remplies.`
      case 'valueTestedNeverGiven':
        return `${warning.valueName} est testée, mais aucun choix ni [set] ne la donne : ces conditions ne sont jamais remplies.`
      case 'givenNeverTested':
        return `reçoit une valeur, mais n’est jamais ${agreed('testé', kind)} : ${isFeminine(kind) ? 'elle' : 'il'} ne change rien pour l’instant.`
      case 'memoryTestedNeverRemembered':
        return 'testé, mais jamais retenu : ces conditions ne sont jamais remplies.'
      case 'memoryNeverTested':
        return 'retenu, mais jamais testé.'
      case 'endingNeverReached':
        return 'aucun parcours n’y mène.'
      case 'styleNeverUsed':
        return 'déclaré, mais aucune page ne l’utilise.'
      case 'sceneNeverPlayed':
        return 'aucun parcours ne la joue.'
    }
  },
  toLookAt: 'À vérifier',
  nothingToLookAt: 'Rien : chaque décision reçoit une valeur et est testée, chaque fin est atteinte, chaque scène est jouée.',
  find: 'Chercher une décision ou un souvenir',
  findPlaceholder: 'Une partie de son nom',
  decisions: 'Décisions',
  memories: 'Souvenirs',
  noneYet: kind => `${isFeminine(kind) ? 'Aucune' : 'Aucun'} pour l’instant.`,
  noneOfThatName: kind => `${isFeminine(kind) ? 'Aucune' : 'Aucun'} de ce nom.`,
  several: ' (plusieurs)',
  placeCount: count => `${count} ${count <= 1 ? 'endroit' : 'endroits'}`,
  usedNowhere: kind => `${agreed('utilisé', kind)} nulle part`,
  declaredIn: place => `déclarée dans ${place}`,
  declaredInDefinitions: 'déclarée dans Définitions',
  madeByChoices: 'créée par ses choix',
}

export const indexMessages = { en, fr }
