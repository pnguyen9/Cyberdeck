import type { InjectionKey, Ref } from 'vue'
import { useMediaQuery } from '../app/mediaQuery'
import type { MotionChoice } from './playerSettings'

/** Whether the player asks for less motion, given to every picture of the player. */
export const LESS_MOTION: InjectionKey<Readonly<Ref<boolean>>> = Symbol('lessMotion')

const LESS_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Whether the system asks for less motion, its accessibility setting as the browser tells it. */
export function systemAsksLessMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(LESS_MOTION_QUERY).matches === true
}

/** Less motion, chosen in the settings or, by default, asked by the system. */
export function wantsLessMotion(choice: MotionChoice, systemAsks: boolean): boolean {
  return choice === 'less' || (choice === 'system' && systemAsks)
}

/** The system's wish for less motion, followed while the component lives. */
export function useSystemLessMotion(): Readonly<Ref<boolean>> {
  return useMediaQuery(LESS_MOTION_QUERY)
}
