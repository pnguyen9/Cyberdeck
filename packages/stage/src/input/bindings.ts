import type { Locale } from '../i18n/locale'
import { inputMessages } from '../i18n/inputMessages'
import { codePrinting, printedOn } from './keyboardLayout'

/** What the player can do with an input. */
export type PlayerAction = 'advance' | 'back' | 'log' | 'journal' | 'save' | 'load' | 'skip' | 'auto' | 'map' | 'hideText' | 'settings' | 'fullscreen' | 'leave' | 'markTile'

/**
 * Actions of a grid that marks, `marking Flag`, done on its tiles alone: their inputs may be the
 * everyday actions' too, which they keep everywhere else.
 */
const GRID_ACTIONS: readonly PlayerAction[] = ['markTile']
const isGridAction = (action: PlayerAction) => GRID_ACTIONS.includes(action)

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

/**
 * The default inputs, letters at their place on a US keyboard: `defaultBindings` moves them to the
 * keys printing the same letters on the player's keyboard.
 */
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
  journal: [
    { type: 'key', code: 'KeyJ' },
  ],
  save: [
    { type: 'key', code: 'KeyK' },
  ],
  load: [
    { type: 'key', code: 'KeyD' },
  ],
  auto: [
    { type: 'key', code: 'KeyA' },
  ],
  skip: [
    { type: 'key', code: 'KeyS' },
  ],
  map: [
    { type: 'key', code: 'KeyM' },
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
  markTile: [
    { type: 'key', code: 'KeyF' },
    { type: 'mouseButton', button: MOUSE_BUTTON.secondary },
  ],
}

export const PLAYER_ACTIONS = Object.keys(DEFAULT_BINDINGS) as PlayerAction[]

/** The default inputs on the player's keyboard: Auto mode on the key printing A, whatever its place. */
export function defaultBindings(): Bindings {
  const onPlayersKeyboard = (binding: InputBinding): InputBinding => {
    const letter = binding.type === 'key' ? /^Key([A-Z])$/.exec(binding.code)?.[1] : undefined
    const code = letter === undefined ? undefined : codePrinting(letter.toLowerCase())
    return code === undefined ? binding : { type: 'key', code }
  }
  return Object.fromEntries(PLAYER_ACTIONS.map(action => [action, DEFAULT_BINDINGS[action].map(onPlayersKeyboard)])) as Record<PlayerAction, InputBinding[]>
}

/** The first key of an action, as its button shows it, if it has one. */
export function firstKeyOf(bindings: Bindings, action: PlayerAction): InputBinding | undefined {
  return bindings[action].find(binding => binding.type === 'key')
}

/** The everyday action an input does, or with `onGrid`, the grid's action. */
function findAction(bindings: Bindings, matches: (binding: InputBinding) => boolean, onGrid = false): PlayerAction | null {
  const actions = (Object.keys(bindings) as PlayerAction[]).filter(action => isGridAction(action) === onGrid)
  return actions.find(action => bindings[action].some(matches)) ?? null
}

/** Whether an input marks a tile, on a grid that marks. */
export function marksTile(bindings: Bindings, input: InputBinding): boolean {
  return bindings.markTile.some(binding => isSameInput(binding, input))
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

/** Whether two inputs, or two lists of inputs, are the same. */
export function isSameInput<Input extends InputBinding | readonly InputBinding[]>(first: Input, second: Input): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

/**
 * Whether a key press may be a binding's: bindings hold single keys, so with Ctrl, Alt or ⌘ held the
 * key is the browser's or the system's shortcut. The modifier keys themselves may be bound.
 */
export function isPlainKeyPress(event: KeyboardEvent): boolean {
  return !(event.ctrlKey || event.altKey || event.metaKey) || /^(Control|Alt|Meta|Shift|OS)/.test(event.code)
}

/**
 * Gives `input` to `action`, taking it from whichever action had it: an everyday action from another,
 * a grid's from another of the grid's. Returns new bindings.
 */
export function rebind(bindings: Bindings, action: PlayerAction, input: InputBinding): Bindings {
  const actions = Object.keys(bindings) as PlayerAction[]
  const withoutInput = Object.fromEntries(actions.map(candidate => [
    candidate,
    isGridAction(candidate) === isGridAction(action) ? bindings[candidate].filter(binding => !isSameInput(binding, input)) : bindings[candidate],
  ])) as Record<PlayerAction, InputBinding[]>
  return { ...withoutInput, [action]: [...withoutInput[action], input] }
}

/** Removes an input from an action. */
export function unbind(bindings: Bindings, action: PlayerAction, input: InputBinding): Bindings {
  return { ...bindings, [action]: bindings[action].filter(binding => !isSameInput(binding, input)) }
}

/** The action that has the input among those of its kind, if any: the one it is taken from when given to `action`. */
export function actionOf(bindings: Bindings, input: InputBinding, action: PlayerAction): PlayerAction | null {
  return findAction(bindings, binding => isSameInput(binding, input), isGridAction(action))
}

const MOUSE_BUTTON_NAMES = Object.fromEntries(Object.entries(MOUSE_BUTTON).map(([name, button]) => [button, name])) as Readonly<Record<number, keyof typeof MOUSE_BUTTON>>

/**
 * An input as players call it, in their language. A key is named by what it prints on the player's
 * keyboard where the browser tells it, else after the US layout, which `code` follows.
 */
export function describeInput(input: InputBinding, locale: Locale = 'en'): string {
  const names = inputMessages[locale]
  switch (input.type) {
    case 'key': {
      const keypadKey = /^Numpad(.+)$/.exec(input.code)
      return names.keys[input.code]
        ?? printedOn(input.code)?.replace(/^[a-z]$/, letter => letter.toUpperCase())
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
