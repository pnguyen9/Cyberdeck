/** The map of the routes explored. */
const en = {
  routesExplored: 'routes explored',
  everyPath: 'every path, explored from the story',
  partly: 'Explored in part: an ending or a choice missing may need values no path explored gathered.',
  endingsReached: (reached: number, total: number) => `Endings reached: ${reached} of ${total}`,
  nothingExplored: 'Nothing explored yet: the map fills in as you reach choices.',
  untitledChapter: 'Untitled chapter',
  playFromHere: 'Play from here',
  forwardOnly: 'The story only goes forward here',
  theEnd: 'The end',
}

type MapMessages = typeof en

const fr: MapMessages = {
  routesExplored: 'parcours explorés',
  everyPath: 'tous les parcours, explorés à partir de l’histoire',
  partly: 'Exploré en partie\u00a0: une fin ou un choix absent peut demander des valeurs qu’aucun parcours exploré n’a réunies.',
  endingsReached: (reached, total) => `Fins atteintes : ${reached} sur ${total}`,
  nothingExplored: 'Rien n’a encore été exploré : la carte se remplit à mesure que vous atteignez des choix.',
  untitledChapter: 'Chapitre sans titre',
  playFromHere: 'Jouer à partir d’ici',
  forwardOnly: 'Ici, l’histoire ne fait qu’avancer',
  theEnd: 'Fin',
}

export const mapMessages = { en, fr }
