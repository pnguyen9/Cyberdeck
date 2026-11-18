/** Where a screen goes back to, named on its button. */
const en = {
  library: 'Library',
  game: 'Game',
  /** After the warning that a browser may erase what the web build keeps. */
  keepSafe: 'Keep each game’s archive, and export your progress and saves to files (“Progress to a file”, and “Save to a file” in a game’s saves).',
}

type AppMessages = typeof en

const fr: AppMessages = {
  library: 'Bibliothèque',
  game: 'Jeu',
  keepSafe: 'Conservez l’archive de chaque jeu, et exportez votre progression et vos sauvegardes dans des fichiers (« Exporter la progression » dans la bibliothèque, et « Enregistrer dans un fichier » dans les sauvegardes d’un jeu).',
}

export const appMessages = { en, fr }
