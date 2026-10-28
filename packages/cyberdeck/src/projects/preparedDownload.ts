import { safeFileName as fileNameFor } from '@cyberdeck/core'
import type { Locale } from '@cyberdeck/stage'
import { onUnmounted, shallowRef } from 'vue'
import { commonMessages } from '../i18n/commonMessages'

/** Word and Notepad recognise UTF-8 text by this mark; the import ignores it. */
const BYTE_ORDER_MARK = '\uFEFF'

/** A file made in the page, offered as a download link until replaced or the screen closes. */
export function usePreparedDownload() {
  const prepared = shallowRef<{ fileName: string; url: string; byteSize: number } | null>(null)

  function forget() {
    if (prepared.value !== null) {
      URL.revokeObjectURL(prepared.value.url)
      prepared.value = null
    }
  }

  /** Archives are bytes; text is written as UTF-8. */
  function offer(fileName: string, content: Uint8Array<ArrayBuffer> | string) {
    forget()
    const blob = typeof content === 'string'
      ? new Blob([BYTE_ORDER_MARK + content], { type: 'text/plain;charset=utf-8' })
      : new Blob([content], { type: 'application/zip' })
    prepared.value = { fileName, url: URL.createObjectURL(blob), byteSize: blob.size }
  }

  onUnmounted(forget)
  return { prepared, offer, forget }
}

export function formatSize(byteSize: number, locale: Locale): string {
  const text = commonMessages[locale]
  return byteSize < 1024 * 1024 ? text.kilobytes(Math.max(1, Math.round(byteSize / 1024))) : text.megabytes(byteSize / 1024 / 1024)
}

/** A name every system accepts for a downloaded file. */
export function safeFileName(name: string, locale: Locale): string {
  return fileNameFor(name, commonMessages[locale].untitled)
}
