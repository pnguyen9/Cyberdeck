import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'

/** The languages Cyberdeck and Datajack are written in. Another is one more table of messages per package. */
export const LOCALES = ['en', 'fr'] as const
export type Locale = typeof LOCALES[number]

/** Each language in its own words, as a menu lists them. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { en: 'English', fr: 'Français' }

/** A language chosen, or the system's. */
export type LanguageChoice = Locale | 'system'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** One of ours for a language tag, `fr-CA` as `fr`; null for one we do not speak. */
export function localeOf(tag: string | null | undefined): Locale | null {
  const language = tag?.toLowerCase().split(/[-_]/)[0]
  return isLocale(language) ? language : null
}

/** The first of the system's languages we speak; English otherwise. */
export function systemLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  for (const language of languages) {
    const locale = localeOf(language)
    if (locale !== null) {
      return locale
    }
  }
  return 'en'
}

export function localeOfChoice(choice: LanguageChoice): Locale {
  return choice === 'system' ? systemLocale() : choice
}

/** The choice as kept in the browser's storage: the system's when missing or unreadable. */
export function readLanguageChoice(getStorage: () => Pick<Storage, 'getItem'>, key: string): LanguageChoice {
  try {
    const stored = getStorage().getItem(key)
    return isLocale(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeLanguageChoice(getStorage: () => Pick<Storage, 'setItem'>, key: string, choice: LanguageChoice) {
  try {
    getStorage().setItem(key, choice)
  } catch {
    // Not kept: the choice holds until the page is closed.
  }
}

const LOCALE: InjectionKey<Readonly<Ref<Locale>>> = Symbol('locale')

/** The language of the screens below: the application's, given once at its root. */
export function provideLocale(locale: Readonly<Ref<Locale>>) {
  provide(LOCALE, locale)
}

export function useLocale(): Readonly<Ref<Locale>> {
  return inject(LOCALE, () => ref(systemLocale()), true)
}

/**
 * The messages of a component, in the language of the screens: each table is an object of the same
 * shape, texts and functions of what they say, which TypeScript holds every language to.
 */
export function useMessages<Messages>(tables: Readonly<Record<Locale, Messages>>): ComputedRef<Messages> {
  const locale = useLocale()
  return computed(() => tables[locale.value])
}
