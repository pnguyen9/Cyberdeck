<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { effectiveFacing, type ResolvedAnimation, type StageCatalog, type StageState } from '@cyberdeck/core'

const props = defineProps<{ stage: StageState; catalog: StageCatalog }>()

/** Far enough for a character to start or end outside the stage, wherever it stands. */
const SLIDE_DISTANCE = '1920px'

/** Until a file is given, each background name gets its own colours. */
function hueOf(name: string): number {
  let hash = 0
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360
  }
  return hash
}

const background = computed(() => {
  const backgroundId = props.stage.backgroundId
  if (backgroundId === null) {
    return { key: 'none', style: { background: '#0b0d12' }, placeholderName: null }
  }
  const url = props.catalog.backgroundUrl(backgroundId)
  if (url !== null) {
    return { key: backgroundId, style: { backgroundImage: `url("${url}")` }, placeholderName: null }
  }
  const name = props.catalog.backgroundName(backgroundId)
  const hue = hueOf(name)
  return {
    key: backgroundId,
    style: { background: `linear-gradient(160deg, hsl(${hue} 45% 30%), hsl(${(hue + 40) % 360} 50% 12%))` },
    placeholderName: name,
  }
})

/** Nearer is larger and in front, farther smaller, behind and a little dimmer; sizes scale from the feet. */
const DEPTH_STYLES = {
  near: { scale: '1.25', zIndex: 3, filter: 'none' },
  middle: { scale: '1', zIndex: 2, filter: 'none' },
  far: { scale: '0.75', zIndex: 1, filter: 'brightness(0.85)' },
} as const

/**
 * Pictures turning over, `[card: {Drawn} flip]`, by character: the old picture narrows to nothing,
 * then the new one widens from it, each half of the time given.
 */
const turnovers = ref<Readonly<Record<string, { expressionId: string; half: 'out' | 'in'; halfMs: number }>>>({})
const turnoverTimers = new Map<string, ReturnType<typeof setTimeout>>()
function endTurnover(characterId: string) {
  const { [characterId]: _, ...others } = turnovers.value
  turnovers.value = others
  turnoverTimers.delete(characterId)
}
watch(() => props.stage.characters.map(onStage => ({ characterId: onStage.characterId, expressionId: onStage.expressionId, turnMs: onStage.turnMs })), (current, previous) => {
  for (const { characterId, expressionId, turnMs } of current) {
    const before = previous?.find(candidate => candidate.characterId === characterId)
    if (before === undefined || before.expressionId === expressionId || turnMs === undefined || turnMs <= 0) {
      continue
    }
    clearTimeout(turnoverTimers.get(characterId))
    const halfMs = turnMs / 2
    turnovers.value = { ...turnovers.value, [characterId]: { expressionId: before.expressionId, half: 'out', halfMs } }
    turnoverTimers.set(characterId, setTimeout(() => {
      turnovers.value = { ...turnovers.value, [characterId]: { expressionId, half: 'in', halfMs } }
      turnoverTimers.set(characterId, setTimeout(() => endTurnover(characterId), halfMs))
    }, halfMs))
  }
})
onBeforeUnmount(() => turnoverTimers.forEach(timer => clearTimeout(timer)))

const characters = computed(() => props.stage.characters.map(onStage => {
  const facing = effectiveFacing(onStage)
  const drawnFacing = props.catalog.drawnFacing(onStage.characterId)
  const turnover = turnovers.value[onStage.characterId]
  const expressionId = turnover?.expressionId ?? onStage.expressionId
  return {
    characterId: onStage.characterId,
    name: props.catalog.characterName(onStage.characterId),
    expression: props.catalog.expressionName(onStage.characterId, expressionId),
    imageUrl: props.catalog.expressionUrl(onStage.characterId, expressionId),
    turnClass: turnover === undefined ? null : `turning-${turnover.half}`,
    turnStyle: turnover === undefined ? {} : { '--turn-ms': `${turnover.halfMs}ms` },
    facingArrow: facing === 'left' ? '←' : facing === 'right' ? '→' : '',
    isMirrored: drawnFacing !== null && facing !== null && facing !== drawnFacing,
    style: { left: `${onStage.x}%`, transitionDuration: `${onStage.moveDurationMs}ms`, ...DEPTH_STYLES[onStage.depth] },
  }
}))

