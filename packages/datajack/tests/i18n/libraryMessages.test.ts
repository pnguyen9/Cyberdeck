import { describe, expect, it } from 'vitest'
import type { InstallOutcome } from '../../src/library/gameLibrary'
import { describeInstall, libraryMessages } from '../../src/i18n/libraryMessages'

const OUTCOME: InstallOutcome = { gameName: 'The Letter', release: '1.1', isNewGame: false, addedChapters: [], updatedChapters: [], wasOlder: false }

describe('install reports', () => {
  it('name a new game', () => {
    expect(describeInstall({ ...OUTCOME, isNewGame: true }, libraryMessages.en)).toBe('The Letter 1.1 installed.')
    expect(describeInstall({ ...OUTCOME, isNewGame: true }, libraryMessages.fr)).toBe('Jeu installé : The Letter 1.1.')
  })

  it('list the chapters added and updated', () => {
    const outcome = { ...OUTCOME, addedChapters: ['Three', 'Four'], updatedChapters: ['One'] }
    expect(describeInstall(outcome, libraryMessages.en)).toBe('The Letter 1.1: added Three, Four; updated One.')
    expect(describeInstall(outcome, libraryMessages.fr)).toBe('The Letter 1.1 : ajout de Three, Four ; mise à jour de One.')
  })

  it('say when nothing is new, or the archive is older than the game installed', () => {
    expect(describeInstall(OUTCOME, libraryMessages.en)).toBe('The Letter 1.1: nothing new.')
    expect(describeInstall({ ...OUTCOME, wasOlder: true }, libraryMessages.en)).toBe('This archive of The Letter is older than 1.1, installed already: nothing to add.')
    expect(describeInstall({ ...OUTCOME, wasOlder: true, addedChapters: ['Two'] }, libraryMessages.en)).toBe('This archive of The Letter is older than 1.1, installed already: added Two.')
    expect(describeInstall({ ...OUTCOME, wasOlder: true }, libraryMessages.fr)).toBe('Cette archive de The Letter est plus ancienne que la version 1.1 déjà installée : rien à ajouter.')
  })

  it('count chapters as French does, one or none in the singular', () => {
    expect(libraryMessages.fr.chapterCount(1)).toBe('1 chapitre')
    expect(libraryMessages.fr.chapterCount(0)).toBe('0 chapitre')
    expect(libraryMessages.fr.chapterCount(2)).toBe('2 chapitres')
    expect(libraryMessages.en.someChapters(1, 2, ['Chapter 1 — The Letter'])).toBe('1 of 2 chapters · not installed: Chapter 1 — The Letter')
    expect(libraryMessages.fr.someChapters(1, 2, ['Chapitre 1'])).toBe('1 chapitre sur 2 · non installé : Chapitre 1')
  })
})
