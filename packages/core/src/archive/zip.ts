/**
 * The part of the ZIP format game archives need: files stored or deflated, UTF-8 names, no
 * encryption, no ZIP64. Reading treats the archive as untrusted: limits are checked on the sizes
 * the archive declares before anything is inflated, an entry inflating past its declared size is
 * stopped, checksums are verified, and paths that could leave their folder are refused.
 */
import { ArchiveError } from './archiveError'

export interface ZipEntryToWrite {
  path: string
  bytes: Uint8Array<ArrayBuffer>
  /** Text compresses well; images and sounds are compressed already and are better stored. */
  compress: boolean
}

export interface ZipEntry {
  path: string
  /** As declared by the archive; reading checks it. */
  size: number
  read: () => Promise<Uint8Array<ArrayBuffer>>
}

export interface ZipLimits {
  maximumEntries: number
  maximumEntrySize: number
  maximumTotalSize: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maximumEntries: 10_000,
  maximumEntrySize: 256 * 1024 * 1024,
  maximumTotalSize: 2 * 1024 * 1024 * 1024,
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50
const CENTRAL_HEADER_SIGNATURE = 0x02014b50
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50
const LOCAL_HEADER_LENGTH = 30
const CENTRAL_HEADER_LENGTH = 46
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22
const MAXIMUM_COMMENT_LENGTH = 0xffff
const VERSION = 20
const UTF8_NAMES_FLAG = 0x0800
const ENCRYPTED_FLAG = 0x0001
const STORED = 0
const DEFLATED = 8
/** Sizes and offsets at this value announce ZIP64, which game archives never need. */
const ZIP64_MARKER = 0xffffffff

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

export async function writeZip(entries: readonly ZipEntryToWrite[], modifiedAt: Date): Promise<Uint8Array<ArrayBuffer>> {
  const { time, date } = dosDateTime(modifiedAt)
  const localParts: Uint8Array<ArrayBuffer>[] = []
  const centralParts: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    checkPath(entry.path)
    const name = encoder.encode(entry.path)
    const data = entry.compress ? await transform(entry.bytes, new CompressionStream('deflate-raw')) : entry.bytes
    const checksum = crc32(entry.bytes)

    const local = new Uint8Array(LOCAL_HEADER_LENGTH + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, LOCAL_HEADER_SIGNATURE, true)
    localView.setUint16(4, VERSION, true)
    localView.setUint16(6, UTF8_NAMES_FLAG, true)
    localView.setUint16(8, entry.compress ? DEFLATED : STORED, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, entry.bytes.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, LOCAL_HEADER_LENGTH)

    const central = new Uint8Array(CENTRAL_HEADER_LENGTH + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, CENTRAL_HEADER_SIGNATURE, true)
    centralView.setUint16(4, VERSION, true)
    centralView.setUint16(6, VERSION, true)
    centralView.setUint16(8, UTF8_NAMES_FLAG, true)
    centralView.setUint16(10, entry.compress ? DEFLATED : STORED, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, entry.bytes.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, CENTRAL_HEADER_LENGTH)

    localParts.push(local, data)
    centralParts.push(central)
    offset += local.length + data.length
  }

  const centralLength = centralParts.reduce((total, part) => total + part.length, 0)
  const end = new Uint8Array(END_OF_CENTRAL_DIRECTORY_LENGTH)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralLength, true)
  endView.setUint32(16, offset, true)
  return concatenate([...localParts, ...centralParts, end])
}

