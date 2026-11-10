import type { Counter } from './storyFormat'

/**
 * A counter with decimals keeps whole numbers of its smallest unit, hundredths for `1000.00`: so
 * every sum and comparison is exact. These turn its units into what people read and write, and back.
 */

function scaleOf(counter: Pick<Counter, 'decimals'>): number {
  return 10 ** (counter.decimals ?? 0)
}

/** As a tag writes it, with as many decimals as the counter keeps and a point: `1000.50`, `-0.25`, `3`. */
export function writtenAmount(units: number, counter: Pick<Counter, 'decimals'>): string {
  const decimals = counter.decimals ?? 0
  if (decimals === 0) {
    return String(units)
  }
  const whole = Math.trunc(Math.abs(units) / scaleOf(counter))
  const fraction = String(Math.abs(units) % scaleOf(counter)).padStart(decimals, '0')
  return `${units < 0 ? '-' : ''}${whole}.${fraction}`
}

/**
 * As players read it, in the language of the game: a counter with decimals as that language writes
 * numbers (`1,000.50`, `1 000,50`); a whole counter as before, digits alone.
 */
export function shownAmount(units: number, counter: Pick<Counter, 'decimals'>, locale: string): string {
  const decimals = counter.decimals ?? 0
  if (decimals === 0) {
    return String(units)
  }
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(units / scaleOf(counter))
  } catch {
    return writtenAmount(units, counter)
  }
}

/** As a save keeps it, a plain number that reads as the story writes it: 1000.5 for 100050 hundredths. */
export function savedAmount(units: number, counter: Pick<Counter, 'decimals'>): number {
  return units / scaleOf(counter)
}

/** A number from a save, in the counter's units, rounded to what it keeps. */
export function unitsFromSaved(amount: number, counter: Pick<Counter, 'decimals'>): number {
  return Math.round(amount * scaleOf(counter))
}

/** Why a number typed is not taken: nothing typed, not a number, more decimals than kept, out of bounds. */
export type TypedNumberProblem = 'empty' | 'notANumber' | 'tooPrecise' | 'belowMinimum' | 'aboveMaximum'

/**
 * Reads a number a player typed, in the counter's units: digits, at most one decimal sign, a comma
 * or a point whatever the language (no thousands separators being needed, a single one can only be
 * that), spaces ignored, a sign in front. Then checks it keeps no more decimals than the counter and
 * lies within the bounds, in the same units, null for none.
 */
export function readTypedNumber(typed: string, counter: Pick<Counter, 'decimals'>, minimum: number | null, maximum: number | null): { units: number } | { problem: TypedNumberProblem } {
  const text = typed.replace(/[\s  ]/g, '').replace('−', '-')
  if (text === '') {
    return { problem: 'empty' }
  }
  const parts = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(text)
  if (parts === null || (parts[2] === '' && (parts[3] ?? '') === '') || parts[2]!.length > 12) {
    return { problem: 'notANumber' }
  }
  const decimals = counter.decimals ?? 0
  // Zeros count too: `1,000` for a counter of whole numbers was most likely meant as a thousand.
  const fraction = parts[3] ?? ''
  if (fraction.length > decimals) {
    return { problem: 'tooPrecise' }
  }
  const magnitude = Number(parts[2] === '' ? '0' : parts[2]) * scaleOf(counter) + Number(fraction.padEnd(decimals, '0') || '0')
  const units = parts[1] === '-' ? -magnitude : magnitude
  if (minimum !== null && units < minimum) {
    return { problem: 'belowMinimum' }
  }
  if (maximum !== null && units > maximum) {
    return { problem: 'aboveMaximum' }
  }
  return { units: units === 0 ? 0 : units }
}
