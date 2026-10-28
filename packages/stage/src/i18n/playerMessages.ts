/** The player view: its menu, its notices and the buttons of the end screen. */
const en = {
  back: '◀ Back',
  log: 'Log',
  save: 'Save',
  load: 'Load',
  skip: 'Skip ⏩',
  map: 'Map',
  settings: 'Settings',
  autosaveSlot: 'Autosave',
  slot: (slot: string) => `Slot ${slot}`,
  savedInSlot: (slot: string) => `Saved in slot ${slot}.`,
  saveFailed: 'Could not save.',
  autosaveFailed: 'Could not autosave.',
  /** What loading a save gave, after a change of the story maybe. */
  restored: {
    exact: 'Loaded.',
    chapterStart: 'This page no longer exists in the story: resumed at the start of its chapter.',
    storyStart: 'This chapter no longer exists in the story: resumed at the start, with your decisions.',
  },
  skipsReadTextOnly: 'Skipping passes only text already read.',
  fullscreenUnavailable: 'Full screen is not available here.',
}

type PlayerMessages = typeof en

const fr: PlayerMessages = {
  back: '◀ Retour',
  log: 'Historique',
  save: 'Sauvegarder',
  load: 'Charger',
  skip: 'Passer ⏩',
  map: 'Carte',
  settings: 'Paramètres',
  autosaveSlot: 'Sauvegarde automatique',
  slot: slot => `Emplacement ${slot}`,
  savedInSlot: slot => `Partie sauvegardée dans l’emplacement ${slot}.`,
  saveFailed: 'La sauvegarde a échoué.',
  autosaveFailed: 'La sauvegarde automatique a échoué.',
  restored: {
    exact: 'Partie chargée.',
    chapterStart: 'Cette page n’existe plus dans l’histoire : reprise au début de son chapitre.',
    storyStart: 'Ce chapitre n’existe plus dans l’histoire : reprise au début de l’histoire, avec vos décisions.',
  },
  skipsReadTextOnly: 'Seul le texte déjà lu peut être passé.',
  fullscreenUnavailable: 'Le plein écran n’est pas disponible ici.',
}

export const playerMessages = { en, fr }
