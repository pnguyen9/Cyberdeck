import type { ImportProblem, ImportProblemCode } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'

/** What each stage directive accepts, for a directive written so that it cannot be read. */
const STAGE_DIRECTIVE_HINTS: Readonly<Record<string, string>> = {
  bg: 'it takes the name of a background',
  background: 'it takes the name of a background',
  music: 'it takes the name of a track, or stop',
  sound: 'it takes the name of a sound',
  voice: 'it takes the name of the sound of the line',
  video: 'it takes the name of a video',
  transition: 'it takes fade, black or white, and a duration if wished (1.5s)',
  enter: 'it takes a name, then a position (left, center, right, or 35%), an expression, near or far, an animation, a duration',
  exit: 'it takes a name, then an animation and a duration if wished',
  move: 'it takes a name, then a position, near or far, or both',
  wait: 'it takes a number of seconds',
  shake: 'it takes strong and a duration (0.4s), or nothing',
  flash: 'it takes white, red or black and a duration, or nothing',
  'fade out': 'it takes black or white and a duration, or nothing',
  'fade in': 'it takes a duration, or nothing',
  tint: 'it takes sepia, night, grey or none',
  text: 'it takes full or box',
  clear: 'it takes nothing',
  illustration: 'it takes the name of an illustration, or none',
  cg: 'it takes the name of an illustration, or none',
}

type ProblemMessages = Record<ImportProblemCode, (subject: string, suggestion: string) => string>

