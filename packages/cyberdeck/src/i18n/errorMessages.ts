import type { Locale } from '@cyberdeck/stage'

/** What goes wrong in a way the author can do something about. */
const en = {
  projectWithoutName: 'A project needs a name',
  coverNotAnImage: (fileName: string) => `${fileName}: a cover must be a PNG, JPEG, WebP, AVIF, GIF or SVG image`,
  cssTooLong: (maximumLength: number) => `The CSS is too long: at most ${maximumLength.toLocaleString('en')} characters.`,
  storageRefused: 'The browser refused to store projects',
  saveFailed: 'The browser could not save the project',
  fileMissing: (assetId: string) => `The file ${assetId} is missing`,
}

export type ErrorMessages = typeof en

const fr: ErrorMessages = {
  projectWithoutName: 'Un projet a besoin d’un nom',
  coverNotAnImage: fileName => `${fileName} : une couverture doit être une image PNG, JPEG, WebP, AVIF, GIF ou SVG`,
  cssTooLong: maximumLength => `Le CSS est trop long : ${maximumLength.toLocaleString('fr')} caractères au plus.`,
  storageRefused: 'Le navigateur refuse de stocker les projets',
  saveFailed: 'Le navigateur n’a pas pu enregistrer le projet',
  fileMissing: assetId => `Le fichier ${assetId} est introuvable`,
}

export const errorMessages = { en, fr }

/** An error said in the author's language: its English message is what code and tests see. */
export class AuthorError extends Error {
  constructor(readonly describe: (messages: ErrorMessages) => string) {
    super(describe(en))
  }
}

/** What an error caught says to the author. */
export function errorText(error: unknown, locale: Locale): string {
  if (error instanceof AuthorError) {
    return error.describe(errorMessages[locale])
  }
  return error instanceof Error ? error.message : String(error)
}
