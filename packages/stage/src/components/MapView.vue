<script setup lang="ts">
import { isStageLocked, journalOf, layOutProgressMap, stateFromSave, type MapNode, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { computed, ref } from 'vue'
import { useMessages } from '../i18n/locale'
import { mapMessages } from '../i18n/mapMessages'

/**
 * `ignoresLocks`: an author testing the story plays from any point, `[no going back]` or not.
 * `everyPath`: the map explored from the story for its author rather than the paths played, whole or
 * in part; its points tell all their values. `switchLabel`: a button to show the other map.
 */
const props = defineProps<{ story: PlayableStory; progress: ProgressData; closeLabel: string; ignoresLocks?: boolean; everyPath?: { isWhole: boolean } | null; switchLabel?: string }>()
const emit = defineEmits<{ play: [save: SaveData]; close: []; switch: [] }>()
const text = useMessages(mapMessages)
/** What the point held of what the journal shows players, as it was then: shown on hovering it. */
function valuesAt(save: SaveData): string | undefined {
  if (props.everyPath != null) {
    // The author sees every value of the point, not only what players are shown.
    const lines = [...Object.entries(save.decisions).map(([name, values]) => `${name}: ${values.join(', ')}`), ...Object.entries(save.counters ?? {}).map(([name, count]) => `${name}: ${count}`)]
    return lines.length === 0 ? undefined : lines.join('\n')
  }
  const entries = journalOf(props.story.project, stateFromSave(props.story, save), props.progress.endingIds).entries
  return entries.length === 0 ? undefined : entries.map(entry => `${entry.name}: ${entry.items.join(', ')}`).join('\n')
}

/**
 * A screen without a mouse hovers nothing: there, a point whose values the journal showed has a
 * button that shows them over its card, until tapped again. The key of the point shown, if any.
 */
const valuesShownOf = ref<string | null>(null)

/** Playing from a point reached where the story goes only forward would take the player back: not while that holds. */
function canPlayFrom(save: SaveData): boolean {
  return props.ignoresLocks === true || !isStageLocked({ gameMode: save.stage.game ?? null, noGoingBack: save.stage.locked ?? null }, props.progress.endingIds.length > 0)
}

const CARD_WIDTH = 260
const COLUMN_GAP = 160
const ROW_GAP = 40
/** The straight run a line takes from its point before turning, carrying the option it follows. */
const LABEL_RUN = 100
/** A line going under a point turns down and back up within this much of the gap between columns. */
const TURN = 40
/** Lines running between the same rows, a little apart from one another. */
const LANE_SPACING = 6
/** From the top of a card to its first option: the curves leave from the middle of each option's row. */
const HEADER_HEIGHT = 64
const CARD_PADDING_TOP = 10
const OPTION_HEIGHT = 26
const FOOTER_HEIGHT = 48
const END_HEIGHT = 56
const PADDING = 24

const map = computed(() => layOutProgressMap(props.progress, props.story))

const heightOf = (node: MapNode) => node.type === 'end' ? END_HEIGHT : HEADER_HEIGHT + node.options.length * OPTION_HEIGHT + FOOTER_HEIGHT
const rowHeight = computed(() => Math.max(END_HEIGHT, ...map.value.nodes.map(heightOf)) + ROW_GAP)
const positionOf = (node: MapNode) => ({ x: PADDING + node.column * (CARD_WIDTH + COLUMN_GAP), y: PADDING + node.row * rowHeight.value })
const width = computed(() => PADDING * 2 + map.value.columnCount * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP)
/** The gap below the last row included, for the lines that run under it. */
const height = computed(() => PADDING * 2 + map.value.rowCount * rowHeight.value)

/**
 * Lines from each option taken to where it led: where the point branches, a straight run first, with
 * the option it follows written over it; a line with a point in its way steps down between the rows,
 * runs under it and comes back up.
 */
const curves = computed(() => {
  const nodes = new Map(map.value.nodes.map(node => [node.key, node]))
  const lanesTaken = new Map<number, number>()
  return map.value.edges.flatMap(edge => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (from?.type !== 'point' || to === undefined) {
      return []
    }
    const start = positionOf(from)
    const end = positionOf(to)
    const optionIndex = from.options.findIndex(option => option.optionId === edge.optionId)
    const startX = start.x + CARD_WIDTH
    const startY = start.y + HEADER_HEIGHT + optionIndex * OPTION_HEIGHT + OPTION_HEIGHT / 2
    const endX = end.x
    const endY = end.y + (to.type === 'end' ? END_HEIGHT / 2 : HEADER_HEIGHT / 2)
    const runX = startX + (edge.label === null ? 0 : LABEL_RUN)
    let path: string
    const under = endX > runX + 2 * TURN ? edge.under : null
    if (under !== null) {
      const lane = lanesTaken.get(under) ?? 0
      lanesTaken.set(under, lane + 1)
      const laneY = PADDING + (under + 1) * rowHeight.value - ROW_GAP / 2 + ((lane % 5) - 2) * LANE_SPACING
      path = `M ${startX} ${startY} H ${runX} C ${runX + TURN / 2} ${startY}, ${runX + TURN / 2} ${laneY}, ${runX + TURN} ${laneY} H ${endX - TURN} C ${endX - TURN / 2} ${laneY}, ${endX - TURN / 2} ${endY}, ${endX} ${endY}`
    } else {
      const bend = Math.max(40, (endX - runX) / 2)
      path = `M ${startX} ${startY} H ${runX} C ${runX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
    }
    return [{ key: `${edge.from}/${edge.optionId}/${edge.to}`, path, isUnder: under !== null, label: edge.label === null ? null : { text: edge.label, x: startX + 6, y: startY - 4 } }]
  })
})
</script>

<template>
  <div class="map-screen">
    <header class="map-header">
      <button class="close-button" @click="emit('close')">← {{ closeLabel }}</button>
      <h1>{{ story.project.name }} <span class="subtitle">{{ everyPath != null ? text.everyPath : text.routesExplored }}</span></h1>
      <p v-if="map.endingsTotal > 0" class="endings">{{ text.endingsReached(map.endingsReached, map.endingsTotal) }}</p>
      <button v-if="switchLabel !== undefined" class="close-button switch-button" @click="emit('switch')">{{ switchLabel }}</button>
    </header>
    <p v-if="everyPath != null && !everyPath.isWhole" class="partly">{{ text.partly }}</p>

    <p v-if="map.nodes.length === 0" class="empty">{{ text.nothingExplored }}</p>
    <div v-else class="map-scroll">
      <div class="map" :style="{ width: `${width}px`, height: `${height}px` }">
        <svg class="curves" :width="width" :height="height" aria-hidden="true">
          <path v-for="curve in curves" :key="curve.key" :d="curve.path" :data-under="curve.isUnder ? '' : undefined" />
          <template v-for="curve in curves" :key="`${curve.key}/label`">
            <text v-if="curve.label !== null" class="line-label" :x="curve.label.x" :y="curve.label.y">{{ curve.label.text }}</text>
          </template>
        </svg>
        <section
          v-for="node in map.nodes"
          :key="node.key"
          class="node"
          :class="node.type"
          :title="node.type === 'point' ? valuesAt(node.point.save) : undefined"
          :style="{ left: `${positionOf(node).x}px`, top: `${positionOf(node).y}px`, width: `${CARD_WIDTH}px`, height: `${heightOf(node)}px` }"
        >
          <template v-if="node.type === 'point'">
            <div class="point-header" :style="{ height: `${HEADER_HEIGHT - CARD_PADDING_TOP}px` }">
              <p class="chapter">{{ node.chapterTitle ?? text.untitledChapter }}</p>
              <h2>{{ node.decisionName }}</h2>
              <button
                v-if="valuesAt(node.point.save) !== undefined"
                class="values-button"
                :aria-label="text.showValues"
                :aria-expanded="valuesShownOf === node.key"
                @click="valuesShownOf = valuesShownOf === node.key ? null : node.key"
              >
                i
              </button>
            </div>
            <p v-if="valuesShownOf === node.key" class="values" :style="{ top: `${HEADER_HEIGHT}px` }" @click="valuesShownOf = null">{{ valuesAt(node.point.save) }}</p>
            <ul class="options">
              <li v-for="option in node.options" :key="option.optionId" :class="{ untried: !option.isTaken }">
                <button
                  v-if="option.offeredIn !== null && canPlayFrom(option.offeredIn)"
                  class="option-play"
                  :title="text.playOption(option.text)"
                  :aria-label="text.playOption(option.text)"
                  @click="emit('play', option.offeredIn)"
                >
                  ▶
                </button>
                <span v-else>{{ option.isTaken ? '›' : '?' }}</span> {{ option.text }}
              </li>
            </ul>
            <button v-if="canPlayFrom(node.point.save)" class="play-button" @click="emit('play', node.point.save)">{{ text.playFromHere }}</button>
            <p v-else class="forward-only">{{ text.forwardOnly }}</p>
          </template>
          <p v-else class="ending">{{ node.endingName === null ? text.theEnd : `★ ${node.endingName}` }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0b0d12;
  font: 16px/1.4 system-ui, sans-serif;
  color: #e6e9ef;
}

.map-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 24px;
  padding: 16px 24px;
  border-bottom: 1px solid #2c3442;
}

.map-header h1 {
  margin: 0;
  font-size: 22px;
  color: #9eeaff;
}

.subtitle {
  font-weight: 400;
  color: #7b8597;
}

.partly {
  margin: 0 32px 8px;
  color: #a3acbb;
  font-size: 15px;
}

.endings {
  margin: 0;
  color: #a3acbb;
}

.close-button {
  padding: 6px 12px;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  font: inherit;
  color: #e6e9ef;
  cursor: pointer;
}

.empty {
  padding: 24px;
  color: #7b8597;
}

.map-scroll {
  flex: 1;
  overflow: auto;
}

.map {
  position: relative;
}

.curves {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.curves path {
  fill: none;
  stroke: #3e6f80;
  stroke-width: 2;
}

.curves .line-label {
  font-size: 11px;
  fill: #8cc4d4;
  stroke: #0b0d12;
  stroke-width: 3px;
  paint-order: stroke;
}

.node {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px 14px 0;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
}

.node.end {
  justify-content: center;
  padding-bottom: 10px;
  border-color: #9eeaff;
}

.chapter {
  margin: 0;
  font-size: 12px;
  color: #7b8597;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node h2 {
  margin: 0;
  font-size: 16px;
}

.options {
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
}

.options li {
  height: 26px;
  line-height: 26px;
  overflow: hidden;
  font-size: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.options span {
  display: inline-block;
  width: 1em;
  color: #9eeaff;
}

.option-play {
  width: 1.2em;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: #9eeaff;
  cursor: pointer;
}

.option-play:hover,
.option-play:focus-visible {
  color: #fff;
}

.options li.untried {
  color: #7b8597;
}

.options li.untried span {
  color: #7b8597;
}

.forward-only {
  margin: 0;
  font: italic 14px/1.3 system-ui, sans-serif;
  color: #8a94a6;
}

.play-button {
  align-self: flex-start;
  margin-bottom: 12px;
  padding: 4px 12px;
  border: 1px solid #9eeaff;
  border-radius: 6px;
  background: #0e2a36;
  font: inherit;
  font-size: 14px;
  color: #9eeaff;
  cursor: pointer;
}

.values-button {
  display: none;
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #3e6f80;
  border-radius: 50%;
  background: #0e2a36;
  font: italic 600 15px/1 Georgia, serif;
  color: #9eeaff;
  cursor: pointer;
}

/* Only where nothing hovers: a mouse sees the values by pointing at the card. */
@media (hover: none) {
  .values-button {
    display: block;
  }

  .point-header {
    padding-right: 30px;
  }
}

.values {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  margin: 0;
  padding: 8px 14px;
  overflow: auto;
  border-radius: 0 0 8px 8px;
  background: #0e2a36;
  font-size: 14px;
  white-space: pre-line;
}

.ending {
  margin: 0;
  font-weight: 600;
  text-align: center;
}
</style>
