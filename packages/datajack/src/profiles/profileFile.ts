import {
  DEFAULT_ZIP_LIMITS,
  isPlainIdentifier,
  parseProgress,
  parseSave,
  readGameArchive,
  readZip,
  writeZip,
  type GameArchive,
  type ProgressData,
  type SaveData,
  type ZipEntry,
  type ZipEntryToWrite,
  type ZipLimits,
} from '@cyberdeck/core'
import { AUTOSAVE_SLOT, MANUAL_SLOTS, PROGRESS_SLOT, storageKeysStartingWith, type Locale } from '@cyberdeck/stage'
import type { GameLibrary } from '../library/gameLibrary'
import { createSampleRecord, type InstalledSamples } from '../library/sampleShelf'
import type { CarriedLock, ProfileLocks } from './profileLocks'
import { gameSettingsKey, lookKey, profileLanguageKey, settingsKey } from './profileKeys'
import type { Profile, ProfileStore } from './profileStore'

/**
 * A profile file: a whole profile in one ZIP archive, to carry it to another device or keep it safe.
 *
 * - `datajack-profile.json`: the format, when it was exported, the profile's name and identifier, its
 *   games, and what the page keeps for it: its settings and those of each game, its look and
 *   language, what the samples shelf installed, and its PIN's salted hash, so that the PIN comes along;
 * - `games/<game>.zip`: each game of its library, at the version it has, as a game archive;
 * - `saves/<game>/<slot>.json`: its saves, and the progress of each game, as save files are written.
 *
 * Importing one always adds a new profile: nothing of a profile already on the device is merged
 * into or replaced. Nothing is encrypted: anyone with the file can read its saves. A PIN guards
 * Datajack's screens, not files; its hash, of four digits, is no secret either.
 */
const PROFILE_FORMAT = 1
export const PROFILE_FILE_PATH = 'datajack-profile.json'

/**
 * What a profile file may hold: a game is one entry, as large as the whole file may be. The whole
 * stays under 4 GB, which ZIP reaches without ZIP64, that Datajack does not read.
 */
export const PROFILE_ZIP_LIMITS: ZipLimits = { ...DEFAULT_ZIP_LIMITS, maximumEntrySize: DEFAULT_ZIP_LIMITS.maximumTotalSize }
/** Settings, a look or a language are short: a longer value is no profile's. */
const MAXIMUM_KEPT_LENGTH = 1_000_000
/** The profile's description and its saves are JSON, far smaller than this. */
const MAXIMUM_JSON_SIZE = 64 * 1024 * 1024
const SAVE_SLOTS: readonly string[] = [AUTOSAVE_SLOT, ...MANUAL_SLOTS]

/** What a profile file carries besides its games. */
interface ProfileData {
  profile: { id: string; name: string }
  saves: { gameId: string; slot: string; save: SaveData }[]
  progress: ProgressData[]
  /** As the page keeps them, read by its own readers, which take anything they cannot read for nothing. */
  settings: string | null
  gameSettings: Record<string, string>
  look: string | null
  language: string | null
  samples: InstalledSamples
  pin: CarriedLock | null
}

/** A profile file read and checked. */
export interface ProfileContents extends ProfileData {
  /** Null when the file does not say, or not as a date. */
  exportedAt: Date | null
  /** Each game read, as installing reads an archive. */
  games: { id: string; name: string; archive: GameArchive }[]
}

/** A profile to write as a file: its games' archives are asked for one at a time, as they are written. */
export interface ProfileToWrite extends ProfileData {
  games: readonly { id: string; name: string }[]
  archiveOf: (gameId: string) => Promise<Uint8Array<ArrayBuffer>>
}

/** Why a profile file is not read, or not made, or not imported, for the player to understand in their language. */
export type ProfileFileProblem =
  | { code: 'notProfile' }
  /** A game's archive, chosen as a profile file. */
  | { code: 'isGame' }
  | { code: 'newerFormat' }
  | { code: 'damaged' }
  /** A game of the file cannot be installed: `error` says why, as installing it would. */
  | { code: 'game'; gameName: string; error: unknown }
  /** The profile would make a file larger than importing reads. */
  | { code: 'tooLarge'; maximumSize: number }
  /** Importing, a save or a progress could not be written: storage full or refused, disk error. */
  | { code: 'saveNotWritten'; gameName: string; slot: string }
  | { code: 'progressNotWritten'; gameName: string }

export class ProfileFileError extends Error {
  constructor(readonly problem: ProfileFileProblem) {
    super(`The profile file was refused: ${problem.code}`)
    this.name = 'ProfileFileError'
  }
}

