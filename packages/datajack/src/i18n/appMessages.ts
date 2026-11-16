/** Where a screen goes back to, named on its button. */
const en = {
  library: 'Library',
  game: 'Game',
  /** After the warning that a browser may erase what the web build keeps. */
  keepSafe: 'Keep each game’s archive, and your progress and saves as files (Progress to a file; Save to a file, in a game’s saves).',
}

type AppMessages = typeof en

const fr: AppMessages = {
  library: 'Bibliothèque',
  game: 'Jeu',
  keepSafe: 'Gardez l’archive de chaque jeu, et votre progression et vos sauvegardes dans des fichiers (Progression dans un fichier\u00a0; Enregistrer dans un fichier, dans les sauvegardes d’un jeu).',
}

export const appMessages = { en, fr }
