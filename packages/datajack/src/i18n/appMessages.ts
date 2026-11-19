/** Where a screen goes back to, named on its button. */
const en = {
  library: 'Library',
  game: 'Game',
  /** After the warning that a browser may erase what the web build keeps. */
  keepSafe: 'Export your profile now and then (Export to a file, on the profiles screen): one file keeps your games, saves and progress.',
}

type AppMessages = typeof en

const fr: AppMessages = {
  library: 'Bibliothèque',
  game: 'Jeu',
  keepSafe: 'Exportez votre profil de temps en temps (Exporter dans un fichier, sur l’écran des profils) : un seul fichier conserve vos jeux, vos sauvegardes et votre progression.',
}

export const appMessages = { en, fr }