/**
 * The profile as one archive. Refuses, before it is all written, a profile larger than importing
 * reads (`limits`), rather than make a file no Datajack would import.
 */
export async function writeProfileFile(contents: ProfileToWrite, exportedAt: Date, limits: ZipLimits = PROFILE_ZIP_LIMITS): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder()
  const json = (path: string, value: unknown): ZipEntryToWrite => ({ path, bytes: encoder.encode(JSON.stringify(value, null, 2)), compress: true })
  async function* entries(): AsyncGenerator<ZipEntryToWrite> {
    yield json(PROFILE_FILE_PATH, {
      profileFormat: PROFILE_FORMAT,
      exportedAt: exportedAt.toISOString(),
      profile: contents.profile,
      games: contents.games.map(({ id, name }) => ({ id, name })),
      settings: contents.settings,
      gameSettings: contents.gameSettings,
      look: contents.look,
      language: contents.language,
      samples: contents.samples,
      pin: contents.pin,
    })
    yield* contents.saves.map(({ gameId, slot, save }) => json(`saves/${gameId}/${slot}.json`, save))
    yield* contents.progress.map(progress => json(`saves/${progress.game.id}/${PROGRESS_SLOT}.json`, progress))
    // Game archives are compressed already, where they can be.
    for (const game of contents.games) {
      yield { path: `games/${game.id}.zip`, bytes: await contents.archiveOf(game.id), compress: false }
    }
  }
  async function* withinLimits(): AsyncGenerator<ZipEntryToWrite> {
    let count = 0
    let size = 0
    for await (const entry of entries()) {
      count++
      size += entry.bytes.length
      if (count > limits.maximumEntries || size > limits.maximumTotalSize) {
        throw new ProfileFileError({ code: 'tooLarge', maximumSize: limits.maximumTotalSize })
      }
      yield entry
    }
  }
  return writeZip(withinLimits(), exportedAt)
}

/**
 * Reads and checks a profile file, its games included, before anything is changed: a file refused
 * leaves the device as it was. A file zipped again inside a folder is read too, as players unzipping
 * one to remove its password may do.
 */
export async function readProfileFile(bytes: Uint8Array<ArrayBuffer>, limits: ZipLimits = PROFILE_ZIP_LIMITS): Promise<ProfileContents> {
  const entries = readZip(bytes, limits)
  const root = rootOf(entries, PROFILE_FILE_PATH)
  if (root === null) {
    throw new ProfileFileError({ code: rootOf(entries, 'game.json') === null ? 'notProfile' : 'isGame' })
  }
  const byPath = new Map(entries.map(entry => [entry.path, entry]))
  const readJson = async (entry: ZipEntry | undefined): Promise<unknown> => {
    if (entry === undefined || entry.size > MAXIMUM_JSON_SIZE) {
      throw new ProfileFileError({ code: 'damaged' })
    }
    try {
      return JSON.parse(new TextDecoder().decode(await entry.read()))
    } catch (error) {
      throw error instanceof SyntaxError ? new ProfileFileError({ code: 'damaged' }) : error
    }
  }
  const value = await readJson(byPath.get(`${root}${PROFILE_FILE_PATH}`))
  const fields: Record<string, unknown> = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
  if (typeof fields.profileFormat !== 'number') {
    throw new ProfileFileError({ code: 'notProfile' })
  }
  if (fields.profileFormat > PROFILE_FORMAT) {
    throw new ProfileFileError({ code: 'newerFormat' })
  }
  const profile = fields.profile as Record<string, unknown> | null | undefined
  if (fields.profileFormat !== PROFILE_FORMAT || typeof profile?.id !== 'string' || !isPlainIdentifier(profile.id) || typeof profile.name !== 'string' || !Array.isArray(fields.games)) {
    throw new ProfileFileError({ code: 'damaged' })
  }

  const games: ProfileContents['games'] = []
  for (const game of fields.games as unknown[]) {
    const { id, name } = typeof game === 'object' && game !== null ? game as Record<string, unknown> : {}
    if (typeof id !== 'string' || !isPlainIdentifier(id) || typeof name !== 'string') {
      throw new ProfileFileError({ code: 'damaged' })
    }
    const entry = byPath.get(`${root}games/${id}.zip`)
    if (entry === undefined) {
      throw new ProfileFileError({ code: 'damaged' })
    }
    let archive: GameArchive
    try {
      archive = await readGameArchive(await entry.read())
    } catch (error) {
      throw new ProfileFileError({ code: 'game', gameName: name, error })
    }
    if (archive.manifest.project.id !== id) {
      throw new ProfileFileError({ code: 'damaged' })
    }
    games.push({ id, name, archive })
  }

  // Saves are read as a save file loaded is: one that cannot be is left out, as it could not be played.
  const saves: ProfileContents['saves'] = []
  const progress: ProgressData[] = []
  for (const entry of entries) {
    const match = entry.path.startsWith(root) ? /^saves\/([^/]+)\/([^/]+)\.json$/.exec(entry.path.slice(root.length)) : null
    const [, gameId = '', slot = ''] = match ?? []
    if (match === null || !isPlainIdentifier(gameId)) {
      continue
    }
    const read = await readJson(entry).catch(() => null)
    if (slot === PROGRESS_SLOT) {
      const parsed = parseProgress(read)
      if (parsed?.game.id === gameId) {
        progress.push(parsed)
      }
    } else if (SAVE_SLOTS.includes(slot)) {
      const parsed = parseSave(read)
      if (parsed?.game.id === gameId) {
        saves.push({ gameId, slot, save: parsed })
      }
    }
  }

  const keptText = (kept: unknown) => typeof kept === 'string' && kept.length <= MAXIMUM_KEPT_LENGTH ? kept : null
  const textsByKey = (record: unknown, isKey: (key: string) => boolean) => typeof record === 'object' && record !== null && !Array.isArray(record)
    ? Object.fromEntries(Object.entries(record).flatMap(([key, kept]) => isKey(key) && keptText(kept) !== null ? [[key, kept as string]] : []))
    : {}
  const exportedAt = typeof fields.exportedAt === 'string' ? new Date(fields.exportedAt) : null
  return {
    profile: { id: profile.id, name: profile.name },
    exportedAt: exportedAt !== null && !Number.isNaN(exportedAt.getTime()) ? exportedAt : null,
    games,
    saves,
    progress,
    settings: keptText(fields.settings),
    gameSettings: textsByKey(fields.gameSettings, isPlainIdentifier),
    look: keptText(fields.look),
    language: keptText(fields.language),
    samples: textsByKey(fields.samples, key => key.length <= 200),
    pin: typeof fields.pin === 'object' && fields.pin !== null ? fields.pin as CarriedLock : null,
  }
}

