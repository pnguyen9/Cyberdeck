import { ArchiveError, readGameArchive } from '@cyberdeck/core'
import { describe, expect, it } from 'vitest'
import { describeError } from '../../src/i18n/errorMessages'

describe('errors shown to players', () => {
  it('say why an archive is refused in English as core words it, and in French', async () => {
    const error = await readGameArchive(new TextEncoder().encode('just some text')).catch((caught: unknown) => caught)

    expect(describeError(error, 'en')).toBe('This file is not a ZIP archive')
    expect(describeError(error, 'fr')).toBe('Ce fichier n’est pas une archive ZIP')
  })

  it('give a refused document in French, followed by its technical detail', () => {
    const error = new ArchiveError({ code: 'invalidDocument', path: 'game.json', detail: 'game.project.id: expected a plain identifier' })

    expect(describeError(error, 'en')).toBe('game.json is invalid: game.project.id: expected a plain identifier')
    expect(describeError(error, 'fr')).toBe('game.json n’est pas valide (game.project.id: expected a plain identifier)')
  })

  it('word every refusal in French, with a non-breaking space before a colon', () => {
    const french = [
      describeError(new ArchiveError({ code: 'newerPlayer' }), 'fr'),
      describeError(new ArchiveError({ code: 'alteredFile', path: 'assets/cover.png' }), 'fr'),
      describeError(new ArchiveError({ code: 'notAGame', path: 'game.json' }), 'fr'),
    ]
    expect(french).toEqual([
      'Ce jeu a été conçu pour une version plus récente de Datajack : téléchargez la dernière',
      'assets/cover.png n’est pas le fichier avec lequel le jeu a été exporté : l’archive a été modifiée ou endommagée',
      'Cette archive ne contient pas game.json : ce n’est pas un jeu Datajack',
    ])
    expect(french.every(message => !/ [:;?!]/.test(message))).toBe(true)
  })

  it('show other errors by their message', () => {
    expect(describeError(new Error('The browser could not store the game'), 'fr')).toBe('The browser could not store the game')
    expect(describeError('refused', 'en')).toBe('refused')
  })
})
