/** The list of projects, and a project that cannot be opened. */
const en = {
  projects: 'Projects',
  folderBefore: 'In',
  folderAfter: ', a folder per project.',
  changeFolder: 'Change…',
  noProject: 'No project yet: create one below, then import its text.',
  confirmDeleteFolder: (name: string) => `Delete ${name}? Its folder goes to the trash, from where it can be brought back.`,
  confirmDelete: (name: string) => `Delete ${name}, its chapters and its files? Download a backup first if you may want it back.`,
  delete: 'Delete',
  changedOn: (date: string) => `changed ${date}`,
  newProject: 'New project',
  name: 'Name',
  storyLanguage: 'Language of the story',
  create: 'Create',
  backups: 'Backups',
  restoreBackup: 'Restore a backup…',
  backupReplaces: 'A backup replaces the project of the same identifier, if this browser has it.',
  folderChanged: (folder: string) => `Projects are now kept in ${folder}.`,
  restored: (name: string) => `${name} was restored.`,
  deleted: (name: string) => `${name} was deleted.`,
  cannotOpen: (reason: string) => `This project cannot be opened: ${reason}`,
  backToProjects: '← Projects',
}

type ProjectsMessages = typeof en

const fr: ProjectsMessages = {
  projects: 'Projets',
  folderBefore: 'Dans',
  folderAfter: ', un dossier par projet.',
  changeFolder: 'Changer…',
  noProject: 'Aucun projet pour l’instant : créez-en un ci-dessous, puis importez son texte.',
  confirmDeleteFolder: name => `Supprimer ${name} ? Son dossier sera placé dans la corbeille, d’où vous pourrez le récupérer.`,
  confirmDelete: name => `Supprimer ${name}, avec ses chapitres et ses fichiers ? Si vous pensez en avoir encore besoin, téléchargez d’abord une copie de secours.`,
  delete: 'Supprimer',
  changedOn: date => `modifié le ${date}`,
  newProject: 'Nouveau projet',
  name: 'Nom',
  storyLanguage: 'Langue de l’histoire',
  create: 'Créer',
  backups: 'Copies de secours',
  restoreBackup: 'Restaurer une copie de secours…',
  backupReplaces: 'Si ce navigateur contient déjà le même projet, la copie de secours le remplace.',
  folderChanged: folder => `Les projets sont désormais rangés dans ${folder}.`,
  restored: name => `${name} a été restauré.`,
  deleted: name => `${name} a été supprimé.`,
  cannotOpen: reason => `Impossible d’ouvrir ce projet : ${reason}`,
  backToProjects: '← Projets',
}

export const projectsMessages = { en, fr }
