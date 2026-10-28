import { normalizeName } from '../importer/storyNodes'
import { flattenStoredNodes, type Facing, type FadeColor, type TintName } from '../format/storyFormat'
import type { PlayableStory } from '../runtime/playableStory'
import { chaptersInOrder } from '../runtime/playableStory'
import { EMPTY_STAGE, PAGES_PER_SCREENFUL, type CharacterOnStage } from '../runtime/stageState'
import type { CounterState, DecisionState, RuntimeState } from '../runtime/storyRuntime'

/**
 * A save file: plain JSON a player can read, with names wherever a person might look. Editing it
 * is allowed; the story is single-player and exploring branches is welcome.
 */
export interface SaveData {
  saveFormat: 1
  game: { id: string; name: string }
  savedAt: string
  /** Shown in the save list. */
  chapter: string | null
  excerpt: string
  /** The page or choice shown; null at the end of the story. Inside a scene, the plays it was reached through. */
  page: { chapterId: string; nodeId: string; playedFrom?: string[] } | null
  /** Decision name → names of the values it holds. */
  decisions: Record<string, string[]>
  /** Counter name → its value, for those changed so far; absent when none was. */
  counters?: Record<string, number>
  stage: {
    background: string | null
    music: string | null
    /** `x` in percent of the stage width; `facing` null when left to the player. */
    characters: { name: string; expression: string; x: number; facing: Facing | null; depth?: 'near' | 'far' }[]
    /** Only when the screen is faded out, tinted, or the text over the whole screen. */
    cover?: FadeColor
    tint?: TintName
    text?: 'full'
    /** In full-screen text, the pages already on the screen, the saved one last. */
    screen?: string[]
    illustration?: string
  }
  /** Every option picked, in order: the playthrough itself. */
  choices: { choiceId: string; optionId: string; decision: string; option: string }[]
}

const EXCERPT_LENGTH = 140

export function toSave(story: PlayableStory, state: RuntimeState, savedAt: string): SaveData {
  const { project } = story
  const decisionsById = new Map(project.decisions.map(decision => [decision.id, decision]))
  const countersById = new Map(project.counters.map(counter => [counter.id, counter]))
  const counters = Object.entries(state.counters).flatMap(([counterId, count]) => {
    const counter = countersById.get(counterId)
    return counter === undefined ? [] : [[counter.name, count] as const]
  })
  const charactersById = new Map(project.characters.map(character => [character.id, character]))
  const chapter = chaptersInOrder(story).find(candidate => candidate.id === state.page?.chapterId)
  // Scenes included: a choice made in one is part of the playthrough too.
  const choicesById = new Map(story.chapters.flatMap(candidate => flattenStoredNodes(candidate.nodes).filter(node => node.type === 'choice')).map(choice => [choice.id, choice]))

  return {
    saveFormat: 1,
    game: { id: project.id, name: project.name },
    savedAt,
    chapter: chapter?.title ?? null,
    excerpt: excerptAt(story, state),
    page: state.page,
    decisions: Object.fromEntries(Object.entries(state.decisions).flatMap(([decisionId, valueIds]) => {
      const decision = decisionsById.get(decisionId)
      return decision === undefined ? [] : [[
        decision.name,
        valueIds.map(valueId => decision.values.find(value => value.id === valueId)?.name).filter(name => name !== undefined),
      ]]
    })),
    ...(counters.length === 0 ? {} : { counters: Object.fromEntries(counters) }),
    stage: {
      background: project.backgrounds.find(background => background.id === state.stage.backgroundId)?.name ?? null,
      music: project.music.find(track => track.id === state.stage.musicId)?.name ?? null,
      characters: state.stage.characters.flatMap(onStage => {
        const character = charactersById.get(onStage.characterId)
        const expression = character?.expressions.find(candidate => candidate.id === onStage.expressionId)
        return character === undefined || expression === undefined
          ? []
          : [{ name: character.name, expression: expression.name, x: onStage.x, facing: onStage.facing, ...(onStage.depth === 'middle' ? {} : { depth: onStage.depth }) }]
      }),
      ...(state.stage.cover === null ? {} : { cover: state.stage.cover }),
      ...(state.stage.tint === null ? {} : { tint: state.stage.tint }),
      ...(state.stage.textMode === 'full' ? { text: 'full' as const, screen: [...state.stage.screenfulPageIds] } : {}),
      ...(state.stage.illustrationId === null ? {} : { illustration: project.illustrations.find(illustration => illustration.id === state.stage.illustrationId)?.name ?? '' }),
    },
    choices: state.choices.flatMap(record => {
      const choice = choicesById.get(record.choiceId)
      const option = choice?.options.find(candidate => candidate.id === record.optionId)
      return choice === undefined || option === undefined ? [] : [{
        ...record,
        decision: decisionsById.get(choice.decisionId)?.name ?? '',
        option: option.text,
      }]
    }),
  }
}

