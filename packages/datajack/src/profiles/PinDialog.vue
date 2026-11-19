<script setup lang="ts">
import { useBackdropClose, useMessages } from '@cyberdeck/stage'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { pinMessages } from '../i18n/pinMessages'
import type { PinPurpose } from './pinAsk'
import { PIN_LENGTH, type ProfileLocks } from './profileLocks'

/**
 * The PIN of a profile, over the screen: entered to open the profile or to let an action on its data
 * go on, or chosen, changed or removed. Typed on the keyboard or on its digits, for a tablet; OK, or
 * Enter, sends it.
 */
const props = defineProps<{ locks: ProfileLocks; profile: { id: string; name: string }; purpose: PinPurpose }>()
const emit = defineEmits<{ done: [message: string | null]; close: [] }>()
const text = useMessages(pinMessages)
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const input = useTemplateRef<HTMLInputElement>('input')
const backdrop = useBackdropClose(dialog)

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
/** On a touch screen the system's keyboard would cover the dialog's digits: the field opens none. */
const inputMode = window.matchMedia?.('(pointer: coarse)').matches ? 'none' : 'numeric'
const isDesktop = window.datajackDesktop !== undefined
const wasLocked = props.locks.isLocked(props.profile.id)
/** Managing a PIN already set starts with a choice: change it, or remove it. */
const step = ref<'choice' | 'current' | 'new' | 'repeat'>(props.purpose !== 'manage' ? 'current' : wasLocked ? 'choice' : 'new')
const intent = ref<'change' | 'remove'>('change')
const entry = ref('')
const chosen = ref('')
const errorMessage = ref<string | null>(null)
/** While the PIN is hashed or kept: nothing else is done, not even closing. */
const isChecking = ref(false)
/** While too many wrong PINs make the player wait, when that ends; the clock ticks the seconds left. */
const waitEnds = ref<number | null>(null)
/** The whole wait, said once to screen readers; the ticking clock is only seen. */
const waitSeconds = ref(0)
const clock = ref(Date.now())
const secondsLeft = computed(() => waitEnds.value === null ? 0 : Math.max(1, Math.ceil((waitEnds.value - clock.value) / 1000)))
const countdown = computed(() => `${Math.floor(secondsLeft.value / 60)}:${String(secondsLeft.value % 60).padStart(2, '0')}`)
const isBlocked = computed(() => isChecking.value || waitEnds.value !== null)

const hint = computed(() => {
  switch (step.value) {
    case 'choice':
      return text.value.manageHint(props.profile.name)
    case 'new':
      return text.value.choose(props.profile.name)
    case 'repeat':
      return text.value.repeat
    case 'current':
      return props.purpose === 'enter' ? text.value.toPlay(props.profile.name)
        : props.purpose === 'confirm' ? text.value.toConfirm(props.profile.name)
          : intent.value === 'change' ? text.value.toChange : text.value.toRemove
  }
})
const fieldLabel = computed(() => step.value === 'new' ? text.value.newPin
  : step.value === 'repeat' ? text.value.repeatPin
    : props.purpose === 'manage' ? text.value.currentPin : text.value.pin)

let ticking: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  dialog.value?.showModal()
  startWait(props.locks.waitUntil(props.profile.id))
  ticking = setInterval(tick, 250)
  void focusField()
})
onUnmounted(() => clearInterval(ticking))

function startWait(until: number | null) {
  clock.value = Date.now()
  waitEnds.value = until
  if (until !== null) {
    waitSeconds.value = Math.max(1, Math.ceil((until - clock.value) / 1000))
  }
}

function tick() {
  clock.value = Date.now()
  if (waitEnds.value !== null) {
    // Read again, rather than counted down: the wait is kept with the lock, a reload does not end it.
    waitEnds.value = props.locks.waitUntil(props.profile.id)
    if (waitEnds.value === null) {
      errorMessage.value = null
      void focusField()
    }
  }
}

async function focusField() {
  await nextTick()
  input.value?.focus()
}

function begin(chosenIntent: 'change' | 'remove') {
  intent.value = chosenIntent
  step.value = 'current'
  void focusField()
}

/** Only digits are kept, as many as a PIN has. */
function type(value: string, field?: HTMLInputElement) {
  entry.value = value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH)
  if (field !== undefined) {
    field.value = entry.value
  }
}

function press(digit: string) {
  if (!isBlocked.value) {
    type(entry.value + digit)
    void focusField()
  }
}

function eraseDigit() {
  entry.value = entry.value.slice(0, -1)
}

/** Closing waits while the PIN is hashed or kept. */
function close() {
  if (!isChecking.value) {
    dialog.value?.close()
  }
}

function onCancel(event: Event) {
  if (isChecking.value) {
    event.preventDefault()
  }
}

function onBackdropClick(event: MouseEvent) {
  if (!isChecking.value) {
    backdrop.onClick(event)
  }
}

/**
 * Runs what reads or keeps the PIN, the field disabled meanwhile, then gives it the focus back;
 * storage full or blocked, or no hashing, says so instead of hanging.
 */
async function guarded(work: () => Promise<void>) {
  isChecking.value = true
  try {
    await work()
  } catch {
    errorMessage.value = text.value.failed
  } finally {
    isChecking.value = false
  }
  return focusField()
}

function submit() {
  if (isBlocked.value || entry.value.length !== PIN_LENGTH) {
    return
  }
  const pin = entry.value
  entry.value = ''
  errorMessage.value = null
  switch (step.value) {
    case 'current':
      return guarded(() => checkCurrent(pin))
    case 'new':
      chosen.value = pin
      step.value = 'repeat'
      return focusField()
    case 'repeat':
      if (pin !== chosen.value) {
        errorMessage.value = text.value.differ
        step.value = 'new'
        return focusField()
      }
      return guarded(async () => {
        await props.locks.set(props.profile.id, pin)
        emit('done', wasLocked ? text.value.changed(props.profile.name) : text.value.isSet(props.profile.name))
      })
  }
}

