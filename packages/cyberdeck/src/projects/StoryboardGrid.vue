<script setup lang="ts">
import { MARKER_SYMBOLS } from './markerSymbols'
import type { LevelElement, StoredCondition, StoredPage, StoryboardLevel } from '@cyberdeck/core'
import { useMessages } from '@cyberdeck/stage'
import { commonMessages } from '../i18n/commonMessages'
import { storyboardMessages } from '../i18n/storyboardMessages'
import { emptyLaneId } from './gridSelection'

/**
 * One level of the storyboard: the chapter's pages and markers, each condition as one block, or
 * the branches of the block entered, as lanes. A small block shows its branches inside its frame;
 * one holding more pages than the limit is a single card, stacked so as not to pass for a page.
 * Drawing only: what clicks and drops mean is the storyboard's business.
 */
const props = defineProps<{
  level: StoryboardLevel
  chapterTitle: string
  focusedId: string | null
  selectedIds: ReadonlySet<string>
  /** The card whose text is open in the panel. */
  editingId: string | null
  cutIds: ReadonlySet<string>
  dropTarget: { elementId: string; side: 'before' | 'after' } | null
  register: (elementId: string, element: unknown) => void
  branchColor: (branch: string) => string | undefined
  speakerName: (speakerId: string | null) => string | null
  decisionName: (decisionId: string) => string
  conditionText: (condition: StoredCondition) => string
}>()
const emit = defineEmits<{
  pick: [elementId: string, event: MouseEvent]
  open: [elementId: string]
  dragStart: [elementId: string, event: DragEvent]
  dragOver: [elementId: string, event: DragEvent]
  drop: []
  dragEnd: []
  /** Shows the level of a block of the path, or the chapter's for null. */
  goTo: [blockId: string | null]
  /** Something dragged was dropped on an entry of the path: it goes out to that level. */
  dropOnPath: [pathIndex: number]
}>()


const stateClasses = (elementId: string) => ({
  focused: elementId === props.focusedId,
  selected: props.selectedIds.has(elementId),
  editing: elementId === props.editingId,
  cut: props.cutIds.has(elementId),
  'drop-before': props.dropTarget?.elementId === elementId && props.dropTarget.side === 'before',
  'drop-after': props.dropTarget?.elementId === elementId && props.dropTarget.side === 'after',
})
const text = useMessages(storyboardMessages)
const common = useMessages(commonMessages)
/** How many routes of a block end inside it, as its mark says. */
const endingMark = (element: Extract<LevelElement, { kind: 'block' }>) => element.allRoutesEnd
  ? text.value.everyRouteEnds
  : element.endingRouteCount === 0 ? null : text.value.routesEnd(element.endingRouteCount)
/** Pages inside a block that no path reaches; a block itself unreached is already shown faded. */
const unreachableMark = (element: Extract<LevelElement, { kind: 'block' }>) => element.isUnreachable || element.unreachablePageCount === 0
  ? null
  : text.value.neverReached(element.unreachablePageCount)
/** Inside a loop, its one lane: what it does, said here rather than as the storyboard words it. */
const stagingCount = (page: StoredPage) => page.commandsBefore.length + page.inlineCommands.length
const routeCount = (element: Extract<LevelElement, { kind: 'block' }>) => element.branches.length
</script>

