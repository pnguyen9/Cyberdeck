import { describe, expect, it } from 'vitest'
import { checkProjectDocument, createStageCatalog, playerFormatVersion, setFraming } from '../../src/index'
import { storyFromText } from '../runtime/storyFromText'

describe('how characters are drawn', () => {
  it('the project’s framing, a character’s own over it, checked, needing Datajack 3.2', () => {
    const story = storyFromText(['[enter: marie]', '[enter: jules]', 'Hello.'])
    const [marie, jules] = story.project.characters
    let project = setFraming(story.project, null, 'upperBody', 'now')
    project = setFraming(project, jules!.id, 'fullBody', 'now')
    const catalog = createStageCatalog({ ...story, project })
    expect([catalog.framing(marie!.id), catalog.framing(jules!.id)]).toEqual(['upperBody', 'fullBody'])
    expect(() => checkProjectDocument(project, 'project')).not.toThrow()
    expect(playerFormatVersion(project, story.chapters)).toBe('3.2')
    const back = setFraming(setFraming(project, null, 'fullBody', 'now'), jules!.id, null, 'now')
    expect([back.characterFraming, back.characters[1]!.framing, playerFormatVersion(back, story.chapters)]).toEqual([undefined, undefined, '1.1'])
  })
})
