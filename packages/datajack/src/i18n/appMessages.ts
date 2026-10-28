/** Where a screen goes back to, named on its button. */
const en = {
  library: 'Library',
  game: 'Game',
}

type AppMessages = typeof en

const fr: AppMessages = {
  library: 'Bibliothèque',
  game: 'Jeu',
}

export const appMessages = { en, fr }