const en: ProblemMessages = {
  unknownImportKind: subject => `"${subject}" is not a kind of import: use story, chapter or pages.`,
  misplacedImportKind: () => '[import: …] must be on the first line.',
  emptyDirective: () => 'Empty brackets: write a directive inside, or remove them.',
  unclosedBracket: () => 'A bracket [ is never closed.',
  emptyDialogue: subject => subject === '' ? 'Dialogue with no text.' : `${subject} says nothing.`,
  controlDirectiveWithText: subject => `[${subject}] must be alone on its line.`,
  invalidDecision: subject => `"${subject}" should look like: Name = Value | Other value.`,
  missingDecisionName: () => '[choice] needs the name of a decision: [choice: Answer].',
  optionOutsideChoice: () => 'This option (>) does not follow a [choice].',
  emptyOption: () => 'This option has no text.',
  emptyChoice: subject => `The choice "${subject}" has no options (lines starting with >).`,
  invalidCondition: subject => `"${subject}" should look like: Decision is Value.`,
  elseWithoutIf: () => 'This [else] has no [if] before it.',
  endWithoutIf: () => 'This [end] has no [if] or [loop] before it.',
  everyOptionConditional: () => 'Every option of this choice has a condition: when none holds, the choice is skipped. An option always offered, such as leaving, rules that out.',
  invalidStyle: subject => `"${subject}" is not something a style can be: write [style: Whisper = italic, small, grey] with italic, bold, small, large, grey, red, blue, green, gold or shaking.`,
  styleWithoutText: () => 'A style applies to text: write [style: …] before the words, on the same line.',
  unknownStyle: subject => `No style is called "${subject}": declare it first, [style: ${subject} = italic], or use a property alone, such as [style: italic].`,
  duplicateStyle: (subject, suggestion) => suggestion === ''
    ? `The style "${subject}" is declared twice.`
    : `The style "${subject}" is already declared in ${suggestion}: change it there, or move it to Definitions first.`,
  branchAfterElse: () => 'This branch comes after [else]: it would never be played. Put it before the [else], or start a new [if].',
  onlyIfMisplaced: () => '[only if: …] goes right under a chapter heading, once: it decides whether the whole chapter is played. A scene has none: it plays when asked.',
  missingSceneName: () => 'A scene needs a name: # Scene: Caught, and [play: Caught] to play it.',
  unknownScene: subject => `No scene is called "${subject}": write it under a heading "# Scene: ${subject}".`,
  duplicateScene: subject => `There is already a scene called "${subject}" in this text.`,
  sceneCallsItself: subject => `Playing "${subject}" here would come back to this scene, and so on for ever.`,
  breakOutsideLoop: () => 'This [break] is not inside a [loop]: there is nothing to leave.',
  unclosedLoop: () => 'This [loop] is never closed with [end].',
  endlessLoop: () => 'This loop never stops: nothing inside leaves it. Add a [break], in a branch the player can reach, or an [ending].',
  unclosedIf: () => 'This [if] is never closed with [end].',
  invalidSet: subject => `"${subject}" should look like: Decision = Value.`,
  invalidUnset: subject => `"${subject}" should look like: Decision = Value, or the decision alone to take every value away.`,
  noJumps: subject => `There is no [${subject}]: what plays only sometimes goes in an [if] … [end] block, what repeats in a [loop] … [end].`,
  missingEndingName: () => 'An ending needs a name: [ending: The Empty Room].',
  unreachable: () => 'Never reached: every path before it ends, at an [ending] or in a block whose branches, [else] included, all end.',
  dashWithoutSpeaker: () => 'A dash opens dialogue only with a name, “— Marie: …” (“— ???: …” for an unknown voice): this line is read as narration.',
  speakerWithoutDash: subject => `For ${subject} to speak, start the line with a dash: “— ${subject}: …”. Without it, the line is read as narration.`,
  chapterHeadingInEdit: () => 'A page cannot start a chapter: add one with New chapter, in the Chapters tab, or import a text.',
  missingMemoryName: () => 'Something to remember needs a name: [remember: The ghost\'s name].',
  unknownEnding: subject => `No [ending: ${subject}] anywhere in the story: is the name misspelt?`,
  unknownMemory: subject => `Nothing is ever remembered as “${subject}”: add [remember: ${subject}] where the player learns it, or check the spelling.`,
  unknownDecision: subject => `No decision is called "${subject}".`,
  unknownDecisionValue: subject => `"${subject}": this decision has no such value.`,
  duplicateDecision: (subject, suggestion) => suggestion === ''
    ? `The decision "${subject}" is declared twice.`
    : `The decision "${subject}" is already declared in ${suggestion}: change it there, or move it to Definitions first.`,
  invalidCounter: subject => `"${subject}" should look like: Name = 0, a whole number, or the name alone to start at 0.`,
  invalidAdd: subject => subject === '' ? '[add: …] needs the name of a counter, and an amount if not 1: [add: Trust 2], [add: Trust -1].' : `"${subject}" should look like: Counter 2, Counter -1, or the counter alone to add 1.`,
  unknownCounter: subject => `No counter is called "${subject}": declare it with [counter: ${subject}], or count with [add: ${subject}].`,
  counterNeedsNumber: subject => {
    const [counter, value] = subject.split(': ')
    return `${counter} is a counter: it holds whole numbers, not "${value}".`
  },
  duplicateCounter: (subject, suggestion) => suggestion === ''
    ? `The counter "${subject}" is declared twice.`
    : `The counter "${subject}" is already declared in ${suggestion}: change it there, or move it to Definitions first.`,
  counterNamedLikeDecision: subject => `"${subject}" is both a counter and a decision: give one of them another name.`,
  unsetCounter: subject => `${subject} is a counter: [unset] takes values away from decisions. To start it over, write [set: ${subject} = 0].`,
  invalidAsk: subject => subject === ''
    ? '[ask: …] needs the name to ask for, one word, and a default if wished: [ask: Hero = Alex].'
    : `"${subject}" should look like: Hero, or Hero = Alex; the name one word, the default at most 12 characters.`,
  unknownAskedName: subject => `Nothing asks the player for {${subject}}: add [ask: ${subject}] where they give it, or check the spelling.`,
  timedChoiceWithoutTimeout: subject => `The timed choice ${subject} needs an option for when time runs out: add one ending with [timeout].`,
  timeoutWithoutTime: subject => `[timeout] marks what happens when time runs out, but the choice ${subject} has no time: write it after its name, [choice: ${subject} 10s].`,
  severalTimeouts: subject => `The choice ${subject} has more than one option for when time runs out: keep one [timeout].`,
  timeoutOutsideOption: () => '[timeout] belongs on an option of a timed choice: > … = Silent [timeout].',
  decisionValueStillUsed: subject => {
    const [decision, value] = subject.split(': ')
    return `"${value}" is still used elsewhere as a value of ${decision}: keep it in the list, or change those places first (the Index shows them).`
  },
  definitionStillUsed: subject => `"${subject}" is still used in the story: it cannot be taken out of the definitions.`,
  notADefinition: () => 'Only declarations belong here: [decision: …], [decision multi: …], [counter: …] and [style: Name = …].',
  invalidStageDirective: subject => `[${subject}: …] is not understood: ${STAGE_DIRECTIVE_HINTS[subject] ?? 'a name, a position (left, center, right) or a number is missing'}.`,
  looksLikeStageKeyword: (subject, suggestion) => `[${subject}] would create a character called "${subject}". Did you mean [${suggestion}]?`,
}

