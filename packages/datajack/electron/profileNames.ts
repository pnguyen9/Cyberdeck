/** Shared by the desktop files and the browser storage, so that both refuse the same names. */
export const MAXIMUM_PROFILE_NAME_LENGTH = 40

/** Why a name is refused: blank or too long, or already taken whatever the case. */
export type ProfileNameProblem = 'length' | 'taken'

/** What is wrong with a name once trimmed, for the page to say it in the player's language; null when nothing. */
export function profileNameProblem(name: string, otherNames: readonly string[]): ProfileNameProblem | null {
  const trimmedName = name.trim()
  if (trimmedName === '' || trimmedName.length > MAXIMUM_PROFILE_NAME_LENGTH) {
    return 'length'
  }
  if (otherNames.some(otherName => otherName.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
    return 'taken'
  }
  return null
}

/** The name trimmed; throws when it is blank, too long, or already taken whatever the case. */
export function checkedProfileName(name: string, otherNames: readonly string[]): string {
  const trimmedName = name.trim()
  switch (profileNameProblem(name, otherNames)) {
    case 'length':
      throw new Error(`A profile name needs 1 to ${MAXIMUM_PROFILE_NAME_LENGTH} characters.`)
    case 'taken':
      throw new Error(`Another profile is already named ${trimmedName}.`)
    case null:
      return trimmedName
  }
}
