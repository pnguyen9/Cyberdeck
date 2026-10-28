import { describe, expect, it } from 'vitest'
import type { PlayableStory } from '../../src/runtime/playableStory'
import { StoryRuntime, type Cue } from '../../src/runtime/storyRuntime'
import { storyFromText } from './storyFromText'

/** What a runtime shows on stage, by name, to compare with the story text. */
function stageByName(story: PlayableStory, runtime: StoryRuntime) {
  const stage = runtime.snapshot.stage
  return {
    background: story.project.backgrounds.find(background => background.id === stage.backgroundId)?.name ?? null,
    characters: stage.characters.map(onStage => {
      const character = story.project.characters.find(candidate => candidate.id === onStage.characterId)
      return {
        name: character?.name,
        expression: character?.expressions.find(expression => expression.id === onStage.expressionId)?.name,
        x: onStage.x,
      }
    }),
  }
}

/** Plays a story to its end, picking options by their text, and returns what was shown. */
function playThrough(lines: string[], optionTexts: string[] = []): string[] {
  const story = storyFromText(lines)
  const runtime = new StoryRuntime(story)
  const remainingOptions = [...optionTexts]
  const shown: string[] = []

  runtime.start()
  for (let step = runtime.snapshot.step; step.type !== 'end'; step = runtime.snapshot.step) {
    if (step.type === 'page') {
      const speaker = story.project.characters.find(character => character.id === step.page.speakerId)
      shown.push(speaker === undefined ? step.page.text : `${speaker.name}: ${step.page.text}`)
      runtime.next()
    } else if (step.type === 'ask') {
      shown.push(`? ${step.ask.askedNameId}`)
      runtime.answer(remainingOptions.shift() ?? '')
    } else {
      const optionText = remainingOptions.shift()
      const option = step.choice.options.find(candidate => candidate.text === optionText)
      if (option === undefined) {
        throw new Error(`No option "${optionText}" in ${JSON.stringify(step.choice.options.map(candidate => candidate.text))}`)
      }
      shown.push(`> ${option.text}`)
      runtime.choose(option.id)
    }
  }
  return shown
}

