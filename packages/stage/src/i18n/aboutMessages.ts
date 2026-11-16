import type { HowItRuns } from '../app/howItRuns'

/** The application's version, its About panel, and what the web build says of the browser's storage. */
const en = {
  about: 'About',
  aboutApp: (name: string) => `About ${name}`,
  version: (version: string) => `Version ${version}`,
  runs: {
    desktop: 'Runs as a desktop application: what it keeps is in folders on the disk.',
    files: 'Runs as files opened in the browser: what it keeps stays in this browser, on this computer.',
    web: 'Runs as a web page: what it keeps stays in this browser, on this device.',
    installed: 'Runs as an application installed from the browser: what it keeps stays in this browser, on this device.',
  } satisfies Record<HowItRuns, string>,
  license: 'Released into the public domain under the ',
  unlicense: 'Unlicense',
  licenseAfter: ': anyone may use, change and share it, for any purpose.',
  guide: 'Guide',
  repository: 'Source code and downloads (GitHub)',
  close: 'Close',
  mayErase: 'A browser may erase what a site keeps (Safari does after about seven days without a visit, unless the app is installed).',
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
    desktop: 'Fonctionne en application de bureau\u00a0: ce qu’il garde est dans des dossiers sur le disque.',
    files: 'Fonctionne en fichiers ouverts dans le navigateur\u00a0: ce qu’il garde reste dans ce navigateur, sur cet ordinateur.',
    web: 'Fonctionne en page web\u00a0: ce qu’il garde reste dans ce navigateur, sur cet appareil.',
    installed: 'Fonctionne en application installée depuis le navigateur\u00a0: ce qu’il garde reste dans ce navigateur, sur cet appareil.',
  },
  license: 'Placé dans le domaine public sous l’',
  unlicense: 'Unlicense',
  licenseAfter: '\u00a0: chacun peut l’utiliser, le modifier et le partager, pour tout usage.',
  guide: 'Guide',
  repository: 'Code source et téléchargements (GitHub)',
  close: 'Fermer',
  mayErase: 'Un navigateur peut effacer ce qu’un site garde (Safari le fait après environ sept jours sans visite, sauf si l’application est installée).',
  newVersion: name => `Une nouvelle version de ${name} est en ligne.`,
  reload: 'Recharger',
  later: 'Plus tard',
}

export const aboutMessages = { en, fr }