/** Transitions the stage plays; any other name is a cut. Through a colour, the old background fades out first. */
const KNOWN_TRANSITIONS = new Set(['fade', 'black', 'white'])
const transition = computed(() => {
  const announced = props.stage.backgroundTransition
  const name = announced !== null && KNOWN_TRANSITIONS.has(announced.name) ? announced.name : 'cut'
  return {
    name,
    mode: name === 'black' || name === 'white' ? 'out-in' as const : 'default' as const,
    style: { '--transition-ms': `${announced?.durationMs ?? 0}ms`, background: name === 'white' ? '#fff' : '#000' },
  }
})

/** Over the whole stage; without a file, its name stands in, on a plain picture. */
const illustration = computed(() => {
  const illustrationId = props.stage.illustrationId
  if (illustrationId === null) {
    return null
  }
  const url = props.catalog.illustrationUrl(illustrationId)
  return url !== null
    ? { key: illustrationId, style: { backgroundImage: `url("${url}")` }, placeholderName: null }
    : { key: illustrationId, style: { background: 'linear-gradient(160deg, #2a2440, #0d0b14)' }, placeholderName: props.catalog.illustrationName(illustrationId) }
})

/** Music with a file is heard; without one, its name stands in. */
const silentMusicName = computed(() => {
  const musicId = props.stage.musicId
  return musicId === null || props.catalog.musicUrl(musicId) !== null ? null : props.catalog.musicName(musicId)
})

const AT_PLACE = 'translateX(-50%)'
const FROM_LEFT = `translateX(calc(-50% - ${SLIDE_DISTANCE}))`
const FROM_RIGHT = `translateX(calc(-50% + ${SLIDE_DISTANCE}))`

/** Keyframes of an animation as it plays on entrance; exits play them backwards. */
function keyframesOf(animation: ResolvedAnimation): Keyframe[] | null {
  switch (animation.kind) {
    case 'instant':
      return null
    case 'fade':
      return [{ opacity: 0 }, { opacity: 1 }]
    case 'slide-from-left':
    case 'slide-to-left':
      return [{ transform: FROM_LEFT }, { transform: AT_PLACE }]
    case 'slide-from-right':
    case 'slide-to-right':
      return [{ transform: FROM_RIGHT }, { transform: AT_PLACE }]
  }
}

function play(element: Element, animation: ResolvedAnimation | undefined, direction: 'normal' | 'reverse', done: () => void) {
  const keyframes = animation === undefined ? null : keyframesOf(animation)
  if (animation === undefined || keyframes === null || animation.durationMs === 0) {
    done()
    return
  }
  const running = element.animate(keyframes, { duration: animation.durationMs, easing: direction === 'normal' ? 'ease-out' : 'ease-in', direction })
  running.onfinish = done
  running.oncancel = done
}

/** Characters enter and leave as the text says; the stage state keeps how. */
function onEnter(element: Element, done: () => void) {
  const characterId = (element as HTMLElement).dataset.characterId
  play(element, props.stage.characters.find(onStage => onStage.characterId === characterId)?.entrance, 'normal', done)
}

function onLeave(element: Element, done: () => void) {
  const characterId = (element as HTMLElement).dataset.characterId ?? ''
  play(element, props.stage.departures[characterId], 'reverse', done)
}
</script>

<template>
  <div class="stage" :class="stage.tint === null ? null : `tint-${stage.tint}`" :style="transition.style">
    <Transition :name="transition.name" :mode="transition.mode">
      <div :key="background.key" class="background" :style="background.style" />
    </Transition>

    <TransitionGroup tag="div" class="characters" :css="false" @enter="onEnter" @leave="onLeave">
      <div
        v-for="character in characters"
        :key="character.characterId"
        class="character"
        :data-character-id="character.characterId"
        :style="character.style"
      >
        <div class="turn" :class="character.turnClass" :style="character.turnStyle">
          <img
            v-if="character.imageUrl !== null"
            class="sprite"
            :class="{ mirrored: character.isMirrored }"
            :src="character.imageUrl"
            :alt="`${character.name}, ${character.expression}`"
          >
          <template v-else>
            <div class="silhouette">
              <span class="placeholder-label character-label">{{ character.name }} · {{ character.expression }}</span>
              {{ character.name.charAt(0).toUpperCase() }}<span class="facing">{{ character.facingArrow }}</span>
            </div>
          </template>
        </div>
      </div>
    </TransitionGroup>

    <Transition name="illustration">
      <div v-if="illustration !== null" :key="illustration.key" class="illustration" :style="illustration.style">
        <span v-if="illustration.placeholderName !== null" class="placeholder-label illustration-label">{{ illustration.placeholderName }}</span>
      </div>
    </Transition>
    <div class="placeholder-label stage-labels">
      <span v-if="background.placeholderName !== null">{{ background.placeholderName }}</span>
      <span v-if="silentMusicName !== null">♪ {{ silentMusicName }}</span>
    </div>
  </div>
