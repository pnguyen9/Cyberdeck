/** The choice of a language. */
const en = {
  language: 'Language',
  system: 'System',
}

type LanguageMessages = typeof en

const fr: LanguageMessages = {
  language: 'Langue',
  system: 'Langue du système',
}

export const languageMessages = { en, fr }