<template>
  <div class="grid">
    <nav v-if="level.path.length > 0" class="path" :aria-label="text.blocksEntered">
      <button class="path-entry" @click="emit('goTo', null)" @dragover.prevent.stop @drop.prevent.stop="emit('dropOnPath', 0)">{{ chapterTitle }}</button>
      <template v-for="(entry, index) in level.path" :key="entry.id">
        <span class="separator">›</span>
        <button
          class="path-entry"
          :class="{ current: index === level.path.length - 1 }"
          @click="emit('goTo', entry.id)"
          @dragover.prevent.stop
          @drop.prevent.stop="index < level.path.length - 1 && emit('dropOnPath', index + 1)"
        >
          {{ entry.kind === 'loop' ? text.loop : `◆ ${entry.text}` }}
        </button>
      </template>
    </nav>

    <section v-for="(lane, laneIndex) in level.lanes" :key="lane.containerId ?? 'chapter'" :data-lane="laneIndex" class="lane" :class="{ titled: lane.text !== null }" :style="{ '--branch-color': branchColor(lane.branch) }">
      <h3 v-if="lane.text !== null" class="lane-title">{{ lane.text }}<span v-if="lane.stops" class="ending-mark">{{ ` ${text.laneEnds}` }}</span></h3>
      <div class="elements">
        <div
          v-if="lane.elements.length === 0"
          :id="`element-${emptyLaneId(lane.containerId)}`"
          :ref="element => register(emptyLaneId(lane.containerId), element)"
          class="element empty-lane"
          :class="stateClasses(emptyLaneId(lane.containerId))"
          role="option"
          @click="emit('pick', emptyLaneId(lane.containerId), $event)"
          @dragover.prevent.stop="emit('dragOver', emptyLaneId(lane.containerId), $event)"
          @drop.prevent.stop="emit('drop')"
        >
          {{ text.nothingHereYet }}
        </div>
        <div
          v-for="element in lane.elements"
          :id="`element-${element.id}`"
          :key="element.id"
          :ref="domElement => register(element.id, domElement)"
          class="element"
          :class="[element.kind === 'block' ? ['block', { collapsed: element.isCollapsed }] : element.entry.type, stateClasses(element.id), { unreachable: element.isUnreachable }]"
          :title="element.isUnreachable ? text.unreachedTitle : undefined"
          :style="{ '--branch-color': branchColor(element.kind === 'entry' ? element.entry.branch : lane.branch) }"
          role="option"
          :aria-selected="selectedIds.has(element.id)"
          draggable="true"
          @click="emit('pick', element.id, $event)"
          @dblclick="emit('open', element.id)"
          @dragstart="emit('dragStart', element.id, $event)"
          @dragover.prevent.stop="emit('dragOver', element.id, $event)"
          @drop.prevent.stop="emit('drop')"
          @dragend="emit('dragEnd')"
        >
          <template v-if="element.kind === 'entry' && element.entry.type === 'card' && element.entry.node.type === 'page'">
            <span class="number">{{ element.entry.number }}</span>
            <span v-if="speakerName(element.entry.node.speakerId) !== null" class="speaker">{{ speakerName(element.entry.node.speakerId) }}</span>
            <span class="text">{{ element.entry.node.text }}</span>
            <span v-if="stagingCount(element.entry.node) > 0" class="staging">◧ {{ stagingCount(element.entry.node) }}</span>
          </template>
          <template v-else-if="element.kind === 'entry' && element.entry.type === 'card' && element.entry.node.type === 'choice'">
            <span class="number">{{ element.entry.number }}</span>
            <span class="speaker">{{ text.choiceOf(decisionName(element.entry.node.decisionId)) }}</span>
            <span
              v-for="option in element.entry.node.options"
              :key="option.id"
              class="option"
              :title="option.condition === null ? undefined : text.optionOfferedOnlyIf(conditionText(option.condition))"
            >› {{ option.text }}<span v-if="option.condition !== null" class="option-condition"> · if {{ conditionText(option.condition) }}</span></span>
          </template>
          <template v-else-if="element.kind === 'entry'">
            <span class="marker-kind">{{ MARKER_SYMBOLS[element.entry.node.type] }}</span>
            {{ element.entry.type === 'marker' ? element.entry.text : '' }}
          </template>

          <template v-else-if="element.isCollapsed">
            <span class="number">{{ element.numbers }}</span>
            <span class="speaker">{{ element.node.type === 'loop' ? text.collapsedLoop : text.collapsedBranches }}</span>
            <span class="text">{{ element.branches[0]?.text }}</span>
            <span class="summary">
              <template v-if="element.node.type === 'condition'">{{ text.routes(routeCount(element)) }} · </template>{{ common.pageCount(element.pageCount) }}
              <span v-if="element.isEndless" class="unreachable-mark">{{ text.neverStops }}</span>
              <span v-if="endingMark(element) !== null" class="ending-mark">{{ endingMark(element) }}</span>
              <span v-if="unreachableMark(element) !== null" class="unreachable-mark">{{ unreachableMark(element) }}</span>
            </span>
          </template>
          <template v-else>
            <span class="block-title">
              {{ element.node.type === 'loop' ? text.loop : `◆ ${element.branches[0]?.text}` }} <span class="block-numbers">{{ element.numbers }}</span>
              <span v-if="element.isEndless" class="unreachable-mark">{{ text.neverStops }}</span>
              <span v-if="endingMark(element) !== null" class="ending-mark">{{ endingMark(element) }}</span>
              <span v-if="unreachableMark(element) !== null" class="unreachable-mark">{{ unreachableMark(element) }}</span>
            </span>
            <span v-for="branch in element.branches" :key="branch.containerId ?? ''" class="route" :style="{ '--branch-color': branchColor(branch.branch) }">
              <span v-if="element.node.type === 'condition'" class="route-name">{{ branch.text }}<template v-if="branch.stops"> ★</template></span>
              <span v-if="branch.elements.length === 0" class="mini empty">{{ text.nothing }}</span>
              <span
                v-for="inner in branch.elements"
                :key="inner.id"
                class="mini"
                :class="[inner.kind === 'block' ? 'nested' : inner.entry.type, { unreachable: inner.isUnreachable }]"
              >
                <template v-if="inner.kind === 'block'">◆ {{ inner.pageCount }}</template>
                <template v-else-if="inner.entry.type === 'card'"><strong>{{ inner.entry.number }}</strong> {{ inner.entry.node.type === 'page' ? inner.entry.node.text : text.choice }}</template>
                <template v-else>{{ MARKER_SYMBOLS[inner.entry.node.type] }} {{ inner.entry.text }}</template>
              </span>
            </span>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 14px;
}