</template>

<style scoped>
.stage,
.background {
  position: absolute;
  inset: 0;
}

.background {
  background-size: cover;
  background-position: center;
}

.placeholder-label {
  font: 28px/1.2 system-ui, sans-serif;
  color: rgb(255 255 255 / 0.55);
}

.stage-labels {
  position: absolute;
  top: 32px;
  right: 40px;
  display: flex;
  gap: 32px;
}

.characters {
  position: absolute;
  inset: 0;
}

/* `left` is the character's centre; moves glide over the duration the stage state gives. */
.character {
  position: absolute;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  transform: translateX(-50%);
  transform-origin: 50% 100%;
  transition-property: left, scale, filter;
  transition-timing-function: ease-in-out;
}

/* Sprites stand on the bottom edge, behind the textbox, as in most visual novels. */
.sprite {
  display: block;
  max-height: 960px;
  max-width: 800px;
}

.mirrored {
  transform: scaleX(-1);
}

/* A picture turning over: narrowing to its edge, then widening as the new one. */
.turning-out {
  animation: turn-out var(--turn-ms) ease-in forwards;
}

.turning-in {
  animation: turn-in var(--turn-ms) ease-out;
}

@keyframes turn-out {
  to { transform: scaleX(0); }
}

@keyframes turn-in {
  from { transform: scaleX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .turning-out,
  .turning-in {
    animation: none;
  }
}

.silhouette {
  position: relative;
  display: grid;
  place-items: center;
  width: 300px;
  height: 520px;
  border-radius: 150px 150px 24px 24px;
  background: rgb(255 255 255 / 0.14);
  border: 2px solid rgb(255 255 255 / 0.3);
  font: 600 140px/1 system-ui, sans-serif;
  color: rgb(255 255 255 / 0.5);
}

.facing {
  font-size: 64px;
}

/* Placeholders stand above the textbox, their labels at the top where neither the box nor the menu covers them. */
.silhouette {
  margin-bottom: 300px;
}

.character-label {
  position: absolute;
  top: 28px;
  right: 12px;
  left: 12px;
  text-align: center;
}

/* A pixel past each edge: on a stage scaled to a fraction, the background never shows at the border. */
.illustration {
  position: absolute;
  inset: -1px;
  background-size: cover;
  background-position: center;
}

/* At the top middle: the leave button and the stage's labels hold the corners. */
.illustration-label {
  position: absolute;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
}

.illustration-enter-active,
.illustration-leave-active {
  transition: opacity 0.6s ease;
}

.illustration-enter-from,
.illustration-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-ms) ease;
}

/* Through a colour: out then in, each in half the time. */
.black-enter-active,
.black-leave-active,
.white-enter-active,
.white-leave-active {
  transition: opacity calc(var(--transition-ms) / 2) ease;
}

.fade-enter-from,
.fade-leave-to,
.black-enter-from,
.black-leave-to,
.white-enter-from,
.white-leave-to {
  opacity: 0;
}

/* Tints colour everything on stage, backgrounds and characters, until changed. */
.background,
.characters {
  transition: filter 0.8s ease;
}

.tint-sepia .background,
.tint-sepia .characters {
  filter: sepia(0.85) contrast(1.05) brightness(0.95);
}

.tint-night .background,
.tint-night .characters {
  filter: brightness(0.5) saturate(0.6) sepia(0.3) hue-rotate(180deg);
}

.tint-grey .background,
.tint-grey .characters {
  filter: grayscale(1);
}
</style>
