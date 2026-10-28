<script setup lang="ts">
import { MARKER_SYMBOLS } from './markerSymbols'
import type { StoredCondition, StoredNode, StoryboardEntry } from '@cyberdeck/core'
import { useMessages } from '@cyberdeck/stage'
import { storyboardMessages } from '../i18n/storyboardMessages'

/**
 * A chapter read top to bottom, each condition opening one column per branch that join again at
 * its end: to check at a glance which scenes play on which path. Entries are those of the
 * storyboard, so that numbers, texts, focus and selection are the same in both views.
 */
const props = defineProps<{
  nodes: readonly StoredNode[]
  entriesById: ReadonlyMap<string, StoryboardEntry>
  focusedId: string | null
  selectedIds: ReadonlySet<string>
  /** The card whose text is open in the panel. */
  editingId: string | null
  unreachableIds: ReadonlySet<string>
  register: (entryId: string, element: unknown) => void
  speakerName: (speakerId: string | null) => string | null
  decisionName: (decisionId: string) => string
  conditionText: (condition: StoredCondition) => string
  branchColor: (branch: string) => string | undefined
}>()
const emit = defineEmits<{ pick: [entryId: string, event: MouseEvent] }>()
const text = useMessages(storyboardMessages)


const entryOf = (entryId: string) => props.entriesById.get(entryId)
const textOf = (entryId: string) => {
  const entry = entryOf(entryId)
  return entry !== undefined && 'text' in entry ? entry.text : ''
}
const numberOf = (entryId: string) => {
  const entry = entryOf(entryId)
  return entry?.type === 'card' ? entry.number : ''
}
const branchEntryId = (nodeId: string, branchIndex: number, branchId: string) => branchIndex === 0 ? nodeId : `${nodeId}/${branchId}`
const stateClasses = (entryId: string) => ({
  focused: entryId === props.focusedId,
  selected: props.selectedIds.has(entryId),
  editing: entryId === props.editingId,
  unreachable: props.unreachableIds.has(entryId),
})
</script>

