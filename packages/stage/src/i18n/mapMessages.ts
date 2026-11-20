/** The map of the routes explored. */
const en = {
  routesExplored: 'routes explored',
  everyPath: 'every path the story allows',
  partly: 'Explored in part: some choices or endings are missing from the map, because they lie past a grid of picture buttons, or need values that no explored path gathers.',
  endingsReached: (reached: number, total: number) => `Endings reached: ${reached} of ${total}`,
  nothingExplored: 'Nothing explored yet: the map fills in as you reach choices.',
  untitledChapter: 'Untitled chapter',
  playFromHere: 'Play from here',
  playOption: (option: string) => `Play from a path that offers “${option}” (here, the values held do not allow it)`,
  forwardOnly: 'The story only goes forward here',
  theEnd: 'The end',
  showValues: 'What the journal showed here',
  fromCardToCard: 'move from card to card',
  turnPage: 'turn a page',
  startOrLastColumn: 'go to the start or the last column',
  pageLeft: 'Page to the left',
  pageRight: 'Page to the right',
  pageUp: 'Page above',
  pageDown: 'Page below',
  pointCard: (chapter: string, decision: string, playKey: string | null) => `${chapter}, ${decision}: ${playKey === null ? 'the story only goes forward here' : `${playKey} to play from here`}`,
}

type MapMessages = typeof en

const fr: MapMessages = {
  routesExplored: 'parcours explorés',
  everyPath: 'tous les parcours que permet l’histoire',
  partly: 'Exploration partielle : certains choix ou certaines fins manquent sur la carte, car ils se trouvent après une grille de boutons-images, ou demandent des valeurs qu’aucun parcours exploré ne réunit.',
  endingsReached: (reached, total) => `Fins atteintes : ${reached} sur ${total}`,
  nothingExplored: 'Rien n’a encore été exploré : la carte se remplit à mesure que vous atteignez des choix.',
  untitledChapter: 'Chapitre sans titre',
  playFromHere: 'Jouer à partir d’ici',
  playOption: option => `Jouer à partir d’un parcours qui propose « ${option} » (ici, les valeurs actuelles ne le permettent pas)`,
  forwardOnly: 'Ici, l’histoire ne fait qu’avancer',
  theEnd: 'Fin',
  showValues: 'Contenu du journal à cet endroit',
  fromCardToCard: 'passer d’une carte à l’autre',
  turnPage: 'tourner une page',
  startOrLastColumn: 'aller au début ou à la dernière colonne',
  pageLeft: 'Page de gauche',
  pageRight: 'Page de droite',
  pageUp: 'Page au-dessus',
  pageDown: 'Page en dessous',
  pointCard: (chapter, decision, playKey) => `${chapter}, ${decision}\u00a0: ${playKey === null ? 'ici, l’histoire ne fait qu’avancer' : `${playKey} pour jouer à partir d’ici`}`,
}

export const mapMessages = { en, fr }
