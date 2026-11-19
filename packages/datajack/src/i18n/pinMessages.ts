import { PIN_LENGTH, WAIT_SECONDS } from '../profiles/profileLocks'

/** A no-break space, between a number and its unit. */
const NBSP = '\u00a0'

/** Where Datajack keeps its data on the desktop, for this system. */
function desktopDataFolder(): string {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  return agent.includes('Windows') ? '%APPDATA%\\Datajack'
    : agent.includes('Mac') ? '~/Library/Application Support/Datajack'
      : '~/.config/Datajack'
}

/** The PIN of a profile: setting it, changing or removing it, and entering it. */
const en = {
  pin: 'PIN',
  addPin: 'Add a PIN',
  pinOf: (profileName: string) => `${profileName}’s PIN`,
  lockedBadge: 'Protected by a PIN',
  toPlay: (profileName: string) => `Enter it to play as ${profileName}.`,
  toConfirm: (profileName: string) => `Enter ${profileName}’s PIN to go on.`,
  toChange: 'Enter the current PIN to change it.',
  toRemove: 'Enter the current PIN to remove it.',
  choose: (profileName: string) => `Choose ${PIN_LENGTH} digits. Datajack will ask for them before opening ${profileName}’s profile and before erasing its saves or progress. Remember them: a forgotten PIN cannot be recovered.`,
  repeat: `Enter the same ${PIN_LENGTH} digits again, to be sure.`,
  manageHint: (profileName: string) => `${profileName} is protected by a PIN. Changing or removing it asks for the current one first.`,
  newPin: 'New PIN',
  repeatPin: 'Confirm the PIN',
  currentPin: 'Current PIN',
  digits: 'Digits',
  eraseDigit: 'Erase a digit',
  confirm: 'OK',
  cancel: 'Cancel',
  change: 'Change the PIN',
  remove: 'Remove the PIN',
  /** A wait, in seconds below a minute, in minutes from one. */
  duration: (seconds: number) => seconds < 60
    ? `${seconds}${NBSP}${seconds === 1 ? 'second' : 'seconds'}`
    : `${Math.ceil(seconds / 60)}${NBSP}${Math.ceil(seconds / 60) === 1 ? 'minute' : 'minutes'}`,
  wrong: (triesLeft: number) => `Wrong PIN. ${triesLeft} more ${triesLeft === 1 ? 'try' : 'tries'} before a ${WAIT_SECONDS[0]}-second wait.`,
  wait: (duration: string) => `Too many wrong PINs: try again in ${duration}.`,
  differ: 'The two PINs don’t match: try again.',
  failed: 'Datajack could not read or keep the PIN: the browser’s storage may be full or blocked. Try again.',
  forgot: 'Forgot the PIN?',
  forgotWeb: 'Datajack cannot recover it. The only way out is to erase the data the browser keeps for Datajack, in the browser’s settings: every profile, save and game is erased with it.',
  forgotDesktop: () => `Datajack cannot recover it. With Datajack closed, delete the Local Storage folder in ${desktopDataFolder()}: every profile’s PIN, settings, language and look are forgotten; profiles and save files stay.`,
  isSet: (profileName: string) => `${profileName} is now protected by a PIN.`,
  changed: (profileName: string) => `${profileName}’s PIN was changed.`,
  removed: (profileName: string) => `${profileName}’s PIN was removed.`,
}

type PinMessages = typeof en

const fr: PinMessages = {
  pin: 'Code secret',
  addPin: 'Ajouter un code secret',
  pinOf: profileName => `Code secret de ${profileName}`,
  lockedBadge: 'Protégé par un code secret',
  toPlay: profileName => `Saisissez-le pour jouer avec le profil ${profileName}.`,
  toConfirm: profileName => `Saisissez le code secret de ${profileName} pour continuer.`,
  toChange: 'Saisissez le code secret actuel pour le changer.',
  toRemove: 'Saisissez le code secret actuel pour le supprimer.',
  choose: profileName => `Choisissez ${PIN_LENGTH} chiffres. Datajack les demandera avant d’ouvrir le profil ${profileName} et avant d’effacer ses sauvegardes ou sa progression. Retenez-les bien : un code secret oublié ne peut pas être retrouvé.`,
  repeat: `Saisissez à nouveau les ${PIN_LENGTH} chiffres, pour confirmer.`,
  manageHint: profileName => `Le profil ${profileName} est protégé par un code secret. Pour le changer ou le supprimer, saisissez d’abord le code actuel.`,
  newPin: 'Nouveau code secret',
  repeatPin: 'Confirmez le code secret',
  currentPin: 'Code secret actuel',
  digits: 'Chiffres',
  eraseDigit: 'Effacer un chiffre',
  confirm: 'Valider',
  cancel: 'Annuler',
  change: 'Changer le code secret',
  remove: 'Supprimer le code secret',
  duration: seconds => seconds < 60
    ? `${seconds}${NBSP}${seconds <= 1 ? 'seconde' : 'secondes'}`
    : `${Math.ceil(seconds / 60)}${NBSP}${Math.ceil(seconds / 60) <= 1 ? 'minute' : 'minutes'}`,
  wrong: triesLeft => `Code secret incorrect. Il vous reste ${triesLeft} ${triesLeft <= 1 ? 'essai' : 'essais'} avant de devoir attendre ${WAIT_SECONDS[0]}${NBSP}secondes.`,
  wait: duration => `Trop d’essais incorrects : réessayez dans ${duration}.`,
  differ: 'Les deux codes ne correspondent pas : recommencez.',
  failed: 'Datajack n’a pas pu lire ou conserver le code secret : le stockage du navigateur est peut-être plein ou bloqué. Réessayez.',
  forgot: 'Code secret oublié ?',
  forgotWeb: 'Datajack ne peut pas le retrouver. La seule issue est d’effacer, dans les réglages du navigateur, les données qu’il conserve pour Datajack : tous les profils, sauvegardes et jeux sont effacés avec.',
  forgotDesktop: () => `Datajack ne peut pas le retrouver. Datajack fermé, supprimez le dossier Local Storage dans ${desktopDataFolder()} : le code secret, les réglages, la langue et l’apparence de chaque profil sont oubliés ; les profils et les fichiers de sauvegarde restent.`,
  isSet: profileName => `Le profil ${profileName} est désormais protégé par un code secret.`,
  changed: profileName => `Le code secret de ${profileName} a été changé.`,
  removed: profileName => `Le code secret de ${profileName} a été supprimé.`,
}

export const pinMessages = { en, fr }