const STAGE_DIRECTIVE_HINTS_FR: Readonly<Record<string, string>> = {
  bg: 'il attend le nom d’un décor',
  background: 'il attend le nom d’un décor',
  music: 'il attend le nom d’une musique, ou stop',
  sound: 'il attend le nom d’un son',
  voice: 'il attend le nom du son de la réplique',
  video: 'il attend le nom d’une vidéo',
  transition: 'il attend fade, black ou white, et une durée si besoin (1.5s)',
  enter: 'il attend un nom, puis une position (left, center, right, ou 35%), une expression, near ou far, une animation, une durée',
  exit: 'il attend un nom, puis une animation et une durée si besoin',
  move: 'il attend un nom, puis une position, near ou far, ou les deux',
  wait: 'il attend un nombre de secondes',
  shake: 'il attend strong et une durée (0.4s), ou rien',
  flash: 'il attend white, red ou black et une durée, ou rien',
  'fade out': 'il attend black ou white et une durée, ou rien',
  'fade in': 'il attend une durée, ou rien',
  tint: 'il attend sepia, night, grey ou none',
  text: 'il attend full ou box',
  clear: 'il n’attend rien',
  illustration: 'il attend le nom d’une illustration, ou none',
  cg: 'il attend le nom d’une illustration, ou none',
}

/** A name or text the author wrote, quoted as French quotes it. */
const quoted = (text: string) => `«\u00a0${text}\u00a0»`