/** Whether the file is a profile file: to tell a player who adds one as a game where it goes. */
export function isProfileFile(bytes: Uint8Array<ArrayBuffer>): boolean {
  try {
    return rootOf(readZip(bytes), PROFILE_FILE_PATH) !== null
  } catch {
    return false
  }
}

/** The folder of the archive holding the file: `` at its root, `<folder>/` one level down; null without it. */
function rootOf(entries: readonly ZipEntry[], fileName: string): string | null {
  const found = entries.map(entry => entry.path).filter(path => path === fileName || (path.endsWith(`/${fileName}`) && path.split('/').length === 2))
  return found.length === 1 ? found[0]!.slice(0, -fileName.length) : null
}

interface ProfileTransferOptions {
  store: ProfileStore
  library: GameLibrary
  locks: ProfileLocks
  /** The page's storage (`localStorage`), which keeps the profile's settings, look, language and PIN. */
  storage: () => Storage
}

/** What an import brought: for the player to see it all came. */
interface ImportOutcome {
  profile: Profile
  games: number
  saves: number
}

/**
 * Exports profiles to profile files, and imports them, always as new profiles; removes profiles,
 * with everything Datajack keeps for them.
 */
export function createProfileTransfer({ store, library, locks, storage }: ProfileTransferOptions) {
  const samples = createSampleRecord(storage)
  const writeKept = (key: string, value: string | null) => {
    if (value === null) {
      storage().removeItem(key)
    } else {
      storage().setItem(key, value)
    }
  }
  const gameSettingsKeys = (profileId: string) => storageKeysStartingWith(storage(), gameSettingsKey(profileId, ''))

  /** Everything the profile has, as the file carries it. */
  async function gather(profile: Pick<Profile, 'id' | 'name'>): Promise<ProfileToWrite> {
    const games = await library.gameNames(profile.id)
    // Saves of games no longer in the library come too: installed again, they are played on.
    const saveStore = store.saveStore(profile.id)
    const gameIds = [...new Set([...games.map(game => game.id), ...await store.savedGames(profile.id)])].filter(isPlainIdentifier)
    const saves: ProfileToWrite['saves'] = []
    const progress: ProgressData[] = []
    for (const gameId of gameIds) {
      for (const slot of SAVE_SLOTS) {
        const save = await saveStore.read(gameId, slot)
        if (save !== null) {
          saves.push({ gameId, slot, save })
        }
      }
      const gameProgress = await saveStore.readProgress(gameId)
      if (gameProgress !== null) {
        progress.push(gameProgress)
      }
    }
    const gameSettingsPrefix = gameSettingsKey(profile.id, '')
    return {
      profile: { id: profile.id, name: profile.name },
      games,
      archiveOf: gameId => library.archive(gameId, profile.id),
      saves,
      progress,
      settings: storage().getItem(settingsKey(profile.id)),
      gameSettings: Object.fromEntries(gameSettingsKeys(profile.id).map(key => [key.slice(gameSettingsPrefix.length), storage().getItem(key) ?? ''])),
      look: storage().getItem(lookKey(profile.id)),
      language: storage().getItem(profileLanguageKey(profile.id)),
      samples: samples.read(profile.id),
      pin: locks.carried(profile.id),
    }
  }

  /** Gives the new profile what the file has: its games, its saves, what the page keeps for it, its PIN. */
  async function apply(contents: ProfileContents, profileId: string): Promise<{ games: number; saves: number }> {
    for (const game of contents.games) {
      await library.installArchive(game.archive, profileId)
    }
    const saveStore = store.saveStore(profileId)
    for (const { gameId, slot, save } of contents.saves) {
      if (!await saveStore.write(gameId, slot, save)) {
        throw new ProfileFileError({ code: 'saveNotWritten', gameName: save.game.name, slot })
      }
    }
    for (const progress of contents.progress) {
      if (!await saveStore.writeProgress(progress.game.id, progress)) {
        throw new ProfileFileError({ code: 'progressNotWritten', gameName: progress.game.name })
      }
    }
    writeKept(settingsKey(profileId), contents.settings)
    Object.entries(contents.gameSettings).forEach(([gameId, value]) => storage().setItem(gameSettingsKey(profileId, gameId), value))
    writeKept(lookKey(profileId), contents.look)
    writeKept(profileLanguageKey(profileId), contents.language)
    samples.replace(profileId, contents.samples)
    // A PIN that cannot be read is left out: the profile comes unlocked rather than locked for ever.
    if (contents.pin !== null) {
      locks.restore(profileId, contents.pin)
    }
    return { games: contents.games.length, saves: contents.saves.length }
  }

  /** What the page keeps for the profile, besides its saves and its PIN. */
  function forgetKept(profileId: string) {
    [settingsKey(profileId), lookKey(profileId), profileLanguageKey(profileId), ...gameSettingsKeys(profileId)].forEach(key => storage().removeItem(key))
  }

  /**
   * Removes the profile, its library first: nothing could reach it once the profile is gone. On the
   * desktop too, where its saves stay: those are in a folder the player chose, the games in
   * Datajack's own.
   */
  async function remove(profile: Pick<Profile, 'id'>) {
    await library.removeAll(profile.id)
    await store.remove(profile.id)
    locks.remove(profile.id)
    forgetKept(profile.id)
  }

  return {
    /** The profile as one file. */
    async exportFile(profile: Pick<Profile, 'id' | 'name'>, exportedAt = new Date()): Promise<Uint8Array<ArrayBuffer>> {
      return writeProfileFile(await gather(profile), exportedAt)
    },

    /**
     * Makes a new profile of the file, of that name: a new identifier, never the file's, so that it
     * takes the place of no profile here. If anything of it cannot be written, the profile is
     * removed again, as the player removes one (on the desktop, saves already written stay in its
     * folder), and the error thrown.
     */
    async importFile(contents: ProfileContents, name: string, saveFolder: string | null): Promise<ImportOutcome> {
      const { lastUsedId } = await store.list()
      const profile = await store.create(name, saveFolder)
      try {
        // Imported, not chosen: the profile opened at the next start stays the one it was.
        await store.use(lastUsedId)
        return { profile, ...await apply(contents, profile.id) }
      } catch (error) {
        await remove(profile).catch(() => undefined)
        throw error
      }
    },

    remove,
  }
}

export type ProfileTransfer = ReturnType<typeof createProfileTransfer>

const PROFILE_FILE_SUFFIXES: Readonly<Record<Locale, { fallback: string; suffix: string }>> = {
  en: { fallback: 'Profile', suffix: 'Datajack profile' },
  fr: { fallback: 'Profil', suffix: 'profil Datajack' },
}

/** A profile file's name, from the profile's, in the player's language: what systems refuse in a file name is left out. */
export function profileFileName(profileName: string, locale: Locale): string {
  const { fallback, suffix } = PROFILE_FILE_SUFFIXES[locale]
  return `${profileName.replace(/[\\/:*?"<>|\p{Cc}]/gu, '').trim() || fallback} - ${suffix}.zip`
}
