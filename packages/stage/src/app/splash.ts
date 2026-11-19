/** The id of the splash screen `webBuild.ts` writes into the page: shown from the first paint, before any script runs. */
export const SPLASH_ID = 'splash'

/** Takes the splash screen away, once the application shows its first screen. */
export function removeSplash(doc: Pick<Document, 'getElementById'> = document): void {
  doc.getElementById(SPLASH_ID)?.remove()
}
