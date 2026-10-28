/** The panels saving into a slot and loading from one. */
const en = {
  save: 'Save',
  load: 'Load',
  close: 'Close',
  untitledChapter: 'Untitled chapter',
  empty: 'Empty',
  saveToFile: 'Save to a file',
  saveToFileReason: 'to keep it, or to go on playing on another computer.',
}

type SaveLoadMessages = typeof en

const fr: SaveLoadMessages = {
  save: 'Sauvegarder',
  load: 'Charger',
  close: 'Fermer',
  untitledChapter: 'Chapitre sans titre',
  empty: 'Vide',
  saveToFile: 'Enregistrer dans un fichier',
  saveToFileReason: 'pour conserver cette partie, ou la poursuivre sur un autre ordinateur.',
}

export const saveLoadMessages = { en, fr }
