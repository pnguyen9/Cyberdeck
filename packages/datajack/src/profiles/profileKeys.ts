/**
 * The keys the page keeps a profile's own data under, in its storage (`localStorage`, the desktop
 * page's too): everything a profile file carries besides its games, and, in the browser, its saves.
 * The shelf's record of the samples each profile installed is one key for all (`SAMPLES_KEY`).
 */

/** The profiles themselves, in the browser; the desktop keeps them in a file. */
export const PROFILES_KEY = 'datajack:profiles'

/** The profile's settings; each game's own under `<this>:game:<game>`, when the player gave it some. */
export const settingsKey = (profileId: string) => `datajack:settings:${profileId}`
export const gameSettingsKey = (profileId: string, gameId: string) => `${settingsKey(profileId)}:game:${gameId}`

/** Datajack's own look, the device's; each profile's under `<this>:<profile>`. */
export const DEVICE_LOOK_KEY = 'datajack:look'
export const lookKey = (profileId: string) => `${DEVICE_LOOK_KEY}:${profileId}`

/** The device's language: the profiles screen's, before anyone is chosen; the last one a profile chose. */
export const LANGUAGE_KEY = 'datajack:language'
export const profileLanguageKey = (profileId: string) => `${LANGUAGE_KEY}:${profileId}`

/** The PIN's salted hash, and the wrong tries counted on this device. */
export const pinKey = (profileId: string) => `datajack:pin:${profileId}`

/** In the browser, each save and progress under `<this><game>:<slot>`. */
export const savesKeyPrefix = (profileId: string) => `datajack:profile:${profileId}:save:`
