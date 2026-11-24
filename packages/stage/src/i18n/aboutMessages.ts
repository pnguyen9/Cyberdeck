import type { HowItRuns } from '../app/howItRuns'

/** The application's version, its About panel, and what the web build says of the browser's storage. */
const en = {
  about: 'About',
  aboutApp: (name: string) => `About ${name}`,
  version: (version: string) => `Version ${version}`,
  runs: {
    desktop: 'Desktop application.',
    files: 'Opened from files, in the browser.',
    web: 'Web page.',
    installed: 'Installed from the browser.',
  } satisfies Record<HowItRuns, string>,
  data: {
    desktop: 'Your data is kept in folders on this computer.',
    files: 'Your data stays in this browser, on this computer.',
    web: 'Your data stays in this browser, on this device.',
    installed: 'Your data stays in this browser, on this device.',
  } satisfies Record<HowItRuns, string>,
  install: {
    intro: 'You can install it as an app, with a window of its own:',
    steps: [
      'Chrome or Edge: the install button at the end of the address bar, or Install in the browser menu.',
      'Android: Add to Home screen, in the browser menu.',
      'iPhone or iPad: Share, then Add to Home Screen.',
      'Firefox on a computer cannot install web pages.',
    ],
    note: 'Install it from a normal window, not a private one. A private window forgets its data when it closes, and that data does not carry over to the app.',
  },
  license: 'Public domain, under the ',
  unlicense: 'Unlicense',
  licenseAfter: '. Anyone can use it, change it and share it, for any purpose.',
  guide: 'Guide',
  repository: 'Source code and downloads (GitHub)',
  downloadLatest: (name: string) => `Download the latest ${name}`,
  newTab: '(new tab)',
  close: 'Close',
  mayErase: 'Your browser may erase this app’s data. Safari does so after about seven days without a visit, unless the app is installed.',
  newVersion: (name: string) => `A new version of ${name} is online.`,
  reload: 'Reload',
  sampleWithNewVersion: (sample: string, name: string) => `${sample} now comes with the new version of ${name}: reload, then try again.`,
  later: 'Later',
}

type AboutMessages = typeof en

const fr: AboutMessages = {
  about: 'À propos',
  aboutApp: name => `À propos de ${name}`,
  version: version => `Version ${version}`,
  runs: {
    desktop: 'Application de bureau.',
    files: 'Ouverte depuis des fichiers, dans le navigateur.',
    web: 'Page web.',
    installed: 'Installée depuis le navigateur.',
  },
  data: {
    desktop: 'Vos données sont enregistrées dans des dossiers sur cet ordinateur.',
    files: 'Vos données restent dans ce navigateur, sur cet ordinateur.',
    web: 'Vos données restent dans ce navigateur, sur cet appareil.',
    installed: 'Vos données restent dans ce navigateur, sur cet appareil.',
  },
  install: {
    intro: 'Vous pouvez l’installer comme une application, dans sa propre fenêtre\u00a0:',
    steps: [
      'Chrome ou Edge : le bouton d’installation à droite de la barre d’adresse, ou la commande Installer du menu du navigateur.',
      'Android\u00a0: Ajouter à l’écran d’accueil, dans le menu du navigateur.',
      'iPhone ou iPad\u00a0: Partager, puis Sur l’écran d’accueil.',
      'Firefox sur ordinateur ne permet pas d’installer les pages web.',
    ],
    note: 'Installez l’application depuis une fenêtre normale, et non depuis une fenêtre de navigation privée : celle-ci efface ses données à la fermeture, et ces données ne sont pas transmises à l’application.',
  },
  license: 'Domaine public, sous l’',
  unlicense: 'Unlicense',
  licenseAfter: '. Chacun peut l’utiliser, le modifier et le partager, pour tout usage.',
  guide: 'Guide',
  repository: 'Code source et téléchargements (GitHub)',
  downloadLatest: name => `Télécharger la dernière version de ${name}`,
  newTab: '(nouvel onglet)',
  close: 'Fermer',
  mayErase: 'Votre navigateur peut effacer les données de cette application. Safari les efface après environ sept jours sans utilisation, sauf si l’application est installée.',
  newVersion: name => `Une nouvelle version de ${name} est en ligne.`,
  reload: 'Recharger',
  sampleWithNewVersion: (sample, name) => `${sample} fait désormais partie de la nouvelle version de ${name} : rechargez l’application, puis réessayez.`,
  later: 'Plus tard',
}

export const aboutMessages = { en, fr }
