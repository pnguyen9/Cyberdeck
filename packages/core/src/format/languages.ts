import type { ChapterDocument, ChapterTranslation, Ending, ProjectDocument } from './storyFormat'

/**
 * A story in several languages: one structure, its chapters in order, its scenes and its names, and
 * each language a set of texts laid over it. A chapter document holds its text in the project's first
 * language, and the others in `translations`; whatever reads a chapter reads it in one language, through
 * `chapterIn`. A chapter a language has no text for yet is hollow in it, its title standing in.
 */

const namers = new Map<string, Intl.DisplayNames>()

/** A language's name in another language (`fr` in `en`: French), or null when the browser has none for it. */
export function languageName(code: string, inLanguage: string): string | null {
  let namer = namers.get(inLanguage)
  if (namer === undefined) {
    namer = new Intl.DisplayNames([inLanguage], { type: 'language', fallback: 'none' })
    namers.set(inLanguage, namer)
  }
  return namer.of(code) ?? null
}

/** A language as a standard code, written as the standard writes it (`pt-BR`), or null when it names none. */
export function languageCode(text: string): string | null {
  let locale: Intl.Locale
  try {
    locale = new Intl.Locale(text.trim())
  } catch {
    return null
  }
  // Language, script and region only: what names a language a story is written in, nothing more.
  const { language, region } = locale
  if (NOT_LANGUAGES.has(language) || languageName(language, 'en') === null) {
    return null
  }
  if (region !== undefined && regionNamer.of(region) === undefined) {
    return null
  }
  return [language, locale.script, region].filter(part => part !== undefined).join('-')
}

/** Codes that are well formed but name no language a story could be in: none, several, undetermined. */
const NOT_LANGUAGES: ReadonlySet<string> = new Set(['zxx', 'mul', 'und', 'mis'])
const regionNamer = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })

/** The languages of a project, the first one first: the one it was started in. */
export function languagesOf(project: ProjectDocument): readonly string[] {
  return project.languages.length === 0 ? [project.locale] : project.languages
}

/** The story's first language, which its chapters' own text is in. */
export function firstLanguageOf(project: ProjectDocument): string {
  return languagesOf(project)[0]!
}

/** A chapter or a scene as read in one language: its title, pages and source in it; `hollow` when it has none yet. */
export interface ChapterView extends ChapterDocument {
  language: string
}

/** The chapter in a language: its text in it, or hollow, the title it has standing in. */
export function chapterIn(chapter: ChapterDocument, language: string, project: ProjectDocument): ChapterView {
  const { translations, hollow, importedFrom, ...shared } = chapter
  const hollowView: ChapterView = { ...shared, nodes: [], language, hollow: true }
  if (language === firstLanguageOf(project)) {
    return hollow === true ? hollowView : { ...shared, ...(importedFrom === undefined ? {} : { importedFrom }), language }
  }
  // A translation with no page yet, one only renamed, is not written yet either: its title stands in.
  const translation = translations?.[language]
  if (translation === undefined || translation.nodes.length === 0) {
    return translation === undefined ? hollowView : { ...hollowView, title: translation.title }
  }
  return { ...shared, title: translation.title, nodes: translation.nodes, ...(translation.importedFrom === undefined ? {} : { importedFrom: translation.importedFrom }), language }
}

/**
 * The stored chapter with the text of a view put back in its language, the other languages kept; a
 * chapter new to the story, made from a language other than the first, is hollow in the first.
 */
export function withTextOf(stored: ChapterDocument | undefined, view: ChapterDocument & { language?: string }, project: ProjectDocument): ChapterDocument {
  const first = firstLanguageOf(project)
  const language = view.language ?? first
  const text: ChapterTranslation = { title: view.title, nodes: view.nodes, ...(view.importedFrom === undefined ? {} : { importedFrom: view.importedFrom }) }
  const base: ChapterDocument = stored ?? {
    formatVersion: view.formatVersion,
    id: view.id,
    title: view.title,
    nodes: [],
    ...(view.condition === undefined ? {} : { condition: view.condition }),
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
    hollow: true,
  }
  const { condition: _condition, hollow, importedFrom, translations, ...rest } = base
  const shared = { ...rest, ...(view.condition === undefined ? {} : { condition: view.condition }), updatedAt: view.updatedAt }
  if (language === first) {
    // A hollow chapter renamed, or given a condition, has still no text of its own.
    const isStillHollow = hollow === true && view.nodes.length === 0
    return { ...shared, ...text, ...(isStillHollow ? { hollow: true } : {}), ...(translations === undefined ? {} : { translations }) }
  }
  return {
    ...shared,
    ...(hollow === true ? { hollow } : {}),
    ...(importedFrom === undefined ? {} : { importedFrom }),
    translations: { ...translations, [language]: text },
  }
}

/** The name players read of an ending, in a language: its translation, or the name the story knows it by. */
function endingNameIn(ending: Ending, language: string): string {
  return ending.translations?.[language] ?? ending.name
}

/**
 * The project as a player reads it in a language: that language for cutting sentences and reading
 * aloud, the names of the endings in it. For playing only: never stored.
 */
export function projectIn(project: ProjectDocument, language: string): ProjectDocument {
  return { ...project, locale: language, endings: project.endings.map(ending => ({ ...ending, name: endingNameIn(ending, language) })) }
}
