import type { NameKind, NameWarning } from '@cyberdeck/core'

/** What a place does with a name, grouped as the Index lists them. */
export type UseGroup = 'declared' | 'given' | 'emptied' | 'changed' | 'tested' | 'shown' | 'remembered' | 'forgotten' | 'reached' | 'used' | 'played'

/** The Index, and how the uses of names read wherever they are listed. */
const en = {
  kindLabels: { decision: 'Decision', counter: 'Counter', memory: 'Memory', ending: 'Ending', style: 'Style', scene: 'Scene' } satisfies Record<NameKind, string>,
  /** `declared`, `given`: said of a name of the kind. */
  useWord: (group: UseGroup, _kind: NameKind): string => group,
  byChoice: (given: string) => `${given} by a choice`,
  bySet: (given: string) => `${given} by [set]`,
  byChapter: (tested: string) => `${tested} by the chapter`,
  takenAway: (value: string) => `${value} taken away`,
  /** What looks forgotten, why it matters, and what to do. */
  warning: (warning: NameWarning): string => {
    switch (warning.code) {
      case 'declaredNeverUsed':
        return warning.name.kind === 'counter'
          ? 'declared, but nothing changes it or tests it. Change it with an [add] and test it in an [if], or take its declaration out.'
          : 'declared, but nothing gives it a value or tests it. Use it in a choice and an [if], or take its declaration out.'
      case 'testedNeverGiven':
        return 'tested, but no choice or [set] gives it a value: those conditions never hold. Give it one, or check how the tests spell it.'
      case 'valueTestedNeverGiven':
        return `${warning.valueName} is tested, but no choice or [set] gives it: those conditions never hold. Add an option with that value, or check its spelling.`
      case 'givenNeverTested':
        return 'given a value, but never tested nor shown: it changes nothing yet. Test it in an [if] where it should matter, or show it in the text with {…}.'
      case 'valueGivenNeverTested':
        return `${warning.valueName} is given, but nothing tests it, not even an [else] after a test of this decision, so it changes nothing yet. Test it where it should matter. A value left over from an option since renamed goes away by itself once nothing gives it.`
      case 'counterTestedNeverChanged':
        return 'tested, but no [add] or [set] changes it: it always holds its first value. Change it with an [add] or a [set] where it should change.'
      case 'counterChangedNeverTested':
        return 'counted, but never tested nor shown: it changes nothing yet. Test it in an [if], Trust >= 3 for instance, or show it in the text, {Trust}.'
      case 'memoryTestedNeverRemembered':
        return 'tested, but never remembered: those conditions never hold. Add [remember: …] where the player learns it.'
      case 'memoryNeverTested':
        return 'remembered, but never tested: it changes nothing yet. Test it with [if: remembered …] in a later playthrough.'
      case 'endingNeverReached':
        return 'no path reaches it: every way to it ends earlier. Move it where a path leads, or look at what ends before it.'
      case 'styleNeverUsed':
        return 'declared, but no page uses it. Use it with [style: …], or take its declaration out.'
      case 'sceneNeverPlayed':
        return 'no path plays it. Add [play: …] where it should be played.'
    }
  },
  intro: 'Every decision, counter and memory of the story, with each place that declares, gives, changes, tests or shows it. Above them, what looks forgotten across the whole story, as a code editor would point it out: first what changes how the story plays, then what is only unused.',
  /** Where a card is in its chapter. */
  toLookAt: 'To look at',
  nothingToLookAt: 'Nothing. Checked: every decision and counter is given and tested, every value given is tested or taken by an [else], every memory is remembered and tested, every ending reached and every scene played.',
  allKinds: 'All',
  showOnly: 'Show',
  find: 'Find a decision, a counter or a memory',
  findPlaceholder: 'Part of its name, or of a value',
  byValue: (value: string) => ` · value ${value}`,
  decisions: 'Decisions',
  counters: 'Counters',
  memories: 'Memories',
  noneYet: (_kind: NameKind) => 'None yet.',
  noneOfThatName: (_kind: NameKind) => 'None of that name.',
  several: ' (several)',
  placeCount: (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`,
  usedNowhere: (_kind: NameKind) => 'used nowhere',
  declaredIn: (place: string, _kind: NameKind) => `declared in ${place}`,
  declaredInDefinitions: (_kind: NameKind) => 'declared in Definitions',
  madeByChoices: 'made by its choices',
  madeByAdd: 'made by its [add]',
  startsAt: (amount: string) => `starts at ${amount}`,
  shownToPlayers: 'In the players’ journal',
  shownNever: 'never',
  shownAlways: 'always',
  shownAfterAnEnding: 'after a first ending',
  shownHelp: 'What players see in their journal: a decision while it holds a value, a counter with its number. Its name and values appear as written here, in every language. Written as [shown: …] among the definitions.',
  endingsInJournal: 'The endings reached, in the players’ journal',
}

type IndexMessages = typeof en

/** Decisions, endings and scenes are feminine; counters, memories and styles masculine. */
const isFeminine = (kind: NameKind) => kind === 'decision' || kind === 'ending' || kind === 'scene'
const agreed = (masculine: string, kind: NameKind) => isFeminine(kind) ? `${masculine}e` : masculine

const FRENCH_USE_WORDS: Readonly<Record<UseGroup, string>> = {
  declared: 'déclaré',
  given: 'donné',
  emptied: 'vidé',
  changed: 'modifié',
  tested: 'testé',
  shown: 'affiché',
  remembered: 'mémorisé',
  forgotten: 'oublié',
  reached: 'atteint',
  used: 'utilisé',
  played: 'joué',
}

const fr: IndexMessages = {
  kindLabels: { decision: 'Décision', counter: 'Compteur', memory: 'Souvenir', ending: 'Fin', style: 'Style', scene: 'Scène' },
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
        return kind === 'counter'
          ? 'déclaré, mais rien ne le modifie ni ne le teste. Modifiez-le avec un [add] et testez-le dans un [if], ou retirez sa déclaration.'
          : `${agreed('déclaré', kind)}, mais rien ne lui donne de valeur ni ne ${pronoun} teste. Utilisez-${pronoun} dans un choix et un [if], ou retirez sa déclaration.`
      case 'testedNeverGiven':
        return `${agreed('testé', kind)}, mais aucun choix ni [set] ne lui donne de valeur\u00a0: ces conditions ne sont donc jamais remplies. Donnez-lui une valeur, ou vérifiez son orthographe dans les tests.`
      case 'valueTestedNeverGiven':
        return `${warning.valueName} est testée, mais aucun choix ni [set] ne la donne\u00a0: ces conditions ne sont donc jamais remplies. Ajoutez une option avec cette valeur, ou vérifiez son orthographe.`
      case 'givenNeverTested':
        return `reçoit une valeur, mais n’est jamais ${agreed('testé', kind)} ni ${agreed('affiché', kind)}\u00a0: ${isFeminine(kind) ? 'elle' : 'il'} ne change donc rien pour l’instant. Testez-${pronoun} dans un [if] là où ${isFeminine(kind) ? 'elle' : 'il'} doit jouer un rôle, ou affichez-${pronoun} dans le texte avec {…}.`
      case 'valueGivenNeverTested':
        return `${warning.valueName} est donnée, mais rien ne la teste, pas même un [else] après un test de cette décision\u00a0: elle ne change donc rien pour l’instant. Testez-la là où elle doit jouer un rôle. Si c’est une valeur restée d’une option renommée depuis, elle disparaîtra d’elle-même quand plus rien ne la donnera.`
      case 'counterTestedNeverChanged':
        return 'testé, mais aucun [add] ni [set] ne le modifie\u00a0: il garde toujours sa valeur de départ. Modifiez-le avec un [add] ou un [set] là où il doit évoluer.'
      case 'counterChangedNeverTested':
        return 'modifié, mais jamais testé ni affiché : il ne change rien pour l’instant. Testez-le dans un [if], Confiance >= 3 par exemple, ou affichez-le dans le texte, {Confiance}.'
      case 'memoryTestedNeverRemembered':
        return 'testé, mais jamais mémorisé\u00a0: ces conditions ne sont donc jamais remplies. Ajoutez [remember: …] là où le joueur découvre l’information.'
      case 'memoryNeverTested':
        return 'mémorisé, mais jamais testé\u00a0: il ne change rien pour l’instant. Testez-le avec [if: remembered …] dans les parties suivantes.'
      case 'endingNeverReached':
        return 'aucun parcours n’y mène, car tous s’arrêtent avant. Déplacez-la sur un parcours existant, ou examinez ce qui se termine avant elle.'
      case 'styleNeverUsed':
        return 'déclaré, mais aucune page ne l’utilise. Utilisez-le avec [style: …], ou retirez sa déclaration.'
      case 'sceneNeverPlayed':
        return 'aucun parcours ne la joue. Ajoutez [play: …] là où elle doit être jouée.'
    }
  },
  intro: 'Toutes les décisions, tous les compteurs et tous les souvenirs de l’histoire, avec les endroits qui les déclarent, leur donnent une valeur, les modifient, les testent ou les affichent. Au-dessus, ce qui semble oublié dans l’ensemble de l’histoire, signalé comme le ferait un éditeur de code\u00a0: d’abord ce qui change le déroulement de l’histoire, puis ce qui est simplement inutilisé.',
  toLookAt: 'À vérifier',
  nothingToLookAt: 'Rien à signaler. Vérifié\u00a0: chaque décision et chaque compteur reçoit une valeur et est testé, chaque valeur donnée est testée ou prise en compte par un [else], chaque souvenir est mémorisé et testé, chaque fin est atteinte et chaque scène est jouée.',
  allKinds: 'Tous',
  showOnly: 'Afficher',
  find: 'Chercher une décision, un compteur ou un souvenir',
  findPlaceholder: 'Une partie de son nom, ou d’une valeur',
  byValue: value => ` · valeur ${value}`,
  decisions: 'Décisions',
  counters: 'Compteurs',
  memories: 'Souvenirs',
  noneYet: kind => `${isFeminine(kind) ? 'Aucune' : 'Aucun'} pour l’instant.`,
  noneOfThatName: kind => `${isFeminine(kind) ? 'Aucune' : 'Aucun'} de ce nom.`,
  several: ' (plusieurs)',
  placeCount: count => `${count} ${count <= 1 ? 'endroit' : 'endroits'}`,
  usedNowhere: kind => `${agreed('utilisé', kind)} nulle part`,
  declaredIn: (place, kind) => `${agreed('déclaré', kind)} dans ${place}`,
  declaredInDefinitions: kind => `${agreed('déclaré', kind)} dans Définitions`,
  madeByChoices: 'créée par ses choix',
  madeByAdd: 'créé par ses [add]',
  startsAt: amount => `commence à ${amount}`,
  shownToPlayers: 'Dans le journal des joueurs',
  shownNever: 'jamais',
  shownAlways: 'toujours',
  shownAfterAnEnding: 'après une première fin',
  shownHelp: 'Dans leur journal, les joueurs voient une décision tant qu’elle a une valeur, et un compteur avec son nombre. Le nom et les valeurs y apparaissent tels qu’ils sont écrits ici, dans toutes les langues. Ce réglage s’écrit [shown: …] parmi les définitions.',
  endingsInJournal: 'Les fins atteintes, dans le journal des joueurs',
}

export const indexMessages = { en, fr }
