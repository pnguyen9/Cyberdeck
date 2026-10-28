import { localeOf, type Locale } from './locale'

/** The words the player shows as part of the game, at its end: in the game's language, whoever plays it. */
const en = {
  theEnd: 'The end.',
  endingsReached: (reached: number, total: number) => `Endings reached: ${reached} of ${total}`,
}

type StoryMessages = typeof en

const fr: StoryMessages = {
  theEnd: 'Fin.',
  endingsReached: (reached, total) => `Fins atteintes : ${reached} sur ${total}`,
}

export const storyMessages = { en, fr }

/** The language a game is written in, English when it is one we do not speak. */
export function storyLocale(project: { locale: string }): Locale {
  return localeOf(project.locale) ?? 'en'
}
