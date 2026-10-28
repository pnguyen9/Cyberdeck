/** The map of the routes explored. */
const en = {
  routesExplored: 'routes explored',
  endingsReached: (reached: number, total: number) => `Endings reached: ${reached} of ${total}`,
  nothingExplored: 'Nothing explored yet: the map fills in as you reach choices.',
  untitledChapter: 'Untitled chapter',
  playFromHere: 'Play from here',
  theEnd: 'The end',
}

type MapMessages = typeof en

const fr: MapMessages = {
  routesExplored: 'parcours explorés',
  endingsReached: (reached, total) => `Fins atteintes : ${reached} sur ${total}`,
  nothingExplored: 'Rien n’a encore été exploré : la carte se remplit à mesure que vous atteignez des choix.',
  untitledChapter: 'Chapitre sans titre',
  playFromHere: 'Jouer à partir d’ici',
  theEnd: 'Fin',
}

export const mapMessages = { en, fr }
