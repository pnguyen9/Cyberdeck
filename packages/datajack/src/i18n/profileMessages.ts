import { AUTOSAVE_SLOT } from '@cyberdeck/stage'

/** The profiles screen, where the player says who is playing. */
const en = {
  language: 'Language',
  whoIsPlaying: 'Who is playing?',
  newName: 'New name',
  rename: 'Rename',
  cancel: 'Cancel',
  remove: 'Remove',
  confirmRemove: (profileName: string) => `Remove ${profileName}?`,
  savesStayIn: (folder: string) => `Its games are deleted; its saves stay in ${folder}.`,
  savesDeleted: 'Its games and saves are deleted with it.',
  exportFirst: 'Export it first to keep a copy.',
  changeSaveFolder: 'Change save folder',
  createYourProfile: 'Create your profile',
  newProfile: 'New profile',
  profileKeepsSaves: 'Your profile keeps your saves',
  inFolderOfYourChoice: ' in a folder of your choice',
  opensDirectly: 'Datajack opens it directly next time.',
  name: 'Name',
  savesGoTo: 'Saves go to',
  change: 'Change…',
  useDefault: 'Use the default',
  createAndPlay: 'Create and play',
  nowSavesIn: (profileName: string, folder: string) => `${profileName} now saves in ${folder}.`,
  savesMoved: (count: number) => `${count} ${count === 1 ? 'save' : 'saves'} moved there.`,
  savesKept: (count: number) => `${count} ${count === 1 ? 'save was' : 'saves were'} already there and kept instead.`,
  removed: (profileName: string) => `${profileName} was removed.`,
  nameLength: (maximumLength: number) => `A profile name needs 1 to ${maximumLength} characters.`,
  nameTaken: (name: string) => `Another profile is already named ${name}.`,
  folderTaken: 'Another profile already saves in this folder.',
  export: 'Export to a file',
  exporting: 'Preparing the profile file…',
  exportReady: (profileName: string, hasPin: boolean) => `${profileName}’s profile file is ready, with its games, saves, progress and settings${hasPin ? ', and its PIN' : ''}.`,
  saveProfileFile: 'Save the profile file',
  notEncrypted: 'The file is not encrypted: anyone who has it can read its saves, and the PIN does not protect it. You may put a password on the zip yourself; remove it before importing the file.',
  close: 'Close',
  exportFailed: (profileName: string, error: string) => `${profileName} could not be exported: ${error}`,
  importProfile: 'Import a profile',
  importHint: 'Bring a profile exported by Datajack, from this device or another. It is added as a new profile: none here is changed.',
  chooseProfileFile: 'Choose a profile file…',
  reading: 'Reading the profile file…',
  fileHolds: (profileName: string, exportedAt: Date | null) => exportedAt === null
    ? `This file holds ${profileName}’s profile.`
    : `This file holds ${profileName}’s profile, exported on ${exportedAt.toLocaleDateString('en', { dateStyle: 'long' })}.`,
  nameTakenUse: (takenName: string, freeName: string) => `${takenName} is taken: this one will be ${freeName}, or choose another name.`,
  importNamed: (profileName: string) => `Import ${profileName}`,
  imported: (profileName: string, games: number, saves: number) => `${profileName} was imported, with ${countOf(games, saves)}. It is in the list above; open it to play.`,
  fileError: (fileName: string, error: string) => `${fileName}: ${error}`,
  notProfileFile: 'This file is not a Datajack profile file.',
  gameNotProfile: (addGame: string) => `This file is a game, not a profile: open a profile, then use ${addGame}`,
  newerProfileFile: 'This profile file was made by a newer Datajack: update Datajack, then import the file again.',
  damagedProfileFile: 'This profile file is damaged. If you can, export the profile again from the device it came from.',
  gameInFile: (gameName: string, error: string) => `${gameName}, in this file, cannot be installed: ${error}`,
  tooLarge: (gigabytes: number) => `This profile is too large for one file: a profile file holds at most ${gigabytes} GB. Remove a few games from its library, then export it again.`,
  saveNotWritten: (gameName: string, slot: string) => `${slot === AUTOSAVE_SLOT ? 'The autosave' : `The save in slot ${slot}`} of ${gameName} could not be written.`,
  progressNotWritten: (gameName: string) => `The progress of ${gameName} could not be written.`,
}

/** How many games and saves came, in English. */
function countOf(games: number, saves: number): string {
  return `${games} ${games === 1 ? 'game' : 'games'} and ${saves} ${saves === 1 ? 'save' : 'saves'}`
}

type ProfileMessages = typeof en

