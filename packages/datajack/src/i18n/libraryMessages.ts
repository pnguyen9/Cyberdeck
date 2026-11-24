import type { InstallOutcome } from '../library/gameLibrary'

/** The library of installed games. */
const en = {
  switchProfile: 'Switch profile',
  settings: 'Settings',
  language: 'Language',
  installing: 'Installing…',
  addGame: 'Add a game…',
  loadSave: 'Load a save or progress…',
  /** Around the extensions of a game's file and a save's, shown as code. */
  dropHint: { beforeGame: 'or drop a game (', beforeSave: ' file) or a save (', after: ' file) anywhere on this page' },
  noGames: { before: 'No games yet. Add a game you downloaded (a ', after: ' file).' },
  untitledChapters: (count: number) => count <= 1 ? 'an untitled chapter' : `${count} untitled chapters`,
  chapterCount: (count: number) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`,
  someChapters: (installed: number, total: number, missing: readonly string[]) => `${installed} of ${total} chapters${missing.length === 0 ? '' : ` · not installed: ${missing.join(', ')}`}`,
  endingsReached: (reached: number, total: number) => `endings reached: ${reached} of ${total}`,
  illustrationsSeen: (seen: number, total: number) => `illustrations seen: ${seen} of ${total}`,
  confirmRemove: (gameName: string) => `Remove ${gameName} from your library? Your saves are kept, for when you install it again.`,
  remove: 'Remove',
  eraseGameData: 'Erase…',
  confirmEraseGame: (gameName: string) => `What should be erased of ${gameName}? The game stays installed.`,
  eraseProgress: 'Its progress',
  eraseSaves: 'Its saves',
  eraseBoth: 'Both',
  erasedGameData: (gameName: string, erased: { saves: boolean; progress: boolean }) => erased.saves && erased.progress
    ? `The saves and progress of ${gameName} were erased.`
    : erased.saves ? `The saves of ${gameName} were erased.` : `The progress of ${gameName} was erased: its endings, map, gallery, pages read and memories.`,
  cancel: 'Cancel',
  eraseAll: 'Erase your games and saves…',
  confirmErase: 'Erase every game in your library? Your saves and progress are kept, unless you erase them too. Other profiles keep their libraries, saves and progress.',
  eraseGames: 'Erase the games',
  eraseGamesAndSaves: 'Erase the games, the saves and the progress',
  erased: 'Every game in your library was erased.',
  erasedWithSaves: 'Every game in your library was erased, with your saves and progress.',
  confirmStartOver: 'Start over? Your autosave will be replaced; your saved slots are kept.',
  startOver: 'Start over',
  continue: 'Continue',
  play: 'Play',
  storyLanguage: 'Play in',
  newGame: 'New game',
  map: 'Map',
  gallery: 'Gallery',
  credits: 'Credits',
  removed: (gameName: string) => `${gameName} was removed from your library.`,
  fileError: (fileName: string, error: string) => `${fileName}: ${error}`,
  profileNotGame: 'This is a profile file, not a game: import it from the profiles screen (Switch profile).',
  cannotOpen: (gameName: string, error: string) => `${gameName} cannot be opened: ${error}`,
  notASave: (fileName: string) => `${fileName} is neither a save nor a game's progress.`,
  progressToFile: 'Progress to a file',
  progressFileName: (gameName: string) => `${gameName.replace(/[\\/:*?"<>|]/g, '')} progress.json`,
  progressLoaded: (gameName: string) => `The progress of ${gameName} was loaded and merged with what you had already reached.`,
  progressNotWritten: (gameName: string) => `The progress of ${gameName} could not be written.`,
  progressOfGameNotInstalled: (fileName: string, gameName: string) => `${fileName} is the progress of ${gameName}, which is not installed: add the game first.`,
  gameNotInstalled: (fileName: string, gameName: string) => `${fileName} is a save of ${gameName}, which is not installed: add the game first.`,
  installed: (name: string) => `${name} installed.`,
  addedChapters: (titles: string) => `added ${titles}`,
  updatedChapters: (titles: string) => `updated ${titles}`,
  changeSeparator: '; ',
  nothingNew: (name: string) => `${name}: nothing new.`,
  changed: (name: string, changes: string) => `${name}: ${changes}.`,
  olderArchive: (gameName: string, release: string) => `This archive of ${gameName} is older than ${release}, installed already: nothing to add.`,
  olderArchiveChanged: (gameName: string, release: string, changes: string) => `This archive of ${gameName} is older than ${release}, installed already: ${changes}.`,
  samples: 'Samples',
  samplesIntro: 'Games to try, built into Datajack. Add one to put it in your library, with the games you downloaded.',
  addToLibrary: 'Add to library',
  inYourLibrary: 'In your library',
  updateSample: 'Update',
  sampleChanged: 'This sample has changed since you added it. Your saves are kept when you update it, but a save made on a page that has changed resumes at the start of its chapter, or at the start of the story if that chapter is gone.',
  sampleNotLoaded: (name: string, isHosted: boolean) => `${name} could not be loaded. ${isHosted ? 'Check your connection, then try again.' : 'Try again.'}`,
  sampleUpToDate: (name: string) => `${name} is up to date in your library.`,
}

