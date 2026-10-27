<script setup lang="ts">
import { layOutProgressMap, type MapNode, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { computed } from 'vue'

const props = defineProps<{ story: PlayableStory; progress: ProgressData; closeLabel: string }>()
const emit = defineEmits<{ play: [save: SaveData]; close: [] }>()

const CARD_WIDTH = 260
const COLUMN_GAP = 90
const ROW_GAP = 40
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
const height = computed(() => PADDING * 2 + map.value.rowCount * rowHeight.value - ROW_GAP)

/** Curves from each option taken to where it led. */
const curves = computed(() => {
  const nodes = new Map(map.value.nodes.map(node => [node.key, node]))
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
    const bend = Math.max(40, (endX - startX) / 2)
    return [{ key: `${edge.from}/${edge.optionId}`, path: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}` }]
  })
})
</script>

<template>
  <div class="map-screen">
    <header class="map-header">
      <button class="close-button" @click="emit('close')">← {{ closeLabel }}</button>
      <h1>{{ story.project.name }} <span class="subtitle">routes explored</span></h1>
      <p v-if="map.endingsTotal > 0" class="endings">Endings reached: {{ map.endingsReached }} of {{ map.endingsTotal }}</p>
    </header>

    <p v-if="map.nodes.length === 0" class="empty">Nothing explored yet: the map fills in as you reach choices.</p>
    <div v-else class="map-scroll">
      <div class="map" :style="{ width: `${width}px`, height: `${height}px` }">
        <svg class="curves" :width="width" :height="height" aria-hidden="true">
          <path v-for="curve in curves" :key="curve.key" :d="curve.path" />
        </svg>
        <section
          v-for="node in map.nodes"
          :key="node.key"
          class="node"
          :class="node.type"
          :style="{ left: `${positionOf(node).x}px`, top: `${positionOf(node).y}px`, width: `${CARD_WIDTH}px`, height: `${heightOf(node)}px` }"
        >
          <template v-if="node.type === 'point'">
            <div class="point-header" :style="{ height: `${HEADER_HEIGHT - CARD_PADDING_TOP}px` }">
              <p class="chapter">{{ node.chapterTitle ?? 'Untitled chapter' }}</p>
              <h2>{{ node.decisionName }}</h2>
            </div>
            <ul class="options">
              <li v-for="option in node.options" :key="option.optionId" :class="{ untried: !option.isTaken }">
                <span>{{ option.isTaken ? '›' : '?' }}</span> {{ option.text }}
              </li>
            </ul>
            <button class="play-button" @click="emit('play', node.point.save)">Play from here</button>
          </template>
          <p v-else class="ending">{{ node.endingName === null ? 'The end' : `★ ${node.endingName}` }}</p>
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

.options li.untried {
  color: #7b8597;
}

.options li.untried span {
  color: #7b8597;
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

.ending {
  margin: 0;
  font-weight: 600;
  text-align: center;
}
</style>
