/** The log of the lines read. */
const en = {
  log: 'Log',
  hint: 'Click a line to go back to it',
  close: 'Close',
  nothingRead: 'Nothing read yet.',
}

type BacklogMessages = typeof en

const fr: BacklogMessages = {
  log: 'Historique',
  hint: 'Cliquez sur une ligne pour y revenir',
  close: 'Fermer',
  nothingRead: 'Rien n’a encore été lu.',
}

export const backlogMessages = { en, fr }
