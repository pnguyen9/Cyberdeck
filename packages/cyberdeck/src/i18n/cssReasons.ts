import type { LeftOut, LeftOutReason } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'

/** Why a part of the CSS is left out, in the editor's language: core gives the English. */
export function cssReasonText(entry: LeftOut, locale: Locale): string {
  return locale === 'fr' ? frenchReason(entry.why) : entry.reason
}

function frenchReason(why: LeftOutReason): string {
  switch (why.code) {
    case 'keyframesName':
      return 'un nom de keyframes se compose de lettres, de chiffres, de tirets et de tirets bas'
    case 'keyframeStep':
      return 'une étape de keyframes est from, to ou un pourcentage'
    case 'classNamesOnly':
      return 'seuls des noms de classes sont stylés ici\u00a0: .ghost, ou .ghost, .whisper'
    case 'notARule':
      return 'pas une règle\u00a0: un nom de classe, puis ses propriétés entre accolades'
    case 'braceNotClosed':
      return 'une accolade n’est jamais fermée'
    case 'nameAndValue':
      return 'une propriété s’écrit nom: valeur'
    case 'notHowTextLooks':
      return 'pas une propriété de l’apparence du texte'
    case 'loadsOrComputes':
      return 'rien ne peut être chargé ni calculé\u00a0: ni url(), ni var(), ni attr(), ni @, ni \\, ni guillemets, sauf autour des noms de police'
    case 'inlineOnly':
      return 'le texte reste dans sa ligne\u00a0: display vaut inline ou inline-block'
    case 'fontSize':
      return `font-size en em ou en %, ${why.maximum}em au plus, pour que le texte tienne dans la zone`
    case 'spacingUnit':
      return `${why.property} en em ou en px, pour que les pages soient découpées à la bonne longueur`
    case 'edgeSize':
      return `${why.edge === 'borders' ? 'bordures' : 'padding'} en em ou en px, ${why.maximum}em au plus, pour que le texte tienne dans sa ligne`
  }
}
