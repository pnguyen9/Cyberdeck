/** The map of the routes explored. */
const en = {
  routesExplored: 'routes explored',
  everyPath: 'every path, explored from the story',
  partly: 'Explored in part: some choices or endings are not on the map, past a grid of picture buttons, or opened by values no path explored gathered.',
  endingsReached: (reached: number, total: number) => `Endings reached: ${reached} of ${total}`,
  nothingExplored: 'Nothing explored yet: the map fills in as you reach choices.',
  untitledChapter: 'Untitled chapter',
  playFromHere: 'Play from here',
  playOption: (option: string) => `Play from a path where “${option}” is offered: here, other values close it`,
  forwardOnly: 'The story only goes forward here',
  theEnd: 'The end',
}

type MapMessages = typeof en

const fr: MapMessages = {
  routesExplored: 'parcours explorés',
  everyPath: 'tous les parcours, explorés à partir de l’histoire',
  partly: 'Exploré en partie\u00a0: des choix ou des fins manquent à la carte, situés au-delà d’une grille de boutons-images ou ouverts par des valeurs qu’aucun parcours exploré n’a réunies.',
  endingsReached: (reached, total) => `Fins atteintes : ${reached} sur ${total}`,
  nothingExplored: 'Rien n’a encore été exploré : la carte se remplit à mesure que vous atteignez des choix.',
  untitledChapter: 'Chapitre sans titre',
  playFromHere: 'Jouer à partir d’ici',
  playOption: option => `Jouer à partir d’un parcours où «\u00a0${option}\u00a0» est proposé\u00a0: ici, d’autres valeurs le ferment`,
  forwardOnly: 'Ici, l’histoire ne fait qu’avancer',
  theEnd: 'Fin',
}

export const mapMessages = { en, fr }