describe('StoryRuntime', () => {
  it('shows pages in order, then ends', () => {
    expect(playThrough(['The room was empty.', '— Marie: Hello?'])).toEqual(['The room was empty.', 'Marie: Hello?'])
  })

  it('ends at once on an empty story', () => {
    const runtime = new StoryRuntime(storyFromText(['[bg: void]']))
    runtime.start()
    expect(runtime.snapshot.step).toEqual({ type: 'end', endingId: null })
  })

  it('plays the branch of the option picked', () => {
    const story = [
      '[choice: Answer]',
      '> Yes',
      '> No',
      '[if: Answer is A]',
      '— Marie: Really?!',
      '[else]',
      '— Marie: I see.',
      '[end]',
      'The wind rose.',
    ]
    expect(playThrough(story, ['Yes'])).toEqual(['> Yes', 'Marie: Really?!', 'The wind rose.'])
    expect(playThrough(story, ['No'])).toEqual(['> No', 'Marie: I see.', 'The wind rose.'])
  })

  it('evaluates negation, and before or', () => {
    const story = [
      '[decision: Mood = Happy | Sad]',
      '[decision: Weather = Rain | Sun]',
      '[set: Mood = Sad]',
      '[set: Weather = Sun]',
      '[if: Mood is not Happy and Weather is Rain or Weather is Sun]',
      'Shown.',
      '[end]',
      '[if: Mood is Happy or Weather is Rain]',
      'Hidden.',
      '[end]',
    ]
    expect(playThrough(story)).toEqual(['Shown.'])
  })

  it('treats an undecided decision as having no value', () => {
    expect(playThrough(['[decision: Mood = Happy]', '[if: Mood is Happy]', 'Hidden.', '[end]', '[if: Mood is not Happy]', 'Shown.', '[end]']))
      .toEqual(['Shown.'])
  })

  it('keeps every value of a multiple decision, and only the last of a single one', () => {
    const story = [
      '[decision multi: Clues = Letter | Key]',
      '[decision: Mood = Happy | Sad]',
      '[set: Clues = Letter]',
      '[set: Clues = Key]',
      '[set: Mood = Happy]',
      '[set: Mood = Sad]',
      '[if: Clues is Letter and Clues is Key]',
      'Both clues.',
      '[end]',
      '[if: Mood is Happy]',
      'Hidden.',
      '[end]',
    ]
    expect(playThrough(story)).toEqual(['Both clues.'])
  })

  it('takes a value away, or every value, so that tests of it no longer hold', () => {
    const story = [
      '[decision multi: Clues = Letter | Key]',
      '[decision: Mood = Happy | Sad]',
      '[set: Clues = Letter]',
      '[set: Clues = Key]',
      '[set: Mood = Happy]',
      '[unset: Clues = Key]',
      '[unset: Mood]',
      '[if: Clues is Letter and Clues is not Key]',
      'The letter only.',
      '[end]',
      '[if: Mood is Happy or Mood is Sad]',
      'Hidden.',
      '[end]',
    ]
    expect(playThrough(story)).toEqual(['The letter only.'])
  })

  const HUB = [
    '[loop]',
    '[choice: Where]',
    '> The library = Library',
    '> The park = Park',
    '> Go home = Home',
    '[if: Where is Library]',
    'Dust and silence.',
    '[else if: Where is Park]',
    'Wind in the trees.',
    '[else]',
    '[break]',
    '[end]',
    '[end]',
    'Home at last.',
  ]

  it('plays a loop again until a break leaves it', () => {
    expect(playThrough(HUB, ['The library', 'The park', 'The library', 'Go home']))
      .toEqual(['> The library', 'Dust and silence.', '> The park', 'Wind in the trees.', '> The library', 'Dust and silence.', '> Go home', 'Home at last.'])
  })

  it('offers only the options whose condition holds, so that places visited disappear', () => {
    const story = storyFromText([
      '[decision multi: Visited = Library | Park]',
      '[loop]',
      '[choice: Where]',
      '> The library = Library [if: Visited is not Library]',
      '> The park = Park [if: Visited is not Park]',
      '> Go home = Home',
      '[if: Where is Library]', '[set: Visited = Library]', 'Dust.',
      '[else if: Where is Park]', '[set: Visited = Park]', 'Wind.',
      '[else]', '[break]', '[end]',
      '[end]',
      'Home.',
    ])
    const runtime = new StoryRuntime(story)
    const offered = () => {
      const step = runtime.snapshot.step
      return step.type === 'choice' ? step.choice.options.map(option => option.text) : []
    }
    const pick = (text: string) => {
      const step = runtime.snapshot.step
      runtime.choose(step.type === 'choice' ? step.choice.options.find(option => option.text === text)!.id : '')
      runtime.next()
    }
    runtime.start()
    expect(offered()).toEqual(['The library', 'The park', 'Go home'])
    pick('The library')
    expect(offered()).toEqual(['The park', 'Go home'])
    pick('The park')
    expect(offered()).toEqual(['Go home'])
    expect(() => runtime.choose(story.chapters[0]!.nodes.flatMap(node => node.type === 'loop' ? node.nodes : []).find(node => node.type === 'choice')!.options[0]!.id)).toThrow()
  })

  it('skips a choice none of whose options holds', () => {
    expect(playThrough(['[decision: Door = Open | Shut]', '[choice: Door]', '> Open it = Open [if: Door is Shut]', 'After.'])).toEqual(['After.'])
  })

  it('leaves only the innermost loop on a break', () => {
    const story = [
      '[decision: Round = One | Two]',
      '[loop]',
      'Outer.',
      '[loop]',
      'Inner.',
      '[break]',
      '[end]',
      '[if: Round is Two]',
      '[break]',
      '[end]',
      '[set: Round = Two]',
      '[end]',
      'Out.',
    ]
    expect(playThrough(story)).toEqual(['Outer.', 'Inner.', 'Outer.', 'Inner.', 'Out.'])
  })

  it('resumes a save inside a loop, which still repeats', () => {
    const story = storyFromText(HUB)
    const runtime = new StoryRuntime(story)
    runtime.start()
    const step = runtime.snapshot.step
    runtime.choose(step.type === 'choice' ? step.choice.options[0]!.id : '')
    const restored = new StoryRuntime(story)
    expect(restored.restoreState(runtime.exportState())).toBe('exact')
    restored.next()
    const next = restored.snapshot.step
    expect(next.type === 'choice' && next.choice.options.map(option => option.text)).toEqual(['The library', 'The park', 'Go home'])
  })

  const SCENES = [
    '# Hallway',
    'Footsteps.',
    '[play: Small talk]',
    'Back in the hallway.',
    '[play: Small talk]',
    '[play: Caught]',
    'Never read.',
    '# Scene: Small talk',
    'Nice weather.',
    '[play: Shrug]',
    'Anyway.',
    '# Scene: Shrug',
    'A shrug.',
    '# Scene: Caught',
    '— Guard: Stop right there.',
    '[ending: Caught]',
  ]

  it('plays a scene where it is named, then goes on after it, as often as it is named', () => {
    expect(playThrough(SCENES)).toEqual([
      'Footsteps.', 'Nice weather.', 'A shrug.', 'Anyway.', 'Back in the hallway.', 'Nice weather.', 'A shrug.', 'Anyway.', 'Guard: Stop right there.',
    ])
  })

  it('resumes a save inside a scene, going back where it was played from', () => {
    const story = storyFromText(SCENES)
    const runtime = new StoryRuntime(story)
    runtime.start()
    for (let step = 0; step < 6; step++) {
      runtime.next()
    }
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('A shrug.')
    const state = runtime.exportState()
    expect(state.page?.playedFrom).toHaveLength(2)

    const restored = new StoryRuntime(story)
    expect(restored.restoreState(state)).toBe('exact')
    const texts: string[] = []
    for (let step = restored.snapshot.step; step.type === 'page'; step = restored.snapshot.step) {
      texts.push(step.page.text)
      restored.next()
    }
    expect(texts).toEqual(['A shrug.', 'Anyway.', 'Stop right there.'])
  })

  it('passes by the chapters whose condition does not hold', () => {
    const story = [
      '# Prologue', '[choice: Route]', '> Follow Marie = Marie', '> Follow Jules = Jules',
      "# Marie's route", '[only if: Route is Marie]', 'The library.',
      "# Jules's route", '[only if: Route is Jules]', 'The rooftop.',
      '# Epilogue', 'The end.',
    ]
    expect(playThrough(story, ['Follow Jules'])).toEqual(['> Follow Jules', 'The rooftop.', 'The end.'])
    expect(playThrough(story, ['Follow Marie'])).toEqual(['> Follow Marie', 'The library.', 'The end.'])
  })

  it('hands the sounds, shakes and flashes reached going forward to the interface, and none when coming back', () => {
    const story = storyFromText(['[sound: Door] [shake]', 'Someone came in.', 'Then [sound: Steps] footsteps. [flash: red]', 'Silence.'])
    const runtime = new StoryRuntime(story)
    const names = (cues: Cue[]) => cues.map(cue => cue.type === 'sound' ? story.project.sounds.find(sound => sound.id === cue.soundId)?.name : cue.type)
    runtime.start()
    expect(names(runtime.takeCues())).toEqual(['Door', 'shake'])
    runtime.next()
    expect(names(runtime.takeCues())).toEqual([])
    runtime.reachOffset(10)
    expect(names(runtime.takeCues())).toEqual(['Steps'])
    runtime.reachOffset(100)
    expect(names(runtime.takeCues())).toEqual(['flash'])
    runtime.next()
    runtime.back()
    runtime.reachOffset(100)
    expect(names(runtime.takeCues())).toEqual([])
    runtime.restoreState(runtime.exportState())
    expect(names(runtime.takeCues())).toEqual([])
  })

  it('piles up the pages of full-screen text, until cleared or the screen is full, and back in a box', () => {
    const story = storyFromText(['[text: full]', 'One.', 'Two.', '[clear]', 'Three.', ...['A.', 'B.', 'C.', 'D.', 'E.'], '[text: box]', 'Boxed.'])
    const runtime = new StoryRuntime(story)
    const screen = () => runtime.screenfulPages().map(page => page.text)
    runtime.start()
    expect(screen()).toEqual(['One.'])
    runtime.next()
    expect(screen()).toEqual(['One.', 'Two.'])
    runtime.next()
    expect(screen()).toEqual(['Three.'])
    for (let step = 0; step < 5; step++) {
      runtime.next()
    }
    expect(screen()).toEqual(['E.'])
    runtime.back()
    expect(screen()).toEqual(['Three.', 'A.', 'B.', 'C.', 'D.'])
    runtime.next()
    runtime.next()
    expect([screen(), runtime.snapshot.stage.textMode]).toEqual([[], 'box'])
  })

  it('keeps a restored page of full-screen text on its screen once, and keeps the page shown when a clear is in its text', () => {
    const story = storyFromText(['[text: full]', 'P1.', 'P2.', 'P3.', 'P4.', 'P5.', 'P6.', 'Then [clear] more.', 'After.'])
    const live = new StoryRuntime(story)
    live.start()
    live.next()
    live.next()
    const restored = new StoryRuntime(story)
    restored.restoreState(live.exportState())
    for (const runtime of [live, restored]) {
      runtime.next()
      runtime.next()
    }
    expect(restored.screenfulPages().map(page => page.text)).toEqual(['P1.', 'P2.', 'P3.', 'P4.', 'P5.'])
    live.next()
    live.next()
    live.reachOffset(100)
    expect(live.screenfulPages().map(page => page.text)).toEqual(['P6.', 'Then more.'])
    live.next()
    expect(live.screenfulPages().map(page => page.text)).toEqual(['After.'])
  })

  it('reads decisions from a downloaded game whatever their identifiers', () => {
    const story = storyFromText(['[choice: Answer]', '> Yes', '> No', '[if: Answer is A]', 'Yes.', '[end]', 'End.'])
    const decision = story.project.decisions[0]!
    const renamed = JSON.parse(JSON.stringify(story).replaceAll(decision.id, 'constructor'))
    const runtime = new StoryRuntime({ ...renamed, assetUrls: new Map() })
    expect(() => runtime.start()).not.toThrow()
    const step = runtime.snapshot.step
    runtime.choose(step.type === 'choice' ? step.choice.options[0]!.id : '')
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Yes.')
  })

  it('plays chapters in order', () => {
    expect(playThrough(['# One', 'First chapter.', '# Two', 'Second chapter.'])).toEqual(['First chapter.', 'Second chapter.'])
  })

  it('stops a story that loops without showing anything', () => {
    const runtime = new StoryRuntime(storyFromText(['[loop]', '[remember: Nothing]', '[end]']))
    expect(() => runtime.start()).toThrow('loops')
  })

  it('sets the stage before showing a page, including directives with no page of their own', () => {
    const story = storyFromText(['[bg: classroom]', '[remember: Visit]', '[enter: marie left]', '— Marie: Hi.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    expect(stageByName(story, runtime)).toEqual({
      background: 'classroom',
      characters: [{ name: 'Marie', x: 25, expression: 'normal' }],
    })
  })

  it('applies inline directives as the text is reached, and the rest when moving on', () => {
    const story = storyFromText([
      '[enter: marie center]',
      '— Marie: Wait, [marie: surprised] you mean [wait: 0.5] the letter? [marie: panicked]',
      'Next.',
    ])
    const runtime = new StoryRuntime(story)
    const expression = () => stageByName(story, runtime).characters[0]?.expression
    runtime.start()
    expect(expression()).toBe('normal')

    expect(runtime.reachOffset(6).map(command => command.type)).toEqual(['expression'])
    expect(expression()).toBe('surprised')

    expect(runtime.reachOffset(15)).toEqual([{ offset: 15, type: 'wait', seconds: 0.5 }])
    expect(runtime.reachOffset(15)).toEqual([])

    runtime.next()
    expect(expression()).toBe('panicked')
  })

  describe('going back', () => {
    const currentText = (runtime: StoryRuntime) => {
      const step = runtime.snapshot.step
      return step.type === 'page' ? step.page.text : step.type
    }

    it('returns to the previous page, with the stage as it was when that page appeared', () => {
      const story = storyFromText(['[bg: street]', 'One.', '[bg: rooftop] [enter: marie left]', 'Two.'])
      const runtime = new StoryRuntime(story)
      runtime.start()
      runtime.next()
      expect(stageByName(story, runtime).background).toBe('rooftop')

      runtime.back()
      expect(currentText(runtime)).toBe('One.')
      expect(stageByName(story, runtime)).toEqual({ background: 'street', characters: [] })
    })

    it('cannot go back from the first page', () => {
      const runtime = new StoryRuntime(storyFromText(['One.', 'Two.']))
      runtime.start()
      expect(runtime.canGoBack).toBe(false)
      runtime.back()
      expect(currentText(runtime)).toBe('One.')

      runtime.next()
      expect(runtime.canGoBack).toBe(true)
    })

    it('goes back from the end to the last page', () => {
      const runtime = new StoryRuntime(storyFromText(['Only page.']))
      runtime.start()
      runtime.next()
      expect(runtime.snapshot.step.type).toBe('end')
      runtime.back()
      expect(currentText(runtime)).toBe('Only page.')
    })

    it('undoes a choice, so that another option can be picked', () => {
      const runtime = new StoryRuntime(storyFromText(['[choice: Answer]', '> Yes', '> No', '[if: Answer is A]', 'Yes branch.', '[else]', 'No branch.', '[end]']))
      runtime.start()
      const choiceStep = runtime.snapshot.step
      if (choiceStep.type !== 'choice') {
        throw new Error('Expected a choice')
      }
      const [yes, no] = choiceStep.choice.options

      runtime.choose(yes!.id)
      expect(currentText(runtime)).toBe('Yes branch.')

      runtime.back()
      expect(runtime.snapshot.step.type).toBe('choice')
      expect(runtime.snapshot.decisions).toEqual({})

      runtime.choose(no!.id)
      expect(currentText(runtime)).toBe('No branch.')
    })

    it('replays the same pages when moving forward again, inline directives included', () => {
      const story = storyFromText(['[enter: marie]', '— Marie: Oh. [marie: sad] No.', 'After.'])
      const runtime = new StoryRuntime(story)
      const expression = () => stageByName(story, runtime).characters[0]?.expression
      runtime.start()
      runtime.next()
      runtime.back()
      expect(expression()).toBe('normal')

      runtime.reachOffset(Number.POSITIVE_INFINITY)
      expect(expression()).toBe('sad')
      runtime.next()
      expect(currentText(runtime)).toBe('After.')
    })
  })

  it('replaces the snapshot instead of changing it, so interfaces can compare them', () => {
    const runtime = new StoryRuntime(storyFromText(['[enter: marie center]', '— Marie: One.', '[marie: sad]', '— Marie: Two.']))
    runtime.start()
    const firstSnapshot = runtime.snapshot
    runtime.next()

    expect(runtime.snapshot).not.toBe(firstSnapshot)
    expect(firstSnapshot.stage.characters[0]?.expressionId).not.toBe(runtime.snapshot.stage.characters[0]?.expressionId)
  })
})