/** Lists the files of an archive; directories are left out. Throws when the archive is malformed or over the limits. */
export function readZip(bytes: Uint8Array<ArrayBuffer>, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const endOffset = findEndOfCentralDirectory(view)
  const entryCount = view.getUint16(endOffset + 10, true)
  const centralOffset = view.getUint32(endOffset + 16, true)
  if (entryCount > limits.maximumEntries) {
    throw new ArchiveError({ code: 'tooManyFiles', fileCount: entryCount })
  }

  const entries: ZipEntry[] = []
  const paths = new Set<string>()
  let totalSize = 0
  let position = centralOffset
  for (let index = 0; index < entryCount; index++) {
    if (position + CENTRAL_HEADER_LENGTH > bytes.length || view.getUint32(position, true) !== CENTRAL_HEADER_SIGNATURE) {
      throw new ArchiveError({ code: 'fileListCutShort' })
    }
    const flags = view.getUint16(position + 8, true)
    const method = view.getUint16(position + 10, true)
    const checksum = view.getUint32(position + 16, true)
    const compressedSize = view.getUint32(position + 20, true)
    const size = view.getUint32(position + 24, true)
    const nameLength = view.getUint16(position + 28, true)
    const extraLength = view.getUint16(position + 30, true)
    const commentLength = view.getUint16(position + 32, true)
    const localOffset = view.getUint32(position + 42, true)
    const path = decodeName(bytes.subarray(position + CENTRAL_HEADER_LENGTH, position + CENTRAL_HEADER_LENGTH + nameLength))
    position += CENTRAL_HEADER_LENGTH + nameLength + extraLength + commentLength

    if (path.endsWith('/')) {
      continue
    }
    checkPath(path)
    if (paths.has(path)) {
      throw new ArchiveError({ code: 'duplicateFile', path })
    }
    paths.add(path)
    if ((flags & ENCRYPTED_FLAG) !== 0) {
      throw new ArchiveError({ code: 'encryptedFile', path })
    }
    if (method !== STORED && method !== DEFLATED) {
      throw new ArchiveError({ code: 'unknownCompression', path })
    }
    if (compressedSize === ZIP64_MARKER || size === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
      throw new ArchiveError({ code: 'fileTooLarge', path })
    }
    totalSize += size
    if (size > limits.maximumEntrySize || totalSize > limits.maximumTotalSize) {
      throw new ArchiveError({ code: 'fileTooLarge', path })
    }
    if (localOffset + LOCAL_HEADER_LENGTH > bytes.length || view.getUint32(localOffset, true) !== LOCAL_HEADER_SIGNATURE) {
      throw new ArchiveError({ code: 'damagedFile', path })
    }
    const dataOffset = localOffset + LOCAL_HEADER_LENGTH + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    if (dataOffset + compressedSize > bytes.length) {
      throw new ArchiveError({ code: 'damagedFile', path })
    }
    const data = bytes.subarray(dataOffset, dataOffset + compressedSize)

    entries.push({
      path,
      size,
      read: async () => {
        const content = method === STORED ? data.slice() : await inflate(data, size, path)
        if (content.length !== size || crc32(content) !== checksum) {
          throw new ArchiveError({ code: 'damagedFile', path })
        }
        return content
      },
    })
  }
  return entries
}

/** Relative paths of plain names only: no climbing up, no root, no drive, no backslash. */
export function isSafeArchivePath(path: string): boolean {
  return path.length > 0 && path.length <= 512
    && !/[\\:\p{Cc}]/u.test(path)
    && path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

function checkPath(path: string) {
  if (!isSafeArchivePath(path)) {
    throw new ArchiveError({ code: 'invalidPath', path })
  }
}

function decodeName(bytes: Uint8Array<ArrayBuffer>): string {
  try {
    return decoder.decode(bytes)
  } catch {
    throw new ArchiveError({ code: 'invalidPath', path: null })
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const lowestOffset = Math.max(0, view.byteLength - END_OF_CENTRAL_DIRECTORY_LENGTH - MAXIMUM_COMMENT_LENGTH)
  for (let offset = view.byteLength - END_OF_CENTRAL_DIRECTORY_LENGTH; offset >= lowestOffset; offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset
    }
  }
  throw new ArchiveError({ code: 'notZip' })
}

/** Inflates chunk by chunk, giving up as soon as the output exceeds what the entry declares. */
async function inflate(data: Uint8Array<ArrayBuffer>, declaredSize: number, path: string): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      length += value.length
      if (length > declaredSize) {
        throw new ArchiveError({ code: 'largerThanDeclared', path })
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error instanceof ArchiveError ? error : new ArchiveError({ code: 'damagedFile', path })
  }
  return concatenate(chunks)
}

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())
}

function concatenate(parts: readonly Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function dosDateTime(moment: Date): { time: number; date: number } {
  const year = Math.min(Math.max(moment.getUTCFullYear(), 1980), 2107)
  return {
    time: (moment.getUTCHours() << 11) | (moment.getUTCMinutes() << 5) | Math.floor(moment.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((moment.getUTCMonth() + 1) << 5) | moment.getUTCDate(),
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value
})

function crc32(bytes: Uint8Array<ArrayBuffer>): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
