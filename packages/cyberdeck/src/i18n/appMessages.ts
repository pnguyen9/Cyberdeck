const en = {
  /** The preview's way back to the project. */
  leaveLabel: 'Project',
  previewLabel: 'Preview',
  showEveryPath: 'Every path',
  showPlayed: 'The paths played',
  exploring: 'Exploring…',
  language: 'Cyberdeck in',
  /** After the warning that a browser may erase what the web build keeps. */
  keepSafe: 'Keep a backup of each project (“Back up”, at the top of the project).',
}

type AppMessages = typeof en

const fr: AppMessages = {
  leaveLabel: 'Projet',
  previewLabel: 'Aperçu',
  showEveryPath: 'Tous les parcours',
  showPlayed: 'Les parcours joués',
  exploring: 'Exploration…',
  language: 'Cyberdeck en',
  keepSafe: 'Gardez une copie de secours de chaque projet («\u00a0Copie de secours\u00a0», en haut du projet).',
}

export const appMessages = { en, fr }
