import type { LeftOut, LeftOutReason } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'

/** Why a part of the CSS is left out, in the editor's language: core gives the English. */
export function cssReasonText(entry: LeftOut, locale: Locale): string {
  return locale === 'fr' ? frenchReason(entry.why) : entry.reason
}

function frenchReason(why: LeftOutReason): string {
  switch (why.code) {
    case 'keyframesName':
      return 'un nom de keyframes ne contient que des lettres, des chiffres, des tirets et des tirets bas'
    case 'keyframeStep':
      return 'une étape de keyframes s’écrit from, to ou en pourcentage'
    case 'classNamesOnly':
      return 'seuls des noms de classe sont acceptés ici\u00a0: .ghost, ou .ghost, .whisper'
    case 'notARule':
      return 'ce n’est pas une règle\u00a0: il faut un nom de classe, puis ses propriétés entre accolades'
    case 'braceNotClosed':
      return 'une accolade n’est jamais fermée'
    case 'nameAndValue':
      return 'une propriété s’écrit nom: valeur'
    case 'notHowTextLooks':
      return 'cette propriété ne concerne pas l’apparence du texte'
    case 'loadsOrComputes':
      return 'rien ne peut être chargé ni calculé\u00a0: pas de url(), var(), attr(), @, \\ ni de guillemets, sauf autour des noms de police'
    case 'inlineOnly':
      return 'le texte doit rester dans sa ligne\u00a0: display vaut inline ou inline-block'
    case 'fontSize':
      return `font-size en em ou en %, ${why.maximum}em au plus, pour que le texte tienne dans la zone de texte`
    case 'spacingUnit':
      return `${why.property} en em ou en px, pour que les pages soient découpées à la bonne longueur`
    case 'edgeSize':
      return `${why.edge === 'borders' ? 'bordures' : 'padding'} en em ou en px, ${why.maximum}em au plus, pour que le texte tienne dans sa ligne`
  }
}
