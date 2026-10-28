/** The names of keys and mouse buttons, as players of each language call them. */
const en = {
  /** Keys named otherwise than by their code. */
  keys: {
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Keypad Enter',
    Escape: 'Esc',
    Backspace: 'Backspace',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
  } as Readonly<Record<string, string>>,
  /** The keys of the keypad, `Numpad` and what follows in their code. */
  keypadSymbols: {} as Readonly<Record<string, string>>,
  keypadKey: (name: string) => `Keypad ${name}`,
  mouseButtons: {
    main: 'Left click',
    middle: 'Middle click',
    secondary: 'Right click',
    back: 'Mouse back button',
    forward: 'Mouse forward button',
  },
  /** A button without a name, numbered from 1. */
  mouseButton: (number: number) => `Mouse button ${number}`,
  wheelUp: 'Wheel up',
  wheelDown: 'Wheel down',
}

type InputMessages = typeof en

const fr: InputMessages = {
  keys: {
    Space: 'Espace',
    Enter: 'Entrée',
    NumpadEnter: 'Entrée (pavé numérique)',
    Escape: 'Échap',
    Backspace: 'Retour arrière',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    PageUp: 'Page préc.',
    PageDown: 'Page suiv.',
    Tab: 'Tab',
    Delete: 'Suppr',
    Insert: 'Inser',
    Home: 'Origine',
    End: 'Fin',
    ShiftLeft: 'Maj gauche',
    ShiftRight: 'Maj droite',
    ControlLeft: 'Ctrl gauche',
    ControlRight: 'Ctrl droite',
    AltLeft: 'Alt',
    AltRight: 'Alt Gr',
    CapsLock: 'Verr. Maj',
  },
  keypadSymbols: {
    Add: '+',
    Subtract: '-',
    Multiply: '*',
    Divide: '/',
    Decimal: '.',
    Comma: ',',
    Equal: '=',
  },
  keypadKey: name => `${name} (pavé numérique)`,
  mouseButtons: {
    main: 'Clic gauche',
    middle: 'Clic molette',
    secondary: 'Clic droit',
    back: 'Bouton Précédent de la souris',
    forward: 'Bouton Suivant de la souris',
  },
  mouseButton: number => `Bouton ${number} de la souris`,
  wheelUp: 'Molette vers le haut',
  wheelDown: 'Molette vers le bas',
}

export const inputMessages = { en, fr }