.path-entry {
  padding: 2px 8px;
  border: 1px dashed transparent;
  border-radius: 6px;
  background: none;
  font: inherit;
  color: #9eeaff;
  cursor: pointer;
}

.path-entry.current {
  color: #e6e9ef;
  cursor: default;
}

.path-entry:hover:not(.current) {
  border-color: #9eeaff;
}

.separator {
  color: #7b8597;
}

.lane.titled {
  padding-left: 10px;
  border-left: 3px solid var(--branch-color, #7b8597);
}

.lane-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--branch-color, #a3acbb);
}

.elements {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 12px 10px;
}

.element {
  position: relative;
  box-sizing: border-box;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #11151d;
  cursor: pointer;
  user-select: none;
}

.element.card,
.element.block.collapsed {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 168px;
  height: 112px;
  padding: 8px 10px 8px 12px;
  overflow: hidden;
  border-left: 4px solid var(--branch-color, #2c3442);
}

.element.marker {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: center;
  max-width: 220px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  color: #a3acbb;
  overflow-wrap: anywhere;
}

/* A block as one card: a stack, so that it never passes for a page. */
.element.block.collapsed {
  border-color: #fbbf24;
  box-shadow: 4px 4px 0 -1px #11151d, 4px 4px 0 0 #fbbf24, 8px 8px 0 -1px #11151d, 8px 8px 0 0 rgb(251 191 36 / 0.5);
  margin-right: 8px;
}

.element.block:not(.collapsed) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 520px;
  padding: 8px 10px;
  border: 1px dashed #fbbf24;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: #fbbf24;
}

.block-numbers {
  font-weight: 400;
  color: #7b8597;
}

.route {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  padding-left: 8px;
  border-left: 3px solid var(--branch-color, #7b8597);
}

.route-name {
  font-size: 12px;
  color: var(--branch-color, #a3acbb);
}

.mini {
  max-width: 150px;
  padding: 1px 6px;
  overflow: hidden;
  border-radius: 4px;
  background: #0b0d12;
  font: 12px/1.4 Georgia, serif;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mini.marker,
.mini.nested,
.mini.empty {
  font-family: system-ui, sans-serif;
  color: #7b8597;
}

.summary {
  display: flex;
  flex-direction: column;
  margin-top: auto;
  font-size: 12px;
  color: #fbbf24;
}

.ending-mark,
.unreachable-mark {
  font-weight: 400;
  color: #f9a8d4;
}

.block-title .ending-mark,
.block-title .unreachable-mark {
  margin-left: 6px;
}

.unreachable-mark {
  color: #f28b82;
}

.mini.unreachable {
  opacity: 0.55;
  text-decoration: line-through;
  text-decoration-color: #f28b82;
}

/* Never reached: faded and hatched, so that it reads as a mistake to fix rather than a choice. */
.element.unreachable {
  opacity: 0.55;
  border-style: dashed;
  border-color: #f28b82;
  background-image: repeating-linear-gradient(135deg, transparent 0 8px, rgb(242 139 130 / 0.08) 8px 16px);
}

.empty-lane {
  padding: 10px 14px;
  border-style: dashed;
  font-size: 13px;
  color: #7b8597;
}

.element.focused {
  outline: 2px solid #9eeaff;
  outline-offset: 2px;
}

/* The card being edited, wherever the focus goes meanwhile: marked in its corner, inside it. */
.element.editing::after {
  content: '✎';
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f5c451;
  font-size: 12px;
  color: #11151d;
}

.element.editing {
  border-color: #f5c451;
}

.element.selected {
  background: #0e2a36;
  border-color: #9eeaff;
}

.element.cut {
  opacity: 0.45;
}

.element.drop-before::before,
.element.drop-after::after {
  content: '';
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 3px;
  border-radius: 2px;
  background: #9eeaff;
}

.element.drop-before::before {
  left: -8px;
}

.element.drop-after::after {
  right: -8px;
}

.number {
  font-size: 12px;
  font-weight: 700;
  color: var(--branch-color, #7b8597);
}

.speaker {
  font-size: 13px;
  font-weight: 600;
}

.text {
  display: -webkit-box;
  overflow: hidden;
  font: 13px/1.35 Georgia, serif;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.option-condition {
  color: #7b8597;
}

.option {
  font-size: 12px;
  color: #c7cdd8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.staging {
  position: absolute;
  right: 8px;
  top: 6px;
  font-size: 12px;
  color: #7b8597;
}

.marker-kind {
  color: #9eeaff;
}
</style>
