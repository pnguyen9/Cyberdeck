import { ArchiveError, type ArchiveProblem } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'

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
      return `${problem.path} est plus volumineux qu’annoncé`
    case 'duplicateFile':
      return `L’archive contient deux fois ${problem.path}`
    case 'encryptedFile':
      return `${problem.path} est chiffré`
    case 'unknownCompression':
      return `${problem.path} utilise une méthode de compression que Datajack ne lit pas`
    case 'fileTooLarge':
      return `${problem.path} est trop volumineux`
    case 'invalidPath':
      return problem.path === null ? 'Chemin invalide dans l’archive : il n’est pas en UTF-8' : `Chemin invalide dans l’archive : ${JSON.stringify(problem.path)}`
    case 'notAGame':
      return `Cette archive ne contient pas ${problem.path} : ce n’est pas un jeu Datajack`
    case 'missingFile':
      return `Cette archive ne contient pas ${problem.path}`
    case 'invalidJson':
      return `${problem.path} n’est pas un JSON valide`
    case 'invalidDocument':
      return `${problem.path} n’est pas valide (${problem.detail})`
    case 'newerFormat':
      return `Ce jeu demande une version plus récente de Datajack : téléchargez la dernière (${problem.path} : ${problem.detail})`
    case 'otherChapter':
      return `${problem.path} contient un autre chapitre`
    case 'otherScene':
      return `${problem.path} contient une autre scène`
    case 'alteredFile':
      return `${problem.path} n’est pas le fichier avec lequel le jeu a été exporté : l’archive a été modifiée ou endommagée`
    case 'newerPlayer':
      return 'Ce jeu a été conçu pour une version plus récente de Datajack : téléchargez la dernière'
  }
}

const archiveMessages: Readonly<Record<Locale, (error: ArchiveError) => string>> = {
  en: error => error.message,
  fr: error => frenchArchiveMessage(error.problem),
}

/** An error as the player reads it: archives refused in their language, other errors by their message. */
export function describeError(error: unknown, locale: Locale): string {
  if (error instanceof ArchiveError) {
    return archiveMessages[locale](error)
  }
  return error instanceof Error ? error.message : String(error)
}
