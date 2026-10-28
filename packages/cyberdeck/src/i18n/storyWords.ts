import { ENGLISH_STORY_WORDS, type StoryWords } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'

/** The words core puts around names and story syntax in places and markers, in each language of the editor. */
export const storyWords: Readonly<Record<Locale, StoryWords>> = {
  en: ENGLISH_STORY_WORDS,
  fr: {
    page: number => `page ${number}`,
    choice: number => `choix ${number}`,
    after: number => `après ${number}`,
    atTheStart: 'au début',
    untitledChapter: 'Chapitre sans titre',
    scene: title => `Scène\u00a0: ${title}`,
    colon: '\u00a0: ',
    several: 'plusieurs',
    startsAt: amount => `commence à ${amount}`,
    fromTheCss: 'depuis le CSS',
    none: 'aucune',
    noMore: value => `plus de ${value}`,
    outOfTheLoop: 'sortie de la boucle',
    repeatsUntilBreak: 'se répète jusqu’à un break',
    loop: 'boucle',
  },
}
