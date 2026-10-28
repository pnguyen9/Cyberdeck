/**
 * Why an archive is refused, for players to understand in their own language: the application
 * words each code, its parameters filled in. The ZIP reader is shared with Word documents and
 * project backups, which refuse a file for the same reasons.
 */
export type ArchiveProblem =
  | { code: 'notZip' }
  | { code: 'tooManyFiles'; fileCount: number }
  | { code: 'fileListCutShort' }
  | { code: 'damagedFile'; path: string }
  | { code: 'largerThanDeclared'; path: string }
  | { code: 'duplicateFile'; path: string }
  | { code: 'encryptedFile'; path: string }
  | { code: 'unknownCompression'; path: string }
  | { code: 'fileTooLarge'; path: string }
  /** A null path is a name that is not UTF-8. */
  | { code: 'invalidPath'; path: string | null }
  /** A file every game has is missing: the archive is something else. */
  | { code: 'notAGame'; path: string }
  | { code: 'missingFile'; path: string }
  | { code: 'invalidJson'; path: string }
  /** `detail` names the faulty field and what it should be, for whoever made the game. */
  | { code: 'invalidDocument'; path: string; detail: string }
  /** A document written in a format this player does not read yet: updating Datajack plays it. */
  | { code: 'newerFormat'; path: string; detail: string }
  | { code: 'otherChapter'; path: string }
  | { code: 'otherScene'; path: string }
  | { code: 'alteredFile'; path: string }
  | { code: 'newerPlayer' }

export type ArchiveProblemCode = ArchiveProblem['code']

/** An archive refused; its message is the English sentence. */
export class ArchiveError extends Error {
  constructor(readonly problem: ArchiveProblem) {
    super(englishMessage(problem))
    this.name = 'ArchiveError'
  }

  get code(): ArchiveProblemCode {
    return this.problem.code
  }
}

function englishMessage(problem: ArchiveProblem): string {
  switch (problem.code) {
    case 'notZip':
      return 'This file is not a ZIP archive'
    case 'tooManyFiles':
      return `The archive holds too many files (${problem.fileCount})`
    case 'fileListCutShort':
      return 'The archive is damaged: its file list is cut short'
    case 'damagedFile':
      return `The archive is damaged at ${problem.path}`
    case 'largerThanDeclared':
      return `${problem.path} is larger than it declares`
    case 'duplicateFile':
      return `The archive holds ${problem.path} twice`
    case 'encryptedFile':
      return `${problem.path} is encrypted`
    case 'unknownCompression':
      return `${problem.path} uses a compression method Datajack does not read`
    case 'fileTooLarge':
      return `${problem.path} is too large`
    case 'invalidPath':
      return problem.path === null ? 'Invalid path in archive: not UTF-8' : `Invalid path in archive: ${JSON.stringify(problem.path)}`
    case 'notAGame':
      return `This archive has no ${problem.path}: it is not a Datajack game`
    case 'missingFile':
      return `This archive has no ${problem.path}`
    case 'invalidJson':
      return `${problem.path} is not valid JSON`
    case 'invalidDocument':
    case 'newerFormat':
      return `${problem.path} is invalid: ${problem.detail}`
    case 'otherChapter':
      return `${problem.path} holds another chapter`
    case 'otherScene':
      return `${problem.path} holds another scene`
    case 'alteredFile':
      return `${problem.path} is not the file the game was exported with: the archive was altered or damaged`
    case 'newerPlayer':
      return 'This game was made for a newer Datajack: download the latest one'
  }
}
