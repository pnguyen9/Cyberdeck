import { languageCode, languageName } from '@cyberdeck/core'

/** The two-letter codes of ISO 639-1: the languages offered when picking the one a story is written in. */
const LANGUAGE_CODES = ('aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu '
  + 'fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw '
  + 'ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa '
  + 'sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu').split(' ')

/** A language as the editor names it: in the editor's language, then in its own when that differs, then its code; nothing for none. */
export function languageLabel(code: string, editorLocale: string): string {
  if (code === '') {
    return ''
  }
  const inEditor = languageName(code, editorLocale) ?? code
  const inItself = languageName(code, code) ?? code
  return inItself.toLowerCase() === inEditor.toLowerCase() ? `${inItself} (${code})` : `${inEditor} — ${inItself} (${code})`
}

/** Every language offered, named for the editor, in the alphabetical order of those names. */
export function languageChoices(editorLocale: string): { code: string; label: string }[] {
  return LANGUAGE_CODES.map(code => ({ code, label: languageLabel(code, editorLocale) }))
    .sort((first, second) => first.label.localeCompare(second.label, editorLocale))
}

/** The language a picker's text names: a label chosen, `(es)` at its end, or a code typed in full. */
export function languageOfPicked(text: string): string | null {
  const labelled = /\(([A-Za-z0-9-]+)\)\s*$/.exec(text)
  return languageCode(labelled?.[1] ?? text)
}
