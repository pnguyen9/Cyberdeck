/** Writing files safely and checking names that become paths: what both desktop builds rely on. */
import { randomUUID } from 'node:crypto'
import { rename, unlink, writeFile } from 'node:fs/promises'

/** Identifiers that become folder and file names: nothing that could climb out of their folder. */
export const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/

/** Writes beside the target, then replaces it in one move: readers see the old file or the new one, never half of it. */
export async function writeAtomically(path: string, content: string | Uint8Array) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, content, { flush: true })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

export function isJsonObject(text: string, maximumLength: number): boolean {
  if (typeof text !== 'string' || text.length > maximumLength) {
    return false
  }
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  } catch {
    return false
  }
}

export function isFileError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
