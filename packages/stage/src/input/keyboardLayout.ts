import { shallowRef } from 'vue'

/** What a key prints, by `KeyboardEvent.code`, on the player's keyboard. */
export type KeyboardLayout = ReadonlyMap<string, string>

/** The Keyboard API of Chromium browsers and Electron; Firefox and Safari have none. */
interface LayoutReader {
  keyboard?: { getLayoutMap?: () => Promise<KeyboardLayout> }
}

const layout = shallowRef<KeyboardLayout | null>(null)

/**
 * Reads the player's keyboard layout, where the browser tells it, so that default keys and key
 * names follow the letters printed on the keys. Resolves within `timeoutMs` either way: an
 * application awaits it before reading the player's settings, and starts without it if it is slow.
 */
export async function readKeyboardLayout(timeoutMs = 500): Promise<void> {
  const reader = (globalThis.navigator as LayoutReader | undefined)?.keyboard
  if (reader?.getLayoutMap === undefined) {
    return
  }
  try {
    // An empty map, as some systems give, tells nothing.
    const read = reader.getLayoutMap().then(map => { layout.value = map.size === 0 ? null : map }, () => undefined)
    await Promise.race([read, new Promise(resolve => setTimeout(resolve, timeoutMs))])
  } catch {
    // The keys stay named and placed as on a US keyboard.
  }
}

/** Sets the layout as if read from the browser; `null` stands for a browser that does not tell it. */
export function setKeyboardLayout(map: KeyboardLayout | null) {
  layout.value = map
}

/** Whether the browser told the player's keyboard layout: keys are then named as printed. Reactive. */
export function knowsKeyboardLayout(): boolean {
  return layout.value !== null
}

/** What the key at `code` prints on the player's keyboard, when known. Reactive: a template using it follows the layout. */
export function printedOn(code: string): string | undefined {
  return layout.value?.get(code)
}

/** The code of the key printing `character` on the player's keyboard, when known. */
export function codePrinting(character: string): string | undefined {
  const map = layout.value
  if (map === null) {
    return undefined
  }
  for (const [code, printed] of map) {
    if (printed === character) {
      return code
    }
  }
  return undefined
}
