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
/** What a point held of what the journal shows players, as it was then: shown on hovering its card, or with its button. */
function valuesAt(save: SaveData): string | undefined {
  if (props.everyPath != null) {
    // The author sees every value of the point, not only what players are shown.
    const lines = [...Object.entries(save.decisions).map(([name, values]) => `${name}: ${values.join(', ')}`), ...Object.entries(save.counters ?? {}).map(([name, count]) => `${name}: ${count}`)]
    return lines.length === 0 ? undefined : lines.join('\n')
  }
  const entries = journalOf(props.story.project, stateFromSave(props.story, save), props.progress.endingIds).entries
  return entries.length === 0 ? undefined : entries.map(entry => `${entry.name}: ${entry.items.join(', ')}`).join('\n')
}

/** The key of the point whose values are shown over its card, opened by its button, until it is pressed again. */
const valuesShownOf = ref<string | null>(null)
/** The option whose button is pointed at or focused, as `<point key>/<option id>`: its line stands out. */
const highlighted = ref<string | null>(null)

/** Playing from a point reached where the story goes only forward would take the player back: not while that holds. */
function canPlayFrom(save: SaveData): boolean {
  return props.ignoresLocks === true || !isStageLocked({ gameMode: save.stage.game ?? null, noGoingBack: save.stage.locked ?? null }, props.progress.endingIds.length > 0)
}

const CARD_WIDTH = 260
const COLUMN_GAP = 160
/** The gap between rows, at least: it grows when more lines run under a row than it holds. */
const ROW_GAP = 40
/** The straight run a line takes from its point before turning, carrying the option it follows. */
const LABEL_RUN = 100
/** A line going under a point turns down and back up within this much of the gap between columns. */
const TURN = 40
/** Lines running under the same row, apart from one another, and away from the cards above and below. */
const LANE_SPACING = 8
const LANE_MARGIN = 12
/** From the top of a card to its first option: the curves leave from the middle of each option's row. */
const HEADER_HEIGHT = 64
const CARD_PADDING_TOP = 10
const OPTION_HEIGHT = 26
const FOOTER_HEIGHT = 48
const END_HEIGHT = 56
const PADDING = 24

const map = computed(() => layOutProgressMap(props.progress, props.story))

const heightOf = (node: MapNode) => node.type === 'end' ? END_HEIGHT : HEADER_HEIGHT + node.options.length * OPTION_HEIGHT + FOOTER_HEIGHT
const xOf = (column: number) => PADDING + column * (CARD_WIDTH + COLUMN_GAP)

/** Each point's values, worked out once for the map rather than at each drawing. */
const values = computed(() => new Map(map.value.nodes.flatMap(node => node.type === 'point' ? [[node.key, valuesAt(node.point.save)] as const] : [])))

/**
 * The map laid out: where each card stands, and the lines from each option taken to where it led.
 * Where the point branches, a line takes a straight run first, with the option it follows written
 * over it; a line with a point in its way steps down between the rows, runs under it in a lane of
 * its own, and comes back up. The gap between rows grows to hold all the lanes under a row.
 */
