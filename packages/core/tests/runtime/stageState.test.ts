import { DEFAULT_POSITION_PRESETS, DEFAULT_STAGE_DEFAULTS, type AnimationSpec, type Placement, type StageCommand } from '../../src/index'
import { describe, expect, it } from 'vitest'
import { applyStageCommand, createStageContext, effectiveFacing, EMPTY_STAGE, waitMillisecondsOf, type StageState } from '../../src/runtime/stageState'

const context = createStageContext({ positions: [...DEFAULT_POSITION_PRESETS, { id: 'doorway', name: 'doorway', x: 85 }], stageDefaults: DEFAULT_STAGE_DEFAULTS })
const byDefault: AnimationSpec = { kind: null, durationMs: null, wait: false }
const auto: Placement = { type: 'auto' }

const enter = (characterId: string, placement: Placement = auto, extra: Partial<Extract<StageCommand, { type: 'enter' }>> = {}): StageCommand =>
  ({ type: 'enter', characterId, expressionId: `${characterId}-normal`, placement, facing: null, depth: null, animation: byDefault, ...extra })

const apply = (stage: StageState, ...commands: StageCommand[]) => commands.reduce((current, command) => applyStageCommand(current, command, context), stage)

const layout = (stage: StageState) => stage.characters.map(character => ({ id: character.characterId, x: character.x, facing: effectiveFacing(character) }))

describe('automatic layout', () => {
  it('places the first character on the left facing right, the second on the right facing left', () => {
    expect(layout(apply(EMPTY_STAGE, enter('marie'), enter('jules')))).toEqual([
      { id: 'marie', x: 25, facing: 'right' },
      { id: 'jules', x: 75, facing: 'left' },
    ])
  })

  it('places a third character in the center, facing the viewer', () => {
    expect(layout(apply(EMPTY_STAGE, enter('marie'), enter('jules'), enter('ana')))[2]).toEqual({ id: 'ana', x: 50, facing: null })
  })

  it('keeps everyone in place when someone leaves, and gives the free spot to the next one', () => {
    const stage = apply(EMPTY_STAGE, enter('marie'), enter('jules'), { type: 'exit', characterId: 'marie', animation: byDefault }, enter('ana'))
    expect(layout(stage)).toEqual([
      { id: 'jules', x: 75, facing: 'left' },
      { id: 'ana', x: 25, facing: 'right' },
    ])
  })

  it('fills around characters placed explicitly', () => {
    expect(layout(apply(EMPTY_STAGE, enter('marie', { type: 'preset', presetId: 'position-left' }), enter('jules')))[1]).toEqual({ id: 'jules', x: 75, facing: 'left' })
  })
})

describe('explicit placement and facing', () => {
  it('uses presets, the project\'s own included, and exact percentages', () => {
    expect(apply(EMPTY_STAGE, enter('marie', { type: 'preset', presetId: 'doorway' })).characters[0]?.x).toBe(85)
    expect(apply(EMPTY_STAGE, enter('marie', { type: 'exact', x: 35 })).characters[0]?.x).toBe(35)
  })

  it('keeps an explicit facing wherever the character goes', () => {
    const stage = apply(EMPTY_STAGE, enter('marie', auto, { facing: 'left' }), { type: 'move', characterId: 'marie', depth: null, placement: { type: 'exact', x: 90 }, animation: byDefault })
    expect(layout(stage)).toEqual([{ id: 'marie', x: 90, facing: 'left' }])
  })

  it('turns a character who crosses the middle, when the facing was not chosen', () => {
    const stage = apply(EMPTY_STAGE, enter('marie'), { type: 'move', characterId: 'marie', depth: null, placement: { type: 'preset', presetId: 'position-right' }, animation: byDefault })
    expect(layout(stage)).toEqual([{ id: 'marie', x: 75, facing: 'left' }])
  })
})