<template>
  <ol class="sequence">
    <li v-for="node in nodes" :key="node.id">
      <div v-if="node.type === 'loop'" class="condition">
        <section class="branch loop" :style="{ '--branch-color': branchColor(entryOf(node.id)?.branch ?? '') }">
          <header
            :id="`entry-${node.id}`"
            :ref="element => register(node.id, element)"
            class="test"
            :class="stateClasses(node.id)"
            role="option"
            :aria-selected="selectedIds.has(node.id)"
            @click="emit('pick', node.id, $event)"
          >
            {{ text.loopUntilBreak }}
          </header>
          <StoryTree
            v-if="node.nodes.length > 0"
            v-bind="props"
            :nodes="node.nodes"
            @pick="(entryId, event) => emit('pick', entryId, event)"
          />
          <p v-else class="nothing">{{ text.nothing }}</p>
        </section>
        <div
          :id="`entry-${node.id}/end`"
          :ref="element => register(`${node.id}/end`, element)"
          class="join"
          :class="stateClasses(`${node.id}/end`)"
          @click="emit('pick', `${node.id}/end`, $event)"
        >
          {{ text.backToStart }}
        </div>
      </div>
      <div v-else-if="node.type === 'condition'" class="condition">
        <div class="branches">
          <section
            v-for="(branch, branchIndex) in node.branches"
            :key="branch.id"
            class="branch"
            :style="{ '--branch-color': branchColor(entryOf(branchEntryId(node.id, branchIndex, branch.id))?.branch ?? '') }"
          >
            <header
              :id="`entry-${branchEntryId(node.id, branchIndex, branch.id)}`"
              :ref="element => register(branchEntryId(node.id, branchIndex, branch.id), element)"
              class="test"
              :class="stateClasses(branchEntryId(node.id, branchIndex, branch.id))"
              role="option"
              :aria-selected="selectedIds.has(branchEntryId(node.id, branchIndex, branch.id))"
              @click="emit('pick', branchEntryId(node.id, branchIndex, branch.id), $event)"
            >
              <template v-if="branchIndex === 0">◆ if {{ textOf(node.id) }}</template>
              <template v-else>{{ textOf(branchEntryId(node.id, branchIndex, branch.id)) }}</template>
            </header>
            <StoryTree
              v-if="branch.nodes.length > 0"
              v-bind="props"
              :nodes="branch.nodes"
              @pick="(entryId, event) => emit('pick', entryId, event)"
              />
            <p v-else class="nothing">{{ text.nothing }}</p>
          </section>
        </div>
        <div
          :id="`entry-${node.id}/end`"
          :ref="element => register(`${node.id}/end`, element)"
          class="join"
          :class="stateClasses(`${node.id}/end`)"
          @click="emit('pick', `${node.id}/end`, $event)"
        >
          ◆ end
        </div>
      </div>

      <div
        v-else
        :id="`entry-${node.id}`"
        :ref="element => register(node.id, element)"
        class="item"
        :class="[node.type === 'page' || node.type === 'choice' ? 'card' : 'marker', stateClasses(node.id)]"
        :style="{ '--branch-color': branchColor(entryOf(node.id)?.branch ?? '') }"
        role="option"
        :aria-selected="selectedIds.has(node.id)"
        @click="emit('pick', node.id, $event)"
      >
        <template v-if="node.type === 'page'">
          <span class="number">{{ numberOf(node.id) }}</span>
          <span class="line">
            <strong v-if="speakerName(node.speakerId) !== null" class="speaker">{{ speakerName(node.speakerId) }}</strong>{{ node.text }}
          </span>
          <span v-if="node.commandsBefore.length + node.inlineCommands.length > 0" class="staging">◧ {{ node.commandsBefore.length + node.inlineCommands.length }}</span>
        </template>
        <template v-else-if="node.type === 'choice'">
          <span class="number">{{ numberOf(node.id) }}</span>
          <span class="line"><strong class="speaker">{{ text.choiceOf(decisionName(node.decisionId)) }}</strong>{{ node.options.map(option => option.condition === null ? option.text : `${option.text} (if ${conditionText(option.condition)})`).join(' / ') }}</span>
        </template>
        <template v-else>
          <span class="symbol">{{ MARKER_SYMBOLS[node.type] }}</span>
          <span class="line">{{ textOf(node.id) }}</span>
        </template>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.sequence {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.condition {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.branches {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.branch {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
  padding-left: 10px;
  border-left: 3px solid var(--branch-color, #7b8597);
}

.test,
.join {
  align-self: flex-start;
  padding: 3px 10px;
  border: 1px solid var(--branch-color, #7b8597);
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}

.join {
  border-color: #7b8597;
  color: #a3acbb;
}

.item {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 8px;
  box-sizing: border-box;
  max-width: 420px;
  padding: 6px 10px;
  border: 1px solid #2c3442;
  border-left: 3px solid var(--branch-color, #2c3442);
  border-radius: 6px;
  background: #11151d;
  cursor: pointer;
}

.item.marker {
  padding: 2px 10px;
  border-radius: 999px;
  border-left-width: 1px;
  font-size: 13px;
  color: #a3acbb;
}

.number {
  min-width: 2.5em;
  font-size: 12px;
  font-weight: 700;
  color: var(--branch-color, #7b8597);
}

.line {
  overflow: hidden;
  display: -webkit-box;
  font: 14px/1.4 Georgia, serif;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Names as on the grid's cards, apart from the text they speak. */
.speaker {
  margin-right: 0.5em;
  font: 600 13px/1.4 system-ui, sans-serif;
}

.marker .line {
  font: inherit;
}

.staging {
  font-size: 12px;
  color: #7b8597;
  white-space: nowrap;
}

.symbol {
  color: #9eeaff;
}

.nothing {
  margin: 0;
  font-size: 13px;
  font-style: italic;
  color: #7b8597;
}

.focused {
  outline: 2px solid #9eeaff;
  outline-offset: 2px;
}

.item.editing {
  border-color: #f5c451;
  box-shadow: inset 3px 0 0 #f5c451;
}

.item.selected {
  background: #0e2a36;
  border-color: #9eeaff;
}

.unreachable {
  opacity: 0.55;
  border-style: dashed;
  border-color: #f28b82;
}
</style>