const layout = computed(() => {
  const nodes = new Map(map.value.nodes.map(node => [node.key, node]))
  const lanesUnder = new Map<number, number>()
  const lines = map.value.edges.flatMap(edge => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (from?.type !== 'point' || to === undefined) {
      return []
    }
    const startX = xOf(from.column) + CARD_WIDTH
    const runX = startX + (edge.label === null ? 0 : LABEL_RUN)
    const endX = xOf(to.column)
    const under = endX > runX + 2 * TURN ? edge.under : null
    const lane = under === null ? 0 : lanesUnder.get(under) ?? 0
    if (under !== null) {
      lanesUnder.set(under, lane + 1)
    }
    return [{ edge, from, to, startX, runX, endX, under, lane }]
  })
  const rowGap = Math.max(ROW_GAP, Math.max(0, ...lanesUnder.values()) * LANE_SPACING + 2 * LANE_MARGIN)
  const rowHeight = Math.max(END_HEIGHT, ...map.value.nodes.map(heightOf)) + rowGap
  const yOf = (row: number) => PADDING + row * rowHeight
  const curves = lines.map(({ edge, from, to, startX, runX, endX, under, lane }) => {
    const optionIndex = from.options.findIndex(option => option.optionId === edge.optionId)
    const startY = yOf(from.row) + HEADER_HEIGHT + optionIndex * OPTION_HEIGHT + OPTION_HEIGHT / 2
    const endY = yOf(to.row) + (to.type === 'end' ? END_HEIGHT / 2 : HEADER_HEIGHT / 2)
    let path: string
    if (under !== null) {
      // The lanes under a row, centred in the gap below it.
      const laneY = yOf(under + 1) - rowGap / 2 + (lane - ((lanesUnder.get(under) ?? 1) - 1) / 2) * LANE_SPACING
      path = `M ${startX} ${startY} H ${runX} C ${runX + TURN / 2} ${startY}, ${runX + TURN / 2} ${laneY}, ${runX + TURN} ${laneY} H ${endX - TURN} C ${endX - TURN / 2} ${laneY}, ${endX - TURN / 2} ${endY}, ${endX} ${endY}`
    } else {
      const bend = Math.max(40, (endX - runX) / 2)
      path = `M ${startX} ${startY} H ${runX} C ${runX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
    }
    return {
      key: `${edge.from}/${edge.optionId}/${edge.to}`,
      option: `${edge.from}/${edge.optionId}`,
      path,
      isUnder: under !== null,
      label: edge.label === null ? null : { text: edge.label, x: startX + 6, y: startY - 5 },
    }
  })
  return {
    positions: new Map(map.value.nodes.map(node => [node.key, { x: xOf(node.column), y: yOf(node.row) }])),
    curves,
    width: PADDING * 2 + map.value.columnCount * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP,
    // The gap below the last row included, for the lines that run under it.
    height: PADDING * 2 + map.value.rowCount * rowHeight,
  }
})
/** The line of the option pointed at, drawn again over the others. */
const highlightedCurves = computed(() => layout.value.curves.filter(curve => curve.option === highlighted.value))
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
      <div class="map" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
        <svg class="curves" :width="layout.width" :height="layout.height" aria-hidden="true">
          <path v-for="curve in layout.curves" :key="curve.key" :d="curve.path" :data-under="curve.isUnder ? '' : undefined" />
          <path v-for="curve in highlightedCurves" :key="`${curve.key}/highlighted`" class="highlighted" :d="curve.path" />
          <template v-for="curve in layout.curves" :key="`${curve.key}/label`">
            <text v-if="curve.label !== null" class="line-label" :class="{ highlighted: curve.option === highlighted }" :x="curve.label.x" :y="curve.label.y">{{ curve.label.text }}</text>
          </template>
        </svg>
        <section
          v-for="node in map.nodes"
          :key="node.key"
          class="node"
          :class="node.type"
          :title="values.get(node.key)"
          :style="{ left: `${layout.positions.get(node.key)?.x}px`, top: `${layout.positions.get(node.key)?.y}px`, width: `${CARD_WIDTH}px`, height: `${heightOf(node)}px` }"
        >
          <template v-if="node.type === 'point'">
            <div class="point-header" :style="{ height: `${HEADER_HEIGHT - CARD_PADDING_TOP}px` }">
              <p class="chapter">{{ node.chapterTitle ?? text.untitledChapter }}</p>
              <h2>{{ node.decisionName }}</h2>
              <button
                v-if="values.get(node.key) !== undefined"
                class="values-button"
                :aria-label="text.showValues"
                :aria-expanded="valuesShownOf === node.key"
                :aria-controls="`map-values-${node.key}`"
                @click="valuesShownOf = valuesShownOf === node.key ? null : node.key"
              >
                i
              </button>
            </div>
            <p v-if="valuesShownOf === node.key" :id="`map-values-${node.key}`" class="values" :style="{ top: `${HEADER_HEIGHT}px` }" @click="valuesShownOf = null">{{ values.get(node.key) }}</p>
            <ul class="options">
              <li
                v-for="option in node.options"
                :key="option.optionId"
                :class="{ untried: !option.isTaken }"
                @mouseenter="highlighted = `${node.key}/${option.optionId}`"
                @mouseleave="highlighted = null"
              >
                <button
                  v-if="option.offeredIn !== null && canPlayFrom(option.offeredIn)"
                  class="option-play"
                  :title="text.playOption(option.text)"
                  :aria-label="text.playOption(option.text)"
                  @focus="highlighted = `${node.key}/${option.optionId}`"
                  @blur="highlighted = null"
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
  /* The map keeps the player's colours, whatever the application's look: its scrollbars stay dark. */
  color-scheme: dark;
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

.curves path.highlighted {
  stroke: #9eeaff;
  stroke-width: 3.5;
}

.curves .line-label {
  font-size: 13px;
  fill: #8cc4d4;
  stroke: #0b0d12;
  stroke-width: 3px;
  paint-order: stroke;
}

.curves .line-label.highlighted {
  font-weight: 600;
  fill: #9eeaff;
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

.values-button:hover,
.values-button:focus-visible,
.values-button[aria-expanded='true'] {
  border-color: #9eeaff;
}

.point-header {
  padding-right: 30px;
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
