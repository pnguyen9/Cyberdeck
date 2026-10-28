import type { InstallOutcome } from '../library/gameLibrary'

/** The library of installed games. */
const en = {
  switchProfile: 'Switch profile',
  language: 'Language',
  installing: 'Installing…',
  addGame: 'Add a game…',
  loadSave: 'Load a save…',
  /** Around the extensions of a game's file and a save's, shown as code. */
  dropHint: { beforeGame: "or drop a game's ", beforeSave: " or a save's ", after: ' anywhere on this page' },
  noGames: { before: 'No games yet. Add a game you downloaded: its ', after: ' file.' },
  untitledChapter: 'Untitled chapter',
  chapterCount: (count: number) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`,
  someChapters: (installed: number, total: number, missing: readonly string[]) => `${installed} of ${total} chapters · not installed: ${missing.join(', ')}`,
  endingsReached: (reached: number, total: number) => `endings reached: ${reached} of ${total}`,
  illustrationsSeen: (seen: number, total: number) => `illustrations seen: ${seen} of ${total}`,
  confirmRemove: (gameName: string) => `Remove ${gameName}? Your saves are kept, for when you install it again.`,
  remove: 'Remove',
  cancel: 'Cancel',
  confirmStartOver: 'Start over? Your autosave will be replaced; your saved slots are kept.',
  startOver: 'Start over',
  continue: 'Continue',
  play: 'Play',
  newGame: 'New game',
  map: 'Map',
  gallery: 'Gallery',
  credits: 'Credits',
  removed: (gameName: string) => `${gameName} was removed.`,
  fileError: (fileName: string, error: string) => `${fileName}: ${error}`,
  cannotOpen: (gameName: string, error: string) => `${gameName} cannot be opened: ${error}`,
  notASave: (fileName: string) => `${fileName} is not a save.`,
  gameNotInstalled: (fileName: string, gameName: string) => `${fileName} is a save of ${gameName}, which is not installed: add the game first.`,
  installed: (name: string) => `${name} installed.`,
  addedChapters: (titles: string) => `added ${titles}`,
  updatedChapters: (titles: string) => `updated ${titles}`,
  changeSeparator: '; ',
  nothingNew: (name: string) => `${name}: nothing new.`,
  changed: (name: string, changes: string) => `${name}: ${changes}.`,
  olderArchive: (gameName: string, release: string) => `This archive of ${gameName} is older than ${release}, installed already: nothing to add.`,
  olderArchiveChanged: (gameName: string, release: string, changes: string) => `This archive of ${gameName} is older than ${release}, installed already: ${changes}.`,
}

type LibraryMessages = typeof en

const fr: LibraryMessages = {
  switchProfile: 'Changer de profil',
  language: 'Langue',
  installing: 'Installation…',
  addGame: 'Ajouter un jeu…',
  loadSave: 'Charger une sauvegarde…',
  dropHint: { beforeGame: 'ou déposez n’importe où sur cette page le ', beforeSave: ' d’un jeu ou le ', after: ' d’une sauvegarde' },
  noGames: { before: 'Aucun jeu pour l’instant. Ajoutez un jeu téléchargé : son fichier ', after: '.' },
  untitledChapter: 'Chapitre sans titre',
  chapterCount: count => `${count} ${count <= 1 ? 'chapitre' : 'chapitres'}`,
  someChapters: (installed, total, missing) => `${installed} ${installed <= 1 ? 'chapitre' : 'chapitres'} sur ${total} · ${missing.length <= 1 ? 'non installé' : 'non installés'} : ${missing.join(', ')}`,
  endingsReached: (reached, total) => `fins atteintes : ${reached} sur ${total}`,
  illustrationsSeen: (seen, total) => `illustrations vues : ${seen} sur ${total}`,
  confirmRemove: gameName => `Supprimer ${gameName} ? Vos sauvegardes sont conservées, au cas où vous réinstalleriez ce jeu.`,
  remove: 'Supprimer',
  cancel: 'Annuler',
  confirmStartOver: 'Recommencer ? Votre sauvegarde automatique sera remplacée ; vos emplacements de sauvegarde sont conservés.',
  startOver: 'Recommencer',
  continue: 'Continuer',
  play: 'Jouer',
  newGame: 'Nouvelle partie',
  map: 'Carte',
  gallery: 'Galerie',
  credits: 'Crédits',
  removed: gameName => `Jeu supprimé de la bibliothèque : ${gameName}.`,
  fileError: (fileName, error) => `${fileName} : ${error}`,
  cannotOpen: (gameName, error) => `Impossible d’ouvrir ${gameName} : ${error}`,
  notASave: fileName => `${fileName} n’est pas une sauvegarde.`,
  gameNotInstalled: (fileName, gameName) => `${fileName} est une sauvegarde de ${gameName}, un jeu qui n’est pas installé : ajoutez-le d’abord.`,
  installed: name => `Jeu installé : ${name}.`,
  addedChapters: titles => `ajout de ${titles}`,
  updatedChapters: titles => `mise à jour de ${titles}`,
  changeSeparator: ' ; ',
  nothingNew: name => `${name} : rien de nouveau.`,
  changed: (name, changes) => `${name} : ${changes}.`,
  olderArchive: (gameName, release) => `Cette archive de ${gameName} est plus ancienne que la version ${release} déjà installée : rien à ajouter.`,
  olderArchiveChanged: (gameName, release, changes) => `Cette archive de ${gameName} est plus ancienne que la version ${release} déjà installée : ${changes}.`,
}

export const libraryMessages = { en, fr }

/** What installing an archive did, in a sentence: a new game, chapters added or updated, or nothing. */
export function describeInstall(outcome: InstallOutcome, text: LibraryMessages): string {
  const name = `${outcome.gameName} ${outcome.release}`
  const list = (titles: string[]) => titles.join(', ')
  if (outcome.isNewGame) {
    return text.installed(name)
  }
  const changes = [
    outcome.addedChapters.length === 0 ? '' : text.addedChapters(list(outcome.addedChapters)),
    outcome.updatedChapters.length === 0 ? '' : text.updatedChapters(list(outcome.updatedChapters)),
  ].filter(change => change !== '').join(text.changeSeparator)
  if (outcome.wasOlder) {
    return changes === ''
      ? text.olderArchive(outcome.gameName, outcome.release)
      : text.olderArchiveChanged(outcome.gameName, outcome.release, changes)
  }
  return changes === '' ? text.nothingNew(name) : text.changed(name, changes)
}