describe('endings', () => {
  it('end the path where they are reached, naming the ending, and can be gone back from', () => {
    const story = storyFromText(['[choice: Door]', '> Open it', '> Walk away', '[if: Door is A]', 'Empty.', '[ending: The Empty Room]', '[end]', 'Home.', '[ending: Home]'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    const step = runtime.snapshot.step
    if (step.type !== 'choice') {
      throw new Error('Expected the choice')
    }
    runtime.choose(step.choice.options[0]!.id)
    runtime.next()

    const ending = story.project.endings.find(candidate => candidate.name === 'The Empty Room')
    expect(runtime.snapshot.step).toEqual({ type: 'end', endingId: ending!.id })
    runtime.next()
    expect(runtime.snapshot.step.type).toBe('end')
    runtime.back()
    expect(runtime.snapshot.step.type === 'page' && runtime.snapshot.step.page.text).toBe('Empty.')
    expect(story.project.endings.map(candidate => candidate.name)).toEqual(['The Empty Room', 'Home'])
  })
})

describe('memories', () => {
  const GHOST = [
    '[if: remembered The ghost\'s name]',
    'Hello again, Mira.',
    '[else]',
    'Who are you?',
    '[end]',
    '[remember: The ghost\'s name]',
    '[if: seen ending Gone]',
    'You know how this ends.',
    '[end]',
    'She fades.',
    '[ending: Gone]',
  ]
  const pageTexts = (runtime: StoryRuntime) => {
    const texts: string[] = []
    while (runtime.snapshot.step.type === 'page') {
      texts.push(runtime.snapshot.step.page.text)
      runtime.next()
    }
    return texts
  }

  it('are tested before the place that remembers them, for the next playthrough', () => {
    const story = storyFromText(GHOST)
    const first = new StoryRuntime(story)
    first.start()
    expect(pageTexts(first)).toEqual(['Who are you?', 'She fades.'])
    expect(first.memoryIds).toHaveLength(1)

    const second = new StoryRuntime(story)
    second.useMemory({ memoryIds: first.memoryIds, endingIds: story.project.endings.map(ending => ending.id) })
    second.start()
    expect(pageTexts(second)).toEqual(['Hello again, Mira.', 'You know how this ends.', 'She fades.'])
  })

  it('are not forgotten by going back', () => {
    const story = storyFromText(['First.', '[remember: Secret]', 'Second.'])
    const runtime = new StoryRuntime(story)
    runtime.start()
    runtime.next()
    runtime.back()
    expect(runtime.memoryIds).toEqual(story.project.memories.map(memory => memory.id))
  })
})
