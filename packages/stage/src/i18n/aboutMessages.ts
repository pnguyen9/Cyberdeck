import type { HowItRuns } from '../app/howItRuns'

/** The application's version, its About panel, and what the web build says of the browser's storage. */
const en = {
  about: 'About',
  aboutApp: (name: string) => `About ${name}`,
  version: (version: string) => `Version ${version}`,
  runs: {
    desktop: 'Runs as a desktop application: its data is in folders on the disk.',
    files: 'Runs from files opened in the browser: its data stays in this browser, on this computer.',
    web: 'Runs as a web page: its data stays in this browser, on this device.',
    installed: 'Runs as an application installed from the browser: its data stays in this browser, on this device.',
  } satisfies Record<HowItRuns, string>,
  install: [
    'To install it as an application, opening in a window of its own: in Chrome or Edge, the install button at the end of the address bar, or Install in the browser’s menu; on an Android phone, Add to home screen in the browser’s menu; on an iPhone or iPad, Share, then Add to Home Screen.',
    'Firefox on a computer does not install web pages. Install from an ordinary window: a private window forgets its data once closed, and the application does not bring it along.',
  ],
  license: 'Released into the public domain under the ',
  unlicense: 'Unlicense',
  licenseAfter: ': anyone may use, change and share it, for any purpose.',
  guide: 'Guide',
  repository: 'Source code and downloads (GitHub)',
  newTab: '(new tab)',
  close: 'Close',
  mayErase: 'A browser may erase a site’s data (Safari does after about seven days without a visit, unless the app is installed).',
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
    desktop: 'Fonctionne comme application de bureau\u00a0: ses données sont rangées dans des dossiers sur le disque.',
    files: 'Fonctionne à partir de fichiers ouverts dans le navigateur\u00a0: ses données restent dans ce navigateur, sur cet ordinateur.',
    web: 'Fonctionne comme page web\u00a0: ses données restent dans ce navigateur, sur cet appareil.',
    installed: 'Fonctionne comme application installée depuis le navigateur\u00a0: ses données restent dans ce navigateur, sur cet appareil.',
  },
  install: [
    'Pour l’installer comme application, dans une fenêtre à elle\u00a0: dans Chrome ou Edge, le bouton d’installation au bout de la barre d’adresse, ou Installer dans le menu du navigateur\u00a0; sur un téléphone Android, Ajouter à l’écran d’accueil dans le menu du navigateur\u00a0; sur un iPhone ou un iPad, Partager, puis Sur l’écran d’accueil.',
    'Firefox sur ordinateur n’installe pas les pages web. Installez depuis une fenêtre ordinaire\u00a0: une fenêtre privée oublie ses données une fois fermée, et l’application ne les emporte pas.',
  ],
  license: 'Versé dans le domaine public par l’',
  unlicense: 'Unlicense',
  licenseAfter: '\u00a0: chacun peut l’utiliser, le modifier et le partager, pour tout usage.',
  guide: 'Guide',
  repository: 'Code source et téléchargements (GitHub)',
  newTab: '(nouvel onglet)',
  close: 'Fermer',
  mayErase: 'Un navigateur peut effacer les données d’un site (Safari le fait au bout d’environ sept jours sans visite, sauf si l’application est installée).',
  newVersion: name => `Une nouvelle version de ${name} est en ligne.`,
  reload: 'Recharger',
  later: 'Plus tard',
}

export const aboutMessages = { en, fr }
