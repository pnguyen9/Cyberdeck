<script setup lang="ts">
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { commonMessages } from '../i18n/commonMessages'
import { storyboardMessages } from '../i18n/storyboardMessages'
import { storyWords } from '../i18n/storyWords'
import { useEditor } from './editorContext'
import { layOutStoryGraph, type GraphBox } from './storyGraph'

/**
 * The whole story as a map: drag it to move around, the wheel to zoom, a click on a box to select it.
 * The panel opens the card in the storyboard, and adds a branch, an option, or moves a branch.
 */
const emit = defineEmits<{
  open: [documentId: string, nodeId: string | null]
  addBranch: [documentId: string, conditionId: string]
  addOption: [documentId: string, choiceId: string]
  moveBranch: [documentId: string, conditionId: string, branchId: string, step: -1 | 1]
}>()
const { project, chapters, scenes } = useEditor()
const text = useMessages(storyboardMessages)
const common = useMessages(commonMessages)
const locale = useLocale()

const graph = computed(() => layOutStoryGraph(project.value, chapters.value, scenes.value, {
  ...storyWords[locale.value],
  pages: count => common.value.pageCount(count),
  onlyIf: condition => text.value.graphOnlyIf(condition),
  otherwise: 'else',
  elseIf: condition => `else if ${condition}`,
  ifCondition: condition => `if ${condition}`,
  choice: decision => text.value.graphChoice(decision),
}))

const MARGIN = 40
const MINIMUM_ZOOM = 0.15
const MAXIMUM_ZOOM = 2
const ZOOM_STEP = 1.15
const viewport = useTemplateRef<HTMLElement>('viewport')
const zoom = ref(1)
const pan = ref({ x: MARGIN, y: MARGIN })
const selectedId = ref<string | null>(null)
const selected = computed(() => graph.value.boxes.find(box => box.id === selectedId.value) ?? null)

/** At first, the whole width of the story in view, never larger than life. */
onMounted(() => {
  const width = viewport.value?.clientWidth ?? 800
  zoom.value = Math.min(1, Math.max(MINIMUM_ZOOM, (width - 2 * MARGIN) / Math.max(1, graph.value.width)))
})

/**
 * A press on a box selects it once released without moving; a press anywhere then dragged moves the
 * map. The box is noted on the press: once the pointer is captured, the release lands on the viewport.
 */
let drag: { x: number; y: number; panX: number; panY: number; moved: boolean; boxId: string | null } | null = null
function onPointerDown(event: PointerEvent) {
  const boxId = (event.target as Element).closest('[data-box]')?.getAttribute('data-box') ?? null
  drag = { x: event.clientX, y: event.clientY, panX: pan.value.x, panY: pan.value.y, moved: false, boxId }
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (drag === null) {
    return
  }
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  drag.moved ||= Math.abs(dx) + Math.abs(dy) > 4
  pan.value = { x: drag.panX + dx, y: drag.panY + dy }
}
function onPointerUp() {
  if (drag !== null && !drag.moved) {
    selectedId.value = drag.boxId
  }
  drag = null
}

/** Zooms in or out by `factor` around a point of the viewport, which keeps what is under it in place. */
function zoomAround(point: { x: number; y: number }, factor: number) {
  const next = Math.min(MAXIMUM_ZOOM, Math.max(MINIMUM_ZOOM, zoom.value * factor))
  pan.value = { x: point.x - (point.x - pan.value.x) * next / zoom.value, y: point.y - (point.y - pan.value.y) * next / zoom.value }
  zoom.value = next
}