describe('animations', () => {
  it('takes the project defaults for what the text leaves unsaid', () => {
    const stage = apply(EMPTY_STAGE, enter('marie'))
    expect(stage.characters[0]?.entrance).toEqual({ kind: 'fade', durationMs: 400, wait: false })
  })

  it('keeps what the text says', () => {
    const stage = apply(EMPTY_STAGE, enter('marie', auto, { animation: { kind: 'slide-from-right', durationMs: 1200, wait: true } }))
    expect(stage.characters[0]?.entrance).toEqual({ kind: 'slide-from-right', durationMs: 1200, wait: true })
  })

  it('remembers how each character left, for the interface to animate the exit', () => {
    const stage = apply(EMPTY_STAGE, enter('marie'), { type: 'exit', characterId: 'marie', animation: { kind: 'slide-to-left', durationMs: null, wait: false } })
    expect(stage.departures.marie).toEqual({ kind: 'slide-to-left', durationMs: 400, wait: false })
  })

  it('moves over the default duration, or at once when told so', () => {
    const moved = apply(EMPTY_STAGE, enter('marie'), { type: 'move', characterId: 'marie', depth: null, placement: { type: 'exact', x: 60 }, animation: byDefault })
    expect(moved.characters[0]?.moveDurationMs).toBe(600)
    const jumped = apply(EMPTY_STAGE, enter('marie'), { type: 'move', characterId: 'marie', depth: null, placement: { type: 'exact', x: 60 }, animation: { kind: 'instant', durationMs: null, wait: false } })
    expect(jumped.characters[0]?.moveDurationMs).toBe(0)
  })

  it('tells the typewriter how long to hold the text', () => {
    expect(waitMillisecondsOf({ type: 'wait', seconds: 1.5 }, context)).toBe(1500)
    expect(waitMillisecondsOf(enter('marie', auto, { animation: { kind: null, durationMs: null, wait: true } }), context)).toBe(400)
    expect(waitMillisecondsOf(enter('marie', auto, { animation: { kind: 'slide-from-left', durationMs: 900, wait: false } }), context)).toBe(0)
    expect(waitMillisecondsOf(enter('marie', auto, { animation: { kind: 'instant', durationMs: null, wait: true } }), context)).toBe(0)
  })
})

describe('other commands', () => {
  const marieOnStage = apply(EMPTY_STAGE, enter('marie'))

  it('changes expression, and leaves the stage as it is for a character who is not on it', () => {
    expect(apply(marieOnStage, { type: 'expression', characterId: 'marie', expressionId: 'marie-sad' }).characters[0]?.expressionId).toBe('marie-sad')
    expect(apply(EMPTY_STAGE, { type: 'expression', characterId: 'jules', expressionId: 'jules-sad' })).toBe(EMPTY_STAGE)
  })

  it('enters again a character already on stage instead of duplicating it', () => {
    expect(apply(marieOnStage, enter('marie', { type: 'preset', presetId: 'position-right' })).characters).toHaveLength(1)
  })

  it('uses the announced transition for the next background only', () => {
    const fading = apply(EMPTY_STAGE, { type: 'transition', name: 'fade', durationMs: null }, { type: 'background', backgroundId: 'rooftop' })
    expect(fading).toMatchObject({ backgroundId: 'rooftop', backgroundTransition: { name: 'fade', durationMs: 800 }, nextTransition: null })
    expect(apply(fading, { type: 'background', backgroundId: 'street' })).toMatchObject({ backgroundTransition: null })
    const throughBlack = apply(EMPTY_STAGE, { type: 'transition', name: 'black', durationMs: 2000 }, { type: 'background', backgroundId: 'rooftop' })
    expect(throughBlack.backgroundTransition).toEqual({ name: 'black', durationMs: 2000 })
  })

  it('stands characters in the middle unless told near or far, a move changing either place or depth', () => {
    const near = apply(EMPTY_STAGE, enter('marie', auto, { depth: 'near' }), enter('jules'))
    expect(near.characters.map(character => character.depth)).toEqual(['near', 'middle'])
    const pushedBack = apply(near, { type: 'move', characterId: 'marie', placement: null, depth: 'far', animation: byDefault })
    expect(pushedBack.characters[0]).toMatchObject({ depth: 'far', x: near.characters[0]!.x })
    expect(apply(pushedBack, { type: 'move', characterId: 'marie', placement: { type: 'exact', x: 60 }, depth: null, animation: byDefault }).characters[0]).toMatchObject({ depth: 'far', x: 60 })
  })

  it('covers the screen from a fade out to a fade in, and tints it until told otherwise', () => {
    const covered = apply(EMPTY_STAGE, { type: 'fade', direction: 'out', color: 'white', durationMs: null })
    expect([covered.cover, covered.coverFadeMs]).toEqual(['white', 1000])
    const uncovered = apply(covered, { type: 'fade', direction: 'in', color: 'black', durationMs: 2000 })
    expect([uncovered.cover, uncovered.coverFadeMs]).toEqual([null, 2000])
    const tinted = apply(EMPTY_STAGE, { type: 'tint', tint: 'sepia' })
    expect(tinted.tint).toBe('sepia')
    expect(apply(tinted, { type: 'tint', tint: null }).tint).toBeNull()
    expect(apply(tinted, { type: 'shake', strength: 'strong', durationMs: null }, { type: 'flash', color: 'red', durationMs: null })).toBe(tinted)
  })

  it('plays and stops music, and leaves pauses to the typewriter', () => {
    const playing = apply(EMPTY_STAGE, { type: 'music', musicId: 'calm' })
    expect(playing.musicId).toBe('calm')
    expect(apply(playing, { type: 'music', musicId: null }).musicId).toBeNull()
    expect(apply(EMPTY_STAGE, { type: 'wait', seconds: 1 })).toBe(EMPTY_STAGE)
  })
})