/** Reads a save back through its names, ignoring those the story does not have (anymore). */
export function stateFromSave(story: PlayableStory, save: SaveData): RuntimeState {
  const { project } = story
  const findNamed = <Entry extends { name: string }>(entries: Entry[], name: string | null) =>
    name === null ? undefined : entries.find(entry => normalizeName(entry.name) === normalizeName(name))

  const decisions: Record<string, string[]> = {}
  for (const [decisionName, valueNames] of Object.entries(save.decisions)) {
    const decision = findNamed(project.decisions, decisionName)
    const valueIds = valueNames.map(valueName => findNamed(decision?.values ?? [], valueName)?.id).filter(id => id !== undefined)
    if (decision !== undefined && valueIds.length > 0) {
      decisions[decision.id] = valueIds
    }
  }

  const counters: Record<string, number> = {}
  for (const [counterName, count] of Object.entries(save.counters ?? {})) {
    const counter = findNamed(project.counters, counterName)
    if (counter !== undefined) {
      counters[counter.id] = count
    }
  }

  const characters: CharacterOnStage[] = save.stage.characters.flatMap(saved => {
    const character = findNamed(project.characters, saved.name)
    const expression = findNamed(character?.expressions ?? [], saved.expression)
    return character === undefined || expression === undefined
      ? []
      : [{
          characterId: character.id,
          expressionId: expression.id,
          x: saved.x,
          facing: saved.facing,
          depth: saved.depth ?? 'middle',
          entrance: { ...project.stageDefaults.enter, wait: false },
          moveDurationMs: 0,
        }]
  })

  return {
    page: save.page,
    decisions: decisions satisfies DecisionState,
    counters: counters satisfies CounterState,
    stage: {
      ...EMPTY_STAGE,
      backgroundId: findNamed(project.backgrounds, save.stage.background)?.id ?? null,
      musicId: findNamed(project.music, save.stage.music)?.id ?? null,
      characters,
      cover: save.stage.cover ?? null,
      tint: save.stage.tint ?? null,
      textMode: save.stage.text ?? 'box',
      screenfulPageIds: save.stage.text === 'full' ? save.stage.screen ?? [] : [],
      illustrationId: save.stage.illustration === undefined ? null : findNamed(project.illustrations, save.stage.illustration)?.id ?? null,
    },
    choices: save.choices.map(({ choiceId, optionId }) => ({ choiceId, optionId })),
  }
}

/**
 * Checks that a value read from storage or from a file is a save, field by field. Anything else
 * gives null: save files travel between players and are never trusted.
 */
export function parseSave(value: unknown): SaveData | null {
  if (!isRecord(value) || value.saveFormat !== 1) {
    return null
  }
  const { game, page, decisions, stage, choices } = value
  const isValid = isRecord(game) && isString(game.id) && isString(game.name)
    && isString(value.savedAt)
    && (value.chapter === null || isString(value.chapter))
    && isString(value.excerpt)
    && (page === null || (isRecord(page) && isString(page.chapterId) && isString(page.nodeId)
      && (page.playedFrom === undefined || (Array.isArray(page.playedFrom) && page.playedFrom.every(isString)))))
    && isRecord(decisions) && Object.values(decisions).every(values => Array.isArray(values) && values.every(isString))
    && (value.counters === undefined || (isRecord(value.counters) && Object.values(value.counters).every(count => Number.isSafeInteger(count))))
    && isRecord(stage)
    && (stage.background === null || isString(stage.background))
    && (stage.music === null || isString(stage.music))
    && (stage.cover === undefined || stage.cover === 'black' || stage.cover === 'white')
    && (stage.tint === undefined || stage.tint === 'sepia' || stage.tint === 'night' || stage.tint === 'grey')
    && (stage.text === undefined || stage.text === 'full')
    && (stage.screen === undefined || (Array.isArray(stage.screen) && stage.screen.length <= PAGES_PER_SCREENFUL && stage.screen.every(isString)))
    && (stage.illustration === undefined || isString(stage.illustration))
    && Array.isArray(stage.characters) && stage.characters.every(character => isRecord(character)
      && isString(character.name) && isString(character.expression) && isPercentage(character.x)
      && (character.facing === null || character.facing === 'left' || character.facing === 'right')
      && (character.depth === undefined || character.depth === 'near' || character.depth === 'far'))
    && Array.isArray(choices) && choices.every(choice => isRecord(choice)
      && isString(choice.choiceId) && isString(choice.optionId) && isString(choice.decision) && isString(choice.option))
  return isValid ? value as unknown as SaveData : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isPercentage(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function excerptAt(story: PlayableStory, state: RuntimeState): string {
  const node = story.chapters.flatMap(chapter => flattenStoredNodes(chapter.nodes)).find(candidate => candidate.id === state.page?.nodeId)
  const text = node?.type === 'page' ? node.text : node?.type === 'choice' ? node.options.map(option => option.text).join(' / ') : ''
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text
}