type LibraryMessages = typeof en

/** « de » before a list of chapters, « d’ » before « un chapitre sans titre » (or a title beginning with « un »). */
function ofFrench(titles: string): string {
  return titles.startsWith('un ') ? `d’${titles}` : `de ${titles}`
}

const fr: LibraryMessages = {
  switchProfile: 'Changer de profil',
  settings: 'Paramètres',
  language: 'Langue',
  installing: 'Installation…',
  addGame: 'Ajouter un jeu…',
  loadSave: 'Charger une sauvegarde ou une progression…',
  dropHint: { beforeGame: 'ou déposez sur cette page un jeu (fichier ', beforeSave: ') ou une sauvegarde (fichier ', after: ')' },
  noGames: { before: 'Aucun jeu pour l’instant. Ajoutez un jeu que vous avez téléchargé (fichier ', after: ').' },
  untitledChapters: count => count <= 1 ? 'un chapitre sans titre' : `${count} chapitres sans titre`,
  chapterCount: count => `${count} ${count <= 1 ? 'chapitre' : 'chapitres'}`,
  someChapters: (installed, total, missing) => `${installed} ${installed <= 1 ? 'chapitre' : 'chapitres'} sur ${total}${missing.length === 0 ? '' : ` · ${missing.length <= 1 ? 'non installé' : 'non installés'} : ${missing.join(', ')}`}`,
  endingsReached: (reached, total) => `fins atteintes : ${reached} sur ${total}`,
  illustrationsSeen: (seen, total) => `illustrations vues : ${seen} sur ${total}`,
  confirmRemove: gameName => `Supprimer ${gameName} de votre bibliothèque ? Vos sauvegardes sont conservées, au cas où vous réinstalleriez ce jeu.`,
  remove: 'Supprimer',
  eraseGameData: 'Effacer…',
  confirmEraseGame: gameName => `Que voulez-vous effacer pour ${gameName} ? Le jeu restera installé.`,
  eraseProgress: 'La progression',
  eraseSaves: 'Les sauvegardes',
  eraseBoth: 'Les deux',
  erasedGameData: (gameName, erased) => erased.saves && erased.progress
    ? `Les sauvegardes et la progression de ${gameName} ont été effacées.`
    : erased.saves ? `Les sauvegardes de ${gameName} ont été effacées.` : `La progression de ${gameName} a été effacée : fins, carte, galerie, pages lues et souvenirs.`,
  cancel: 'Annuler',
  eraseAll: 'Effacer vos jeux et vos sauvegardes…',
  confirmErase: 'Effacer tous les jeux de votre bibliothèque ? Vos sauvegardes et votre progression sont conservées, sauf si vous les effacez aussi. Les autres profils conservent leur bibliothèque, leurs sauvegardes et leur progression.',
  eraseGames: 'Effacer les jeux',
  eraseGamesAndSaves: 'Effacer les jeux, les sauvegardes et la progression',
  erased: 'Tous les jeux de votre bibliothèque ont été effacés.',
  erasedWithSaves: 'Tous les jeux de votre bibliothèque ont été effacés, ainsi que vos sauvegardes et votre progression.',
  confirmStartOver: 'Recommencer ? Votre sauvegarde automatique sera remplacée ; les sauvegardes de vos emplacements sont conservées.',
  startOver: 'Recommencer',
  continue: 'Continuer',
  play: 'Jouer',
  storyLanguage: 'Jouer en',
  newGame: 'Nouvelle partie',
  map: 'Carte',
  gallery: 'Galerie',
  credits: 'Crédits',
  removed: gameName => `Jeu supprimé de votre bibliothèque : ${gameName}.`,
  fileError: (fileName, error) => `${fileName} : ${error}`,
  profileNotGame: 'C’est un fichier de profil, pas un jeu : importez-le depuis l’écran des profils (Changer de profil).',
  cannotOpen: (gameName, error) => `Impossible d’ouvrir ${gameName} : ${error}`,
  notASave: fileName => `${fileName} n’est ni une sauvegarde ni la progression d’un jeu.`,
  progressToFile: 'Exporter la progression',
  progressFileName: gameName => `${gameName.replace(/[\\/:*?"<>|]/g, '')} progression.json`,
  progressLoaded: gameName => `La progression de ${gameName} a été chargée et fusionnée avec celle que vous aviez déjà.`,
  progressNotWritten: gameName => `La progression de ${gameName} n’a pas pu être enregistrée.`,
  progressOfGameNotInstalled: (fileName, gameName) => `${fileName} contient la progression de ${gameName}, mais ce jeu n’est pas installé : ajoutez-le d’abord.`,
  gameNotInstalled: (fileName, gameName) => `${fileName} est une sauvegarde de ${gameName}, mais ce jeu n’est pas installé : ajoutez-le d’abord.`,
  installed: name => `Jeu installé : ${name}.`,
  addedChapters: titles => `ajout ${ofFrench(titles)}`,
  updatedChapters: titles => `mise à jour ${ofFrench(titles)}`,
  changeSeparator: ' ; ',
  nothingNew: name => `${name} : rien de nouveau.`,
  changed: (name, changes) => `${name} : ${changes}.`,
  olderArchive: (gameName, release) => `Cette archive de ${gameName} est plus ancienne que la version ${release} déjà installée : rien à ajouter.`,
  olderArchiveChanged: (gameName, release, changes) => `Cette archive de ${gameName} est plus ancienne que la version ${release} déjà installée : ${changes}.`,
  samples: 'Échantillons',
  samplesIntro: 'Des jeux à essayer, fournis avec Datajack. Ajoutez celui de votre choix à votre bibliothèque : il rejoindra les jeux que vous avez téléchargés.',
  addToLibrary: 'Ajouter à la bibliothèque',
  inYourLibrary: 'Dans votre bibliothèque',
  updateSample: 'Mettre à jour',
  sampleChanged: 'Cet échantillon a changé depuis que vous l’avez ajouté. La mise à jour conserve vos sauvegardes, mais une sauvegarde faite sur une page modifiée reprendra au début de son chapitre, ou au début de l’histoire si ce chapitre n’existe plus.',
  sampleNotLoaded: (name, isHosted) => `Impossible de charger ${name}. ${isHosted ? 'Vérifiez votre connexion, puis réessayez.' : 'Réessayez.'}`,
  sampleUpToDate: name => `${name} est à jour dans votre bibliothèque.`,
}

export const libraryMessages = { en, fr }

/** What installing an archive did, in a sentence: a new game, chapters added or updated, or nothing. */
export function describeInstall(outcome: InstallOutcome, text: LibraryMessages): string {
  const name = `${outcome.gameName} ${outcome.release}`
  const list = (titles: (string | null)[]) => {
    const titled = titles.filter(title => title !== null)
    const untitledCount = titles.length - titled.length
    return [...titled, ...(untitledCount === 0 ? [] : [text.untitledChapters(untitledCount)])].join(', ')
  }
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

/**
 * What adding a sample did: the sample's name when it is new, as for any game; for one already in
 * the library, that it is up to date, not the chapters rewritten, which for a long sample are dozens.
 */
export function describeSampleInstall(outcome: InstallOutcome, text: LibraryMessages): string {
  return outcome.isNewGame || outcome.wasOlder ? describeInstall(outcome, text) : text.sampleUpToDate(outcome.gameName)
}