const fr: ProfileMessages = {
  language: 'Langue',
  whoIsPlaying: 'Qui joue ?',
  newName: 'Nouveau nom',
  rename: 'Renommer',
  cancel: 'Annuler',
  remove: 'Supprimer',
  confirmRemove: profileName => `Supprimer ${profileName} ?`,
  savesStayIn: folder => `Ses jeux seront supprimés ; ses sauvegardes restent dans ${folder}.`,
  savesDeleted: 'Ses jeux et ses sauvegardes seront supprimés avec lui.',
  exportFirst: 'Exportez-le d’abord pour en garder une copie.',
  changeSaveFolder: 'Changer le dossier de sauvegarde',
  createYourProfile: 'Créez votre profil',
  newProfile: 'Nouveau profil',
  profileKeepsSaves: 'Votre profil conserve vos sauvegardes',
  inFolderOfYourChoice: ' dans le dossier de votre choix',
  opensDirectly: 'La prochaine fois, Datajack s’ouvrira directement sur ce profil.',
  name: 'Nom',
  savesGoTo: 'Dossier des sauvegardes',
  change: 'Changer…',
  useDefault: 'Utiliser le dossier par défaut',
  createAndPlay: 'Créer et jouer',
  nowSavesIn: (profileName, folder) => `Les sauvegardes de ${profileName} vont désormais dans ${folder}.`,
  savesMoved: count => count <= 1 ? `${count} sauvegarde y a été déplacée.` : `${count} sauvegardes y ont été déplacées.`,
  savesKept: count => count <= 1
    ? 'Une sauvegarde s’y trouvait déjà : c’est elle qui a été conservée.'
    : `${count} sauvegardes s’y trouvaient déjà : ce sont elles qui ont été conservées.`,
  removed: profileName => `Le profil ${profileName} a été supprimé.`,
  nameLength: maximumLength => `Un nom de profil doit contenir entre 1 et ${maximumLength} caractères.`,
  nameTaken: name => `Un autre profil s’appelle déjà ${name}.`,
  folderTaken: 'Ce dossier est déjà utilisé par un autre profil.',
  export: 'Exporter dans un fichier',
  exporting: 'Préparation du fichier de profil…',
  exportReady: (profileName, hasPin) => `Le fichier du profil ${profileName} est prêt, avec ses jeux, ses sauvegardes, sa progression et ses réglages${hasPin ? ', ainsi que son code secret' : ''}.`,
  saveProfileFile: 'Enregistrer le fichier de profil',
  notEncrypted: 'Ce fichier n’est pas chiffré : toute personne qui le possède peut lire ses sauvegardes, et le code secret ne le protège pas. Vous pouvez vous-même protéger le fichier zip par un mot de passe ; retirez-le avant d’importer le fichier.',
  close: 'Fermer',
  exportFailed: (profileName, error) => `Le profil ${profileName} n’a pas pu être exporté : ${error}`,
  importProfile: 'Importer un profil',
  importHint: 'Récupérez un profil exporté par Datajack, depuis cet appareil ou un autre. Il est ajouté comme nouveau profil : aucun profil d’ici n’est modifié.',
  chooseProfileFile: 'Choisir un fichier de profil…',
  reading: 'Lecture du fichier de profil…',
  fileHolds: (profileName, exportedAt) => exportedAt === null
    ? `Ce fichier contient le profil ${profileName}.`
    : `Ce fichier contient le profil ${profileName}, exporté le ${exportedAt.toLocaleDateString('fr', { dateStyle: 'long' })}.`,
  nameTakenUse: (takenName, freeName) => `Le nom ${takenName} est déjà pris : ce profil s’appellera ${freeName}, ou choisissez un autre nom.`,
  importNamed: profileName => `Importer ${profileName}`,
  imported: (profileName, games, saves) => `Le profil ${profileName} a été importé, avec ${frenchCountOf(games, saves)}. Il figure dans la liste ci-dessus : ouvrez-le pour jouer.`,
  fileError: (fileName, error) => `${fileName} : ${error}`,
  notProfileFile: 'Ce fichier n’est pas un fichier de profil Datajack.',
  gameNotProfile: addGame => `Ce fichier est un jeu, pas un profil : ouvrez un profil, puis utilisez ${addGame}`,
  newerProfileFile: 'Ce fichier de profil a été créé par une version plus récente de Datajack : mettez Datajack à jour, puis importez de nouveau le fichier.',
  damagedProfileFile: 'Ce fichier de profil est endommagé. Si vous le pouvez, exportez de nouveau le profil depuis l’appareil d’origine.',
  gameInFile: (gameName, error) => `Le jeu ${gameName} de ce fichier ne peut pas être installé : ${error}`,
  tooLarge: gigabytes => `Ce profil est trop volumineux pour un seul fichier : un fichier de profil contient au plus ${gigabytes} Go. Retirez quelques jeux de sa bibliothèque, puis exportez-le de nouveau.`,
  saveNotWritten: (gameName, slot) => `${slot === AUTOSAVE_SLOT ? 'La sauvegarde automatique' : `La sauvegarde de l’emplacement ${slot}`} de ${gameName} n’a pas pu être enregistrée.`,
  progressNotWritten: gameName => `La progression de ${gameName} n’a pas pu être enregistrée.`,
}

/** How many games and saves came, in French: singular up to one. */
function frenchCountOf(games: number, saves: number): string {
  return `${games} ${games <= 1 ? 'jeu' : 'jeux'} et ${saves} ${saves <= 1 ? 'sauvegarde' : 'sauvegardes'}`
}

export const profileMessages = { en, fr }
