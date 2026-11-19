import { shallowRef } from 'vue'
import type { ProfileLocks } from './profileLocks'

/** What the PIN dialog is opened for: entering the profile, letting an action on its data go on, or setting the PIN. */
export type PinPurpose = 'enter' | 'confirm' | 'manage'

export interface PinAsked {
  profile: { id: string; name: string }
  purpose: PinPurpose
  /** Runs once the right PIN is entered, or the PIN set, changed or removed, with what to tell the player. */
  then: (message: string | null) => void
}

/** The PIN asked of a view, before what it guards: shown while `asked` is not null. */
export function usePinAsk(locks: ProfileLocks) {
  const asked = shallowRef<PinAsked | null>(null)
  return {
    asked,
    /** Runs the action directly for a profile without a PIN; asks it first otherwise. */
    withPin(profile: PinAsked['profile'], purpose: 'enter' | 'confirm', action: () => unknown) {
      if (locks.isLocked(profile.id)) {
        asked.value = { profile, purpose, then: () => void action() }
      } else {
        void action()
      }
    },
    managePin(profile: PinAsked['profile'], then: (message: string | null) => void) {
      asked.value = { profile, purpose: 'manage', then }
    },
    pinDone(message: string | null) {
      const shown = asked.value
      asked.value = null
      shown?.then(message)
    },
    pinClosed() {
      asked.value = null
    },
  }
}
