/** The Details tab, and the Export tab. */
const en = {
  saved: 'Saved.',
  intro: 'What players see of the game in their library, before playing it.',
  description: 'Description',
  credits: 'Credits: who wrote, drew and composed, and the licences of borrowed music or art',
  cover: 'Cover',
  coverAlt: 'The cover',
  noCover: 'No cover',
  chooseCover: 'Choose a cover…',
  removeCover: 'Remove the cover',
  coverRatio: 'Shown at 16:9 in the library.',
  coverChanged: 'The cover was changed.',
  coverRemoved: 'The cover was removed.',
  exportIntro: 'The archive players add to Datajack. Export the whole game, or only some chapters for an update: each archive carries the files its chapters use, the cover and the details.',
  release: 'Release, as players will see it',
  chapters: 'Chapters',
  noChapters: 'No chapters yet.',
  scenesToo: (count: number, names: string) => `Every archive carries the ${count === 1 ? 'scene' : `${count} scenes`} too (${names}): any chapter may play them.`,
  export: 'Export',
  asText: 'As text',
  asTextIntro: 'The story in the syntax it was written in, with every change made here: to edit it in Word or any text editor, then import it again, as a new project or chapter by chapter.',
  exportStoryText: 'Export the story as text',
}

type DetailsMessages = typeof en

const fr: DetailsMessages = {
  saved: 'Enregistré.',
  intro: 'Ce que les joueurs voient de votre jeu dans leur bibliothèque, avant même d’y jouer.',
  description: 'Description',
  credits: 'Crédits : qui a écrit, dessiné et composé, et les licences des musiques ou des images empruntées',
  cover: 'Couverture',
  coverAlt: 'La couverture',
  noCover: 'Pas de couverture',
  chooseCover: 'Choisir une couverture…',
  removeCover: 'Retirer la couverture',
  coverRatio: 'Affichée en 16:9 dans la bibliothèque.',
  coverChanged: 'La couverture a été changée.',
  coverRemoved: 'La couverture a été retirée.',
  exportIntro: 'L’archive que les joueurs ajoutent à Datajack. Exportez le jeu entier, ou seulement quelques chapitres pour une mise à jour : chaque archive contient les fichiers dont ses chapitres ont besoin, ainsi que la couverture et les détails.',
  release: 'Version affichée aux joueurs',
  chapters: 'Chapitres',
  noChapters: 'Pas encore de chapitre.',
  scenesToo: (count, names) => count <= 1
    ? `Chaque archive contient aussi la scène ${names}, que n’importe quel chapitre peut jouer.`
    : `Chaque archive contient aussi les ${count} scènes (${names}), que n’importe quel chapitre peut jouer.`,
  export: 'Exporter',
  asText: 'En texte',
  asTextIntro: 'L’histoire réécrite dans sa syntaxe d’origine, avec toutes les modifications faites ici : retravaillez-la dans Word ou dans un autre éditeur de texte, puis réimportez-la, comme nouveau projet ou chapitre par chapitre.',
  exportStoryText: 'Exporter l’histoire en texte',
}

export const detailsMessages = { en, fr }
