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
  newTab: '(new tab)',
  close: 'Close',
  mayErase: 'Your browser may erase this app’s data. Safari does so after about seven days without a visit, unless the app is installed.',
  newVersion: (name: string) => `A new version of ${name} is online.`,
  reload: 'Reload',
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
    desktop: 'Vos données sont rangées dans des dossiers sur cet ordinateur.',
    files: 'Vos données restent dans ce navigateur, sur cet ordinateur.',
    web: 'Vos données restent dans ce navigateur, sur cet appareil.',
    installed: 'Vos données restent dans ce navigateur, sur cet appareil.',
  },
  install: {
    intro: 'Vous pouvez l’installer comme une application, dans sa propre fenêtre\u00a0:',
    steps: [
      'Chrome ou Edge\u00a0: le bouton d’installation au bout de la barre d’adresse, ou Installer dans le menu du navigateur.',
      'Android\u00a0: Ajouter à l’écran d’accueil, dans le menu du navigateur.',
      'iPhone ou iPad\u00a0: Partager, puis Sur l’écran d’accueil.',
      'Firefox sur ordinateur ne sait pas installer les pages web.',
    ],
    note: 'Installez-la depuis une fenêtre normale, pas une fenêtre privée. Une fenêtre privée oublie ses données à sa fermeture, et elles ne passent pas dans l’application.',
  },
  license: 'Domaine public, sous l’',
  unlicense: 'Unlicense',
  licenseAfter: '. Chacun peut l’utiliser, le modifier et le partager, pour tout usage.',
  guide: 'Guide',
  repository: 'Code source et téléchargements (GitHub)',
  newTab: '(nouvel onglet)',
  close: 'Fermer',
  mayErase: 'Votre navigateur peut effacer les données de cette application. Safari le fait au bout d’environ sept jours sans visite, sauf si elle est installée.',
  newVersion: name => `Une nouvelle version de ${name} est en ligne.`,
  reload: 'Recharger',
  later: 'Plus tard',
}

export const aboutMessages = { en, fr }
