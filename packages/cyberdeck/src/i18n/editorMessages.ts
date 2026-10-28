import type { PreviewNote } from '../projects/openProject'

/** The frame of an open project: its header and tabs, and the question about changes not saved. */
const en = {
  tabs: {
    chapters: 'Chapters',
    storyboard: 'Storyboard',
    import: 'Import',
    cast: 'Cast & files',
    definitions: 'Definitions',
    index: 'Index',
    details: 'Details',
    export: 'Export',
  },
  tabsLabel: 'Project',
  projectName: 'Project name',
  keyboardShortcuts: 'Keyboard shortcuts',
  shortcuts: 'Shortcuts',
  backUp: 'Back up',
  preview: 'Preview ▶',
  backupFileName: (projectName: string) => `${projectName} backup.zip`,
  backupHelp: (size: string) => `(${size}): the project folder, to restore here or on another computer.`,
  previewNotes: {
    reachedWithEarlierPlaythroughs: 'This page is only reached with memories or endings of earlier playthroughs: the preview takes them all as known.',
    unreached: 'No way of playing reaches this page: the preview starts at its chapter.',
  } satisfies Record<PreviewNote, string>,
  unsavedChanges: 'Unsaved changes',
  save: 'Save',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  newChapterTitle: (number: number) => `Chapter ${number}`,
  newSceneTitle: (number: number) => `Scene ${number}`,
  documentStarted: (title: string) => `${title} is ready: write its first page here.`,
}

type EditorMessages = typeof en

const fr: EditorMessages = {
  tabs: {
    chapters: 'Chapitres',
    storyboard: 'Storyboard',
    import: 'Import',
    cast: 'Personnages et fichiers',
    definitions: 'Définitions',
    index: 'Index',
    details: 'Détails',
    export: 'Export',
  },
  tabsLabel: 'Projet',
  projectName: 'Nom du projet',
  keyboardShortcuts: 'Raccourcis clavier',
  shortcuts: 'Raccourcis',
  backUp: 'Copie de secours',
  preview: 'Aperçu ▶',
  backupFileName: projectName => `${projectName} copie de secours.zip`,
  backupHelp: size => `(${size}) : le dossier du projet, à restaurer ici ou sur un autre ordinateur.`,
  previewNotes: {
    reachedWithEarlierPlaythroughs: 'Cette page ne s’atteint qu’avec des souvenirs ou des fins de parties précédentes : l’aperçu fait comme si vous les aviez déjà obtenus.',
    unreached: 'Aucun parcours ne mène à cette page : l’aperçu commence au début de son chapitre.',
  },
  unsavedChanges: 'Modifications non enregistrées',
  save: 'Enregistrer',
  discard: 'Abandonner',
  keepEditing: 'Continuer la modification',
  newChapterTitle: number => `Chapitre ${number}`,
  newSceneTitle: number => `Scène ${number}`,
  documentStarted: title => `${title} est prêt : écrivez sa première page ici.`,
}

export const editorMessages = { en, fr }
