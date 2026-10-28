import type { Locale } from '../i18n/locale'
import { inputMessages } from '../i18n/inputMessages'

/** What the player can do with an input. */
export type PlayerAction = 'advance' | 'back' | 'log' | 'skip' | 'hideText' | 'settings' | 'fullscreen' | 'leave'

/**
 * An input that triggers an action. Keys are identified by physical position (`KeyboardEvent.code`),
 * so that a binding means the same key on AZERTY and QWERTY keyboards.
 */
export type InputBinding =
  | { type: 'key'; code: string }
  | { type: 'mouseButton'; button: number }
  | { type: 'wheel'; direction: 'up' | 'down' }

export type Bindings = Readonly<Record<PlayerAction, readonly InputBinding[]>>

/** `MouseEvent.button` values. */
export const MOUSE_BUTTON = { main: 0, middle: 1, secondary: 2, back: 3, forward: 4 } as const

export const DEFAULT_BINDINGS: Bindings = {
  advance: [
    { type: 'key', code: 'Space' },
    { type: 'key', code: 'Enter' },
    { type: 'key', code: 'NumpadEnter' },
    { type: 'key', code: 'ArrowRight' },
    { type: 'mouseButton', button: MOUSE_BUTTON.main },
    { type: 'mouseButton', button: MOUSE_BUTTON.forward },
    { type: 'wheel', direction: 'down' },
  ],
  back: [
    { type: 'key', code: 'ArrowLeft' },
    { type: 'key', code: 'Backspace' },
    { type: 'key', code: 'PageUp' },
    { type: 'mouseButton', button: MOUSE_BUTTON.back },
    { type: 'wheel', direction: 'up' },
  ],
  log: [
    { type: 'key', code: 'KeyL' },
  ],
  skip: [
    { type: 'key', code: 'KeyS' },
  ],
  hideText: [
    { type: 'key', code: 'KeyH' },
    { type: 'mouseButton', button: MOUSE_BUTTON.secondary },
  ],
  settings: [
    { type: 'key', code: 'KeyO' },
  ],
  fullscreen: [
    { type: 'key', code: 'KeyF' },
  ],
  leave: [
    { type: 'key', code: 'Escape' },
  ],
}

function findAction(bindings: Bindings, matches: (binding: InputBinding) => boolean): PlayerAction | null {
  const actions = Object.keys(bindings) as PlayerAction[]
  return actions.find(action => bindings[action].some(matches)) ?? null
}

export function actionForKey(bindings: Bindings, code: string): PlayerAction | null {
  return findAction(bindings, binding => binding.type === 'key' && binding.code === code)
}

export function actionForMouseButton(bindings: Bindings, button: number): PlayerAction | null {
  return findAction(bindings, binding => binding.type === 'mouseButton' && binding.button === button)
}

/** `deltaY` as in `WheelEvent`: negative when the wheel turns up. */
export function actionForWheel(bindings: Bindings, deltaY: number): PlayerAction | null {
  if (deltaY === 0) {
    return null
  }
  const direction = deltaY < 0 ? 'up' : 'down'
  return findAction(bindings, binding => binding.type === 'wheel' && binding.direction === direction)
}

function isSameInput(first: InputBinding, second: InputBinding): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

/** Gives `input` to `action`, taking it from whichever action had it. Returns new bindings. */
export function rebind(bindings: Bindings, action: PlayerAction, input: InputBinding): Bindings {
  const actions = Object.keys(bindings) as PlayerAction[]
  const withoutInput = Object.fromEntries(
    actions.map(candidate => [candidate, bindings[candidate].filter(binding => !isSameInput(binding, input))]),
  ) as Record<PlayerAction, InputBinding[]>
  return { ...withoutInput, [action]: [...withoutInput[action], input] }
}

/** Removes an input from an action. */
export function unbind(bindings: Bindings, action: PlayerAction, input: InputBinding): Bindings {
  return { ...bindings, [action]: bindings[action].filter(binding => !isSameInput(binding, input)) }
}

/** The action that has the input, if any: the one it is taken from when given to another. */
export function actionOf(bindings: Bindings, input: InputBinding): PlayerAction | null {
  return findAction(bindings, binding => isSameInput(binding, input))
}

const MOUSE_BUTTON_NAMES = Object.fromEntries(Object.entries(MOUSE_BUTTON).map(([name, button]) => [button, name])) as Readonly<Record<number, keyof typeof MOUSE_BUTTON>>

/**
 * An input as players call it, in their language. Keys are named after the US layout, which `code`
 * follows: on another layout the key is the one at that place.
 */
export function describeInput(input: InputBinding, locale: Locale = 'en'): string {
  const names = inputMessages[locale]
  switch (input.type) {
    case 'key': {
      const keypadKey = /^Numpad(.+)$/.exec(input.code)
      return names.keys[input.code]
        ?? (keypadKey === null ? input.code.replace(/^(Key|Digit)/, '') : names.keypadKey(names.keypadSymbols[keypadKey[1]!] ?? keypadKey[1]!))
    }
    case 'mouseButton': {
      const buttonName = MOUSE_BUTTON_NAMES[input.button]
      return buttonName === undefined ? names.mouseButton(input.button + 1) : names.mouseButtons[buttonName]
    }
    case 'wheel':
      return input.direction === 'up' ? names.wheelUp : names.wheelDown
  }
}
