import { describe, expect, it } from 'vitest'
import { storyLocale, storyMessages } from '../src/i18n/storyMessages'

describe("the game's own words", () => {
  it('follow the language of the game, whoever plays it', () => {
    expect(storyLocale({ locale: 'fr' })).toBe('fr')
    expect(storyLocale({ locale: 'fr-CA' })).toBe('fr')
    expect(storyLocale({ locale: 'en-GB' })).toBe('en')
  })

  it('are English for a game in a language the player does not speak', () => {
    expect(storyLocale({ locale: 'de' })).toBe('en')
    expect(storyLocale({ locale: '' })).toBe('en')
  })

  it('end a French game in French, with its typography', () => {
    const french = storyMessages[storyLocale({ locale: 'fr' })]
    expect(french.theEnd).toBe('Fin.')
    expect(french.endingsReached(1, 3)).toBe('Fins atteintes : 1 sur 3')
    expect(storyMessages.en.endingsReached(1, 3)).toBe('Endings reached: 1 of 3')
  })
})
