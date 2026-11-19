import { ArchiveError, type ArchiveProblem } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'
import { LibraryBlockedError } from '../library/indexedDbLibraryStorage'
import { ProfileFileError, type ProfileFileProblem } from '../profiles/profileFile'
import { libraryMessages } from './libraryMessages'
import { profileMessages } from './profileMessages'

/** Why an archive is refused, in French; English is the message of the error itself. */
function frenchArchiveMessage(problem: ArchiveProblem): string {
  switch (problem.code) {
    case 'notZip':
      return 'Ce fichier n’est pas une archive ZIP'
    case 'tooManyFiles':
      return `L’archive contient trop de fichiers (${problem.fileCount})`
    case 'fileListCutShort':
      return 'L’archive est endommagée : sa liste de fichiers est incomplète'
    case 'damagedFile':
      return `L’archive est endommagée : ${problem.path} est illisible`
    case 'largerThanDeclared':
      return `${problem.path} dépasse la taille annoncée`
    case 'duplicateFile':
      return `L’archive contient deux fois ${problem.path}`
    case 'encryptedFile':
      return `${problem.path} est chiffré`
    case 'unknownCompression':
      return `${problem.path} utilise une méthode de compression que Datajack ne sait pas lire`
    case 'fileTooLarge':
      return `${problem.path} est trop volumineux`
    case 'invalidPath':
      return problem.path === null ? 'Chemin invalide dans l’archive : il n’est pas encodé en UTF-8' : `Chemin invalide dans l’archive : ${JSON.stringify(problem.path)}`
    case 'notAGame':
      return `Cette archive ne contient pas ${problem.path} : ce n’est pas un jeu Datajack`
    case 'missingFile':
      return `Cette archive ne contient pas ${problem.path}`
    case 'invalidJson':
      return `${problem.path} n’est pas un JSON valide`
    case 'invalidDocument':
      return `${problem.path} n’est pas valide (${problem.detail})`
    case 'newerFormat':
      return `Ce jeu nécessite une version plus récente de Datajack : téléchargez la dernière version (${problem.path} : ${problem.detail})`
    case 'otherChapter':
      return `${problem.path} contient un autre chapitre`
    case 'otherScene':
      return `${problem.path} contient une autre scène`
    case 'alteredFile':
      return `${problem.path} ne correspond pas au fichier exporté avec le jeu : l’archive a été modifiée ou endommagée`
    case 'newerPlayer':
      return 'Ce jeu a été conçu pour une version plus récente de Datajack : téléchargez la dernière version'
  }
}

const archiveMessages: Readonly<Record<Locale, (error: ArchiveError) => string>> = {
  en: error => error.message,
  fr: error => frenchArchiveMessage(error.problem),
}

/**
 * A zip locked with a password, as players may lock a profile file they keep: Datajack does not
 * unlock zips, so it says how to give it one it reads, whatever the file is meant to be.
 */
const lockedZipMessages: Readonly<Record<Locale, string>> = {
  en: 'This file is locked with a password, which Datajack cannot open. Unzip it with its password, zip what it holds again without one, then use that new file.',
  fr: 'Ce fichier est protégé par un mot de passe, que Datajack ne sait pas ouvrir. Décompressez-le avec son mot de passe, compressez de nouveau son contenu sans mot de passe, puis utilisez ce nouveau fichier.',
}

/** Another Datajack tab, from before the library changed shape, keeps it from opening. */
const libraryBlockedMessages: Readonly<Record<Locale, string>> = {
  en: 'Datajack is open in another tab or window, which keeps the library from opening. Close the other Datajack tabs or windows, then reload this page.',
  fr: 'Datajack est ouvert dans un autre onglet ou une autre fenêtre, ce qui empêche d’ouvrir la bibliothèque. Fermez les autres onglets ou fenêtres de Datajack, puis rechargez cette page.',
}

/** Why a profile file is refused, or cannot be made or imported. */
function profileFileMessage(problem: ProfileFileProblem, locale: Locale): string {
  const text = profileMessages[locale]
  switch (problem.code) {
    case 'notProfile':
      return text.notProfileFile
    case 'isGame':
      return text.gameNotProfile(libraryMessages[locale].addGame)
    case 'newerFormat':
      return text.newerProfileFile
    case 'damaged':
      return text.damagedProfileFile
    case 'game':
      return text.gameInFile(problem.gameName, describeError(problem.error, locale))
    case 'tooLarge':
      return text.tooLarge(Math.floor(problem.maximumSize / 1024 ** 3))
    case 'saveNotWritten':
      return text.saveNotWritten(problem.gameName, problem.slot)
    case 'progressNotWritten':
      return text.progressNotWritten(problem.gameName)
  }
}

/** An error as the player reads it: archives refused in their language, other errors by their message. */
export function describeError(error: unknown, locale: Locale): string {
  if (error instanceof ArchiveError) {
    return error.code === 'encryptedFile' ? lockedZipMessages[locale] : archiveMessages[locale](error)
  }
  if (error instanceof ProfileFileError) {
    return profileFileMessage(error.problem, locale)
  }
  if (error instanceof LibraryBlockedError) {
    return libraryBlockedMessages[locale]
  }
  return error instanceof Error ? error.message : String(error)
}