async function checkCurrent(pin: string) {
  const result = await props.locks.check(props.profile.id, pin)
  if (result.outcome === 'wrong') {
    errorMessage.value = text.value.wrong(result.triesLeft)
    return
  }
  if (result.outcome === 'wait') {
    return startWait(result.until)
  }
  if (props.purpose !== 'manage') {
    emit('done', null)
  } else if (intent.value === 'remove') {
    props.locks.remove(props.profile.id)
    emit('done', text.value.removed(props.profile.name))
  } else {
    step.value = 'new'
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="pin-dialog"
    aria-labelledby="pin-title"
    aria-describedby="pin-hint"
    @close="emit('close')"
    @cancel="onCancel"
    @pointerdown="backdrop.onPointerDown"
    @click="onBackdropClick"
    @keydown.stop
  >
    <h2 id="pin-title">{{ text.pinOf(profile.name) }}</h2>
    <p id="pin-hint" class="hint">{{ hint }}</p>

    <div v-if="step === 'choice'" class="actions stacked">
      <button type="button" class="button primary" @click="begin('change')">{{ text.change }}</button>
      <button type="button" class="button danger" @click="begin('remove')">{{ text.remove }}</button>
      <button type="button" class="button" @click="close">{{ text.cancel }}</button>
    </div>

    <form v-else class="pin-form" @submit.prevent="submit">
      <label class="pin-field">
        <span>{{ fieldLabel }}</span>
        <!-- A text field shown as dots, not a password one: browsers then offer no password to save. -->
        <input
          ref="input"
          :key="step"
          class="pin-input"
          :value="entry"
          type="text"
          :inputmode="inputMode"
          pattern="[0-9]*"
          :maxlength="PIN_LENGTH"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="isBlocked"
          :aria-invalid="errorMessage !== null"
          aria-describedby="pin-problem"
          @input="type(($event.target as HTMLInputElement).value, $event.target as HTMLInputElement)"
        >
      </label>
      <div class="keypad" role="group" :aria-label="text.digits">
        <button v-for="digit in DIGITS" :key="digit" type="button" class="key" :disabled="isBlocked" @click="press(digit)">{{ digit }}</button>
        <button type="button" class="key" :aria-label="text.eraseDigit" :title="text.eraseDigit" :disabled="isBlocked || entry === ''" @click="eraseDigit">⌫</button>
        <button type="button" class="key" :disabled="isBlocked" @click="press('0')">0</button>
        <button type="submit" class="key confirm" :disabled="isBlocked || entry.length !== PIN_LENGTH">{{ text.confirm }}</button>
      </div>
      <div id="pin-problem">
        <template v-if="waitEnds !== null">
          <p class="error" role="status">{{ text.wait(text.duration(waitSeconds)) }}</p>
          <p class="countdown" aria-hidden="true">{{ countdown }}</p>
        </template>
        <p v-else-if="errorMessage !== null" class="error" role="alert">{{ errorMessage }}</p>
      </div>
      <details v-if="purpose !== 'manage'" class="forgot">
        <summary>{{ text.forgot }}</summary>
        <p>{{ isDesktop ? text.forgotDesktop() : text.forgotWeb }}</p>
      </details>
      <div class="actions">
        <button type="button" class="button" :disabled="isChecking" @click="close">{{ text.cancel }}</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.pin-dialog {
  box-sizing: border-box;
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 20px 24px;
  border: var(--look-border-width) var(--look-border-style) var(--look-border-colour);
  border-radius: 10px;
  background: var(--look-ground);
  font: 15px/1.5 var(--look-font);
  color: var(--look-text);
}

.pin-dialog::backdrop {
  background: rgb(0 0 0 / 0.6);
}

h2 {
  margin: 0;
  font-size: 22px;
  color: var(--look-accent);
}

.hint {
  margin: 4px 0 16px;
  color: var(--look-soft);
}

.pin-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pin-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pin-field > span {
  font-size: 14px;
  color: var(--look-soft);
}

.pin-input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: var(--look-control-border);
  border-radius: 6px;
  background: var(--look-surface);
  font: 600 24px/1.2 var(--look-font);
  letter-spacing: 0.5em;
  text-align: center;
  color: inherit;
  -webkit-text-security: disc;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.key {
  min-height: 48px;
  border: var(--look-control-border);
  border-radius: 6px;
  background: var(--look-surface);
  font: 600 20px/1 var(--look-font);
  color: var(--look-text);
  cursor: pointer;
  touch-action: manipulation;
}

.key.confirm {
  font-size: 16px;
  border-color: var(--look-accent);
  color: var(--look-accent);
}

.key:hover:not(:disabled) {
  border-color: var(--look-accent);
}

.key:disabled {
  opacity: 0.5;
  cursor: default;
}

.error {
  margin: 0;
  color: var(--look-error);
}

.countdown {
  margin: 4px 0 0;
  font: 600 20px/1.2 var(--look-font);
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--look-soft);
}

.forgot {
  font-size: 14px;
  color: var(--look-soft);
}

.forgot summary {
  width: fit-content;
  cursor: pointer;
}

.forgot p {
  margin: 4px 0 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* The choice of what to do with a PIN, one button under the other: long labels do not wrap badly. */
.actions.stacked {
  flex-direction: column;
  align-items: stretch;
}

.pin-dialog :focus-visible {
  outline: 2px solid var(--look-focus);
  outline-offset: 2px;
}
</style>
