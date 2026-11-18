/** What a phone or a tablet is asked as a game plays. */
const en = {
  turn: 'Turn your device sideways: the game is played in landscape.',
  fullscreenOffer: 'The game is best played in full screen.',
  playFullscreen: 'Play in full screen',
  notNow: 'Not now',
}

type LandscapeMessages = typeof en

const fr: LandscapeMessages = {
  turn: 'Tournez votre appareil : le jeu se joue en mode paysage.',
  fullscreenOffer: 'Le jeu est plus agréable en plein écran.',
  playFullscreen: 'Jouer en plein écran',
  notNow: 'Pas maintenant',
}

export const landscapeMessages = { en, fr }