function onWheel(event: WheelEvent) {
  const rect = viewport.value?.getBoundingClientRect()
  if (rect !== undefined) {
    zoomAround({ x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
  }
}

/** A box reached with Tab is brought into view; Enter or Space selects it. */
function onBoxFocus(box: GraphBox) {
  const rect = viewport.value?.getBoundingClientRect()
  if (rect === undefined) {
    return
  }
  const left = pan.value.x + box.x * zoom.value
  const top = pan.value.y + box.y * zoom.value
  const right = left + box.width * zoom.value
  const bottom = top + box.height * zoom.value
  const dx = left < MARGIN ? MARGIN - left : right > rect.width - MARGIN ? rect.width - MARGIN - right : 0
  const dy = top < MARGIN ? MARGIN - top : bottom > rect.height - MARGIN ? rect.height - MARGIN - bottom : 0
  pan.value = { x: pan.value.x + dx, y: pan.value.y + dy }
}

/**
 * Enter on a box selects it and moves to its panel, whose buttons are then a Tab away rather than
 * past every box after it; Esc in the panel comes back to the box.
 */
const panel = useTemplateRef<HTMLElement>('panel')
let boxLeft: SVGElement | null = null
function selectFromKeyboard(box: GraphBox, event: KeyboardEvent) {
  selectedId.value = box.id
  boxLeft = event.currentTarget as SVGElement
  void nextTick(() => panel.value?.querySelector('button')?.focus())
}
function backToBox() {
  boxLeft?.focus()
}

/** On the map itself: the arrows move it, + and − zoom around its middle. */
const PAN_STEP = 80
function onKeydown(event: KeyboardEvent) {
  const steps: Record<string, { x: number; y: number }> = { ArrowLeft: { x: PAN_STEP, y: 0 }, ArrowRight: { x: -PAN_STEP, y: 0 }, ArrowUp: { x: 0, y: PAN_STEP }, ArrowDown: { x: 0, y: -PAN_STEP } }
  const step = steps[event.key]
  if (step !== undefined) {
    event.preventDefault()
    pan.value = { x: pan.value.x + step.x, y: pan.value.y + step.y }
    return
  }
  if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '−') {
    event.preventDefault()
    const rect = viewport.value?.getBoundingClientRect()
    zoomAround({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 }, event.key === '-' || event.key === '−' ? 1 / ZOOM_STEP : ZOOM_STEP)
  }
}

const pathOf = (points: readonly { x: number; y: number }[]) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
</script>

<template>
  <div class="graph-view">
    <div
      ref="viewport"
      class="graph-viewport"
      tabindex="0"
      @keydown="onKeydown"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @wheel.prevent="onWheel"
    >
      <svg class="graph" :aria-label="text.graph">
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#5d6b80" />
          </marker>
        </defs>
        <g :transform="`translate(${pan.x} ${pan.y}) scale(${zoom})`">
          <path
            v-for="(edge, edgeIndex) in graph.edges"
            :key="edgeIndex"
            :d="pathOf(edge.points)"
            class="edge"
            :class="edge.kind"
            marker-end="url(#graph-arrow)"
          />
          <g
            v-for="box in graph.boxes"
            :key="box.id"
            :data-box="box.id"
            class="box"
            :class="[box.kind, { selected: box.id === selectedId }]"
            tabindex="0"
            role="button"
            :aria-label="[box.label, ...box.lines].join(', ')"
            :aria-pressed="box.id === selectedId"
            @focus="onBoxFocus(box)"
            @keydown.enter.stop.prevent="selectFromKeyboard(box, $event)"
            @keydown.space.stop.prevent="selectFromKeyboard(box, $event)"
          >
            <rect :x="box.x" :y="box.y" :width="box.width" :height="box.height" rx="8" />
            <text :x="box.x + 12" :y="box.y + 22" class="label">{{ box.label }}</text>
            <text v-for="(line, lineIndex) in box.lines" :key="lineIndex" :x="box.x + 12" :y="box.y + 40 + lineIndex * 18" class="line">{{ line }}</text>
          </g>
        </g>
      </svg>
      <p class="muted graph-help">{{ text.graphHelp }}</p>
    </div>
    <aside v-if="selected !== null" ref="panel" class="graph-panel" @keydown.esc.stop="backToBox">
      <h3>{{ selected.label }}</h3>
      <p v-for="(line, lineIndex) in selected.lines" :key="lineIndex" class="muted">{{ line }}</p>
      <div class="actions">
        <button class="button small primary" @click="emit('open', selected.documentId, selected.nodeId)">{{ text.graphOpen }}</button>
        <button v-if="selected.kind === 'fork'" class="button small" @click="emit('addBranch', selected.documentId, selected.nodeId ?? '')">{{ text.graphAddBranch }}</button>
        <button v-if="selected.kind === 'choice'" class="button small" @click="emit('addOption', selected.documentId, selected.nodeId ?? '')">{{ text.graphAddOption }}</button>
        <template v-if="selected.kind === 'branch' && selected.conditionId !== undefined && selected.branchId !== undefined && selected.isElse !== true">
          <button class="button small" @click="emit('moveBranch', selected.documentId, selected.conditionId, selected.branchId, -1)">{{ text.graphBranchLeft }}</button>
          <button class="button small" @click="emit('moveBranch', selected.documentId, selected.conditionId, selected.branchId, 1)">{{ text.graphBranchRight }}</button>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.graph-view {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
}

.graph-viewport {
  position: relative;
  height: 70vh;
  overflow: hidden;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #0b0e14;
  cursor: grab;
  touch-action: none;
}

.graph-viewport:active {
  cursor: grabbing;
}

.graph {
  width: 100%;
  height: 100%;
  user-select: none;
}

.graph-help {
  position: absolute;
  left: 12px;
  bottom: 8px;
  margin: 0;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(11 14 20 / 0.9);
  font-size: 12px;
  pointer-events: none;
}

.edge {
  fill: none;
  stroke: #5d6b80;
  stroke-width: 1.5;
}

.edge.back {
  stroke: #fbbf24;
  stroke-dasharray: 4 4;
}

.edge.play {
  stroke: #c4b5fd;
  stroke-dasharray: 6 5;
}

.box rect {
  fill: #11151d;
  stroke: #2c3442;
}

.box {
  cursor: pointer;
}

.box .label {
  font: 600 14px system-ui, sans-serif;
  fill: #e6e9ef;
}

.box .line {
  font: 13px system-ui, sans-serif;
  fill: #a3acbb;
}

.box.chapter rect,
.box.scene rect {
  fill: #0e2a36;
  stroke: #9eeaff;
}

.box.scene rect {
  stroke: #c4b5fd;
}

.box.fork rect,
.box.branch rect {
  fill: #1a1630;
  stroke: #c4b5fd88;
}

.box.loop rect {
  fill: rgb(251 191 36 / 0.04);
  stroke: #fbbf2466;
}

.box.ending rect {
  fill: #2a2010;
  stroke: #fbbf24;
}

.box.choice rect {
  stroke: #5eead4;
}

.box:focus-visible {
  outline: none;
}

.box:focus-visible rect {
  stroke: #fff;
  stroke-width: 2;
}

.graph-viewport:focus-visible {
  outline: 2px solid #9eeaff;
}

.box.selected rect {
  stroke: #9eeaff;
  stroke-width: 3;
}

.graph-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
}

.graph-panel h3,
.graph-panel p {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
