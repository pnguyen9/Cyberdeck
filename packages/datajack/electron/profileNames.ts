/** Shared by the desktop files and the browser storage, so that both refuse the same names. */
export const MAXIMUM_PROFILE_NAME_LENGTH = 40

/** The name trimmed; throws when it is blank, too long, or already taken whatever the case. */
export function checkedProfileName(name: string, otherNames: readonly string[]): string {
  const trimmedName = name.trim()
  if (trimmedName === '' || trimmedName.length > MAXIMUM_PROFILE_NAME_LENGTH) {
    throw new Error(`A profile name needs 1 to ${MAXIMUM_PROFILE_NAME_LENGTH} characters.`)
  }
  if (otherNames.some(otherName => otherName.toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) {
    throw new Error(`Another profile is already named ${trimmedName}.`)
  }
  return trimmedName
}