const fr: ProblemMessages = {
  unknownImportKind: subject => `${quoted(subject)} n’est pas un type d’import\u00a0: utilisez story, chapter ou pages.`,
  misplacedImportKind: () => '[import: …] doit être sur la première ligne.',
  emptyDirective: () => 'Crochets vides\u00a0: écrivez une directive à l’intérieur, ou retirez-les.',
  unclosedBracket: () => 'Un crochet [ n’est jamais fermé.',
  emptyDialogue: subject => subject === '' ? 'Réplique sans texte.' : `${subject} ne dit rien.`,
  controlDirectiveWithText: subject => `[${subject}] doit être seul sur sa ligne.`,
  invalidDecision: subject => `${quoted(subject)} devrait avoir cette forme\u00a0: Nom = Valeur | Autre valeur.`,
  missingDecisionName: () => '[choice] a besoin du nom d’une décision\u00a0: [choice: Réponse].',
  optionOutsideChoice: () => 'Cette option (>) ne suit pas un [choice].',
  emptyOption: () => 'Cette option n’a pas de texte.',
  emptyChoice: subject => `Le choix ${quoted(subject)} n’a pas d’options (lignes commençant par >).`,
  invalidCondition: subject => `${quoted(subject)} devrait avoir cette forme\u00a0: Décision is Valeur.`,
  elseWithoutIf: () => 'Ce [else] n’a pas de [if] avant lui.',
  endWithoutIf: () => 'Ce [end] n’a ni [if] ni [loop] avant lui.',
  everyOptionConditional: () => 'Chaque option de ce choix a une condition\u00a0: quand aucune n’est remplie, le choix est sauté. Ajoutez une option toujours proposée, «\u00a0Partir\u00a0» par exemple, pour l’éviter.',
  invalidStyle: subject => `${quoted(subject)} n’est pas une valeur possible pour un style\u00a0: écrivez [style: Murmure = italic, small, grey] avec italic, bold, small, large, grey, red, blue, green, gold ou shaking.`,
  styleWithoutText: () => 'Un style s’applique à du texte\u00a0: écrivez [style: …] avant les mots, sur la même ligne.',
  unknownStyle: subject => `Aucun style ne s’appelle ${quoted(subject)}\u00a0: déclarez-le d’abord, [style: ${subject} = italic], ou utilisez une propriété seule, comme [style: italic].`,
  duplicateStyle: (subject, suggestion) => suggestion === ''
    ? `Le style ${quoted(subject)} est déclaré deux fois.`
    : `Le style ${quoted(subject)} est déjà déclaré dans ${suggestion}\u00a0: modifiez-le là-bas, ou déplacez-le d’abord dans Définitions.`,
  branchAfterElse: () => 'Cette branche vient après [else]\u00a0: elle ne serait jamais jouée. Placez-la avant le [else], ou commencez un nouveau [if].',
  onlyIfMisplaced: () => '[only if: …] se place juste sous un titre de chapitre, une seule fois\u00a0: il décide si tout le chapitre est joué. Une scène n’en a pas\u00a0: elle est jouée quand on l’appelle.',
  missingSceneName: () => 'Une scène a besoin d’un nom\u00a0: # Scene: Surpris, et [play: Surpris] pour la jouer.',
  unknownScene: subject => `Aucune scène ne s’appelle ${quoted(subject)}\u00a0: écrivez-la sous un titre ${quoted(`# Scene: ${subject}`)}.`,
  duplicateScene: subject => `Il y a déjà une scène appelée ${quoted(subject)} dans ce texte.`,
  sceneCallsItself: subject => `Jouer ${quoted(subject)} ici ramènerait à cette scène, et ainsi de suite sans fin.`,
  breakOutsideLoop: () => 'Ce [break] n’est dans aucun [loop]\u00a0: il n’y a rien à quitter.',
  unclosedLoop: () => 'Ce [loop] n’est jamais fermé par [end].',
  endlessLoop: () => 'Cette boucle ne s’arrête jamais\u00a0: rien à l’intérieur n’en sort. Ajoutez un [break], dans une branche que le joueur peut atteindre, ou un [ending].',
  unclosedIf: () => 'Ce [if] n’est jamais fermé par [end].',
  invalidSet: subject => `${quoted(subject)} devrait avoir cette forme\u00a0: Décision = Valeur.`,
  invalidUnset: subject => `${quoted(subject)} devrait avoir cette forme\u00a0: Décision = Valeur, ou la décision seule pour lui retirer toutes ses valeurs.`,
  noJumps: subject => `[${subject}] n’existe pas\u00a0: ce qui n’est joué que parfois va dans un bloc [if] … [end], ce qui se répète dans un [loop] … [end].`,
  missingEndingName: () => 'Une fin a besoin d’un nom\u00a0: [ending: La Chambre vide].',
  unreachable: () => 'Jamais atteint\u00a0: tous les parcours s’arrêtent avant, sur un [ending] ou dans un bloc dont toutes les branches, [else] compris, se terminent.',
  dashWithoutSpeaker: () => `Un tiret n’ouvre une réplique qu’avec un nom, ${quoted('— Marie\u00a0: …')} (${quoted('— ???\u00a0: …')} pour une voix inconnue)\u00a0: cette ligne est lue comme de la narration.`,
  speakerWithoutDash: subject => `Pour que ${subject} parle, commencez la ligne par un tiret\u00a0: ${quoted(`— ${subject}\u00a0: …`)}. Sans lui, la ligne est lue comme de la narration.`,
  chapterHeadingInEdit: () => 'Une page ne peut pas commencer un chapitre\u00a0: ajoutez-en un avec Nouveau chapitre, dans l’onglet Chapitres, ou importez un texte.',
  missingMemoryName: () => 'Un souvenir a besoin d’un nom\u00a0: [remember: Le nom du fantôme].',
  unknownEnding: subject => `Aucun [ending: ${subject}] dans toute l’histoire\u00a0: le nom est-il mal orthographié\u00a0?`,
  unknownMemory: subject => `Rien n’est jamais retenu sous le nom ${quoted(subject)}\u00a0: ajoutez [remember: ${subject}] là où le joueur l’apprend, ou vérifiez l’orthographe.`,
  unknownDecision: subject => `Aucune décision ne s’appelle ${quoted(subject)}.`,
  unknownDecisionValue: subject => `${quoted(subject)}\u00a0: cette décision n’a pas cette valeur.`,
  duplicateDecision: (subject, suggestion) => suggestion === ''
    ? `La décision ${quoted(subject)} est déclarée deux fois.`
    : `La décision ${quoted(subject)} est déjà déclarée dans ${suggestion}\u00a0: modifiez-la là-bas, ou déplacez-la d’abord dans Définitions.`,
  invalidCounter: subject => `${quoted(subject)} devrait avoir cette forme\u00a0: Nom = 0, un nombre entier, ou le nom seul pour commencer à 0.`,
  invalidAdd: subject => subject === '' ? '[add: …] attend le nom d’un compteur, et le nombre à ajouter, si ce n’est pas 1\u00a0: [add: Confiance 2], [add: Confiance -1].' : `${quoted(subject)} devrait avoir cette forme\u00a0: Compteur 2, Compteur -1, ou le compteur seul pour ajouter 1.`,
  unknownCounter: subject => `Aucun compteur ne s’appelle ${quoted(subject)}\u00a0: déclarez-le avec [counter: ${subject}], ou comptez avec [add: ${subject}].`,
  counterNeedsNumber: subject => {
    const [counter, value] = subject.split(': ')
    return `${counter} est un compteur\u00a0: il contient des nombres entiers, pas ${quoted(value ?? '')}.`
  },
  duplicateCounter: (subject, suggestion) => suggestion === ''
    ? `Le compteur ${quoted(subject)} est déclaré deux fois.`
    : `Le compteur ${quoted(subject)} est déjà déclaré dans ${suggestion}\u00a0: modifiez-le là-bas, ou déplacez-le d’abord dans Définitions.`,
  counterNamedLikeDecision: subject => `${quoted(subject)} est à la fois un compteur et une décision\u00a0: renommez l’un des deux.`,
  unsetCounter: subject => `${subject} est un compteur\u00a0: [unset] retire des valeurs aux décisions. Pour le remettre à zéro, écrivez [set: ${subject} = 0].`,
  invalidAsk: subject => subject === ''
    ? '[ask: …] attend le nom à demander, en un seul mot, et une valeur par défaut si besoin\u00a0: [ask: Héros = Alex].'
    : `${quoted(subject)} devrait avoir cette forme\u00a0: Héros, ou Héros = Alex\u00a0; le nom en un seul mot, la valeur par défaut en 12 caractères au plus.`,
  unknownAskedName: subject => `Rien ne demande {${subject}} au joueur\u00a0: ajoutez [ask: ${subject}] là où il le donne, ou vérifiez l’orthographe.`,
  timedChoiceWithoutTimeout: subject => `Le choix minuté ${subject} a besoin d’une option pour quand le temps est écoulé\u00a0: ajoutez-en une qui se termine par [timeout].`,
  timeoutWithoutTime: subject => `[timeout] indique ce qui se passe quand le temps est écoulé, mais le choix ${subject} n’a pas de durée\u00a0: écrivez-la après son nom, [choice: ${subject} 10s].`,
  severalTimeouts: subject => `Le choix ${subject} a plusieurs options pour quand le temps est écoulé\u00a0: n’en gardez qu’une avec [timeout].`,
  timeoutOutsideOption: () => '[timeout] se place sur une option d’un choix minuté\u00a0: > … = Silence [timeout].',
  decisionValueStillUsed: subject => {
    const [decision, value] = subject.split(': ')
    return `${quoted(value ?? '')} est encore utilisée ailleurs comme valeur de ${decision}\u00a0: gardez-la dans la liste, ou modifiez d’abord ces endroits (l’Index les montre).`
  },
  definitionStillUsed: subject => `L’histoire utilise encore ${quoted(subject)}\u00a0: impossible de retirer cette définition.`,
  notADefinition: () => 'Seules des déclarations ont leur place ici\u00a0: [decision: …], [decision multi: …], [counter: …] et [style: Nom = …].',
  invalidStageDirective: subject => `[${subject}: …] n’est pas compris\u00a0: ${STAGE_DIRECTIVE_HINTS_FR[subject] ?? 'il manque un nom, une position (left, center, right) ou un nombre'}.`,
  looksLikeStageKeyword: (subject, suggestion) => `[${subject}] créerait un personnage appelé ${quoted(subject)}. Vouliez-vous dire [${suggestion}]\u00a0?`,
}

const MESSAGES: Readonly<Record<Locale, ProblemMessages>> = { en, fr }

export function problemMessage(problem: ImportProblem, locale: Locale = 'en'): string {
  return MESSAGES[locale][problem.code](problem.subject ?? '', problem.suggestion ?? '')
}
