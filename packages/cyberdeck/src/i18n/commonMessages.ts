/** Words several screens share. */
const en = {
  untitledChapter: 'Untitled chapter',
  /** The name of a downloaded file whose project or chapter has none. */
  untitled: 'Untitled',
  pageCount: (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`,
  chapterCount: (count: number) => `${count} ${count === 1 ? 'chapter' : 'chapters'}`,
  sceneLabel: (title: string) => `Scene: ${title}`,
  download: (fileName: string) => `Download ${fileName}`,
  rename: 'Rename',
  remove: 'Remove',
  cancel: 'Cancel',
  save: 'Save',
  kilobytes: (count: number) => `${count} KB`,
  megabytes: (amount: number) => `${amount.toFixed(1)} MB`,
}

type CommonMessages = typeof en

const fr: CommonMessages = {
  untitledChapter: 'Chapitre sans titre',
  untitled: 'Sans titre',
  pageCount: count => `${count} ${count <= 1 ? 'page' : 'pages'}`,
  chapterCount: count => `${count} ${count <= 1 ? 'chapitre' : 'chapitres'}`,
  sceneLabel: title => `Scène : ${title}`,
  download: fileName => `Télécharger ${fileName}`,
  rename: 'Renommer',
  remove: 'Supprimer',
  cancel: 'Annuler',
  save: 'Enregistrer',
  kilobytes: count => `${count} Ko`,
  megabytes: amount => `${amount.toFixed(1).replace('.', ',')} Mo`,
}

export const commonMessages = { en, fr }
