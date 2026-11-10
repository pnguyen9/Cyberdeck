<script setup lang="ts">
import { readTypedNumber, valuesReader, type Counter, type Decision, type HeldChange, type PlayableStory, type PlayerSnapshot } from '@cyberdeck/core'
import { computed, ref } from 'vue'
import { useMessages } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'

/**
 * What the story holds on the page shown, for an author testing it: each decision's values, each
 * counter's number, the names given, what the profile remembers and the endings it has seen. Beside
 * the stage, never over the text.
 */
const props = defineProps<{ story: PlayableStory; snapshot: PlayerSnapshot; memoryIds: readonly string[]; endingIds: readonly string[]; editable?: boolean }>()
const emit = defineEmits<{ close: []; change: [change: HeldChange] }>()
const text = useMessages(playerMessages)

/** Decisions and counters as `{…}` shows them in the text; names only once the player gave them. */
const readValues = computed(() => valuesReader(props.story.project))
const valueOf = computed(() => readValues.value(props.snapshot))
const decisions = computed(() => props.story.project.decisions.map(decision => ({ name: decision.name, value: valueOf.value(decision.name) ?? '' })))
const counters = computed(() => props.story.project.counters.map(counter => ({ name: counter.name, value: valueOf.value(counter.name) ?? '' })))
const names = computed(() => props.story.project.askedNames.map(asked => ({
  name: asked.name,
  value: Object.hasOwn(props.snapshot.names, asked.id) ? props.snapshot.names[asked.id] ?? '' : '',
  defaultName: asked.defaultName,
})))
const memories = computed(() => props.story.project.memories.filter(memory => props.memoryIds.includes(memory.id)).map(memory => memory.name))
const endings = computed(() => props.story.project.endings.filter(ending => props.endingIds.includes(ending.id)).map(ending => ending.name))

/** What changing a value by hand needs: the decisions, counters and names by identifier, and every memory and ending. */
const decisionRows = computed(() => props.story.project.decisions.map(decision => ({
  decision,
  valueIds: Object.hasOwn(props.snapshot.decisions, decision.id) ? props.snapshot.decisions[decision.id] ?? [] : [],
})))
const counterRows = computed(() => props.story.project.counters.map(counter => ({ counter, shown: valueOf.value(counter.name) ?? '' })))
const allMemories = computed(() => props.story.project.memories.map(memory => ({ memory, isHeld: props.memoryIds.includes(memory.id) })))
const allEndings = computed(() => props.story.project.endings.map(ending => ({ ending, isHeld: props.endingIds.includes(ending.id) })))
/** Counters whose number typed could not be read, until it can. */
const refusedCounters = ref<ReadonlySet<string>>(new Set())

function changeCounter(counter: Counter, typed: string) {
  const read = readTypedNumber(typed, counter, null, null)
  const refused = new Set(refusedCounters.value)
  if ('units' in read) {
    refused.delete(counter.id)
    emit('change', { type: 'counter', counterId: counter.id, units: read.units })
  } else {
    refused.add(counter.id)
  }
  refusedCounters.value = refused
}

function toggleValue(decision: Decision, valueIds: readonly string[], valueId: string, isHeld: boolean) {
  emit('change', { type: 'decision', decisionId: decision.id, valueIds: isHeld ? [...valueIds, valueId] : valueIds.filter(held => held !== valueId) })
}
</script>

<template>
  <aside class="state-panel" :aria-label="text.state" @click.stop @wheel.stop>
    <header class="state-header">
      <h2>{{ text.state }}</h2>
      <button class="close" :aria-label="text.close" @click="emit('close')">×</button>
    </header>
    <p v-if="editable" class="hint">{{ text.stateEditable }}</p>
    <section v-if="decisions.length > 0">
      <h3>{{ text.stateDecisions }}</h3>
      <dl>
        <template v-for="(entry, index) in decisions" :key="entry.name">
          <dt>{{ entry.name }}</dt>
          <dd v-if="editable && decisionRows[index] !== undefined">
            <span v-if="decisionRows[index].decision.multiple" class="choices">
              <label v-for="value in decisionRows[index].decision.values" :key="value.id">
                <input type="checkbox" :checked="decisionRows[index].valueIds.includes(value.id)" @change="toggleValue(decisionRows[index].decision, decisionRows[index].valueIds, value.id, ($event.target as HTMLInputElement).checked)">
                {{ value.name }}
              </label>
            </span>
            <select
              v-else
              class="field"
              :aria-label="entry.name"
              :value="decisionRows[index].valueIds[0] ?? ''"
              @change="emit('change', { type: 'decision', decisionId: decisionRows[index].decision.id, valueIds: ($event.target as HTMLSelectElement).value === '' ? [] : [($event.target as HTMLSelectElement).value] })"
            >
              <option value="">{{ text.stateNone }}</option>
              <option v-for="value in decisionRows[index].decision.values" :key="value.id" :value="value.id">{{ value.name }}</option>
            </select>
          </dd>
          <dd v-else :class="{ none: entry.value === '' }">{{ entry.value === '' ? text.stateNone : entry.value }}</dd>
        </template>
      </dl>
    </section>
    <section v-if="counters.length > 0">
      <h3>{{ text.stateCounters }}</h3>
      <dl>
        <template v-for="row in counterRows" :key="row.counter.id">
          <dt>{{ row.counter.name }}</dt>
          <dd v-if="editable && row.counter.clock === undefined">
            <input
              class="field"
              :class="{ refused: refusedCounters.has(row.counter.id) }"
              :value="row.shown"
              :aria-label="row.counter.name"
              inputmode="decimal"
              @change="changeCounter(row.counter, ($event.target as HTMLInputElement).value)"
            >
          </dd>
          <dd v-else>{{ row.shown }}</dd>
        </template>
      </dl>
    </section>
    <section v-if="names.length > 0">
      <h3>{{ text.stateNames }}</h3>
      <dl>
        <template v-for="(entry, index) in names" :key="entry.name">
          <dt>{{ entry.name }}</dt>
          <dd v-if="editable">
            <input
              class="field"
              :value="entry.value"
              :placeholder="entry.defaultName"
              :aria-label="entry.name"
              @change="emit('change', { type: 'name', askedNameId: story.project.askedNames[index]!.id, name: ($event.target as HTMLInputElement).value })"
            >
          </dd>
          <dd v-else :class="{ none: entry.value === '' }">{{ entry.value === '' ? text.stateNotGiven(entry.defaultName) : entry.value }}</dd>
        </template>
      </dl>
    </section>
    <section v-if="editable">
      <template v-if="allMemories.length > 0">
        <h3>{{ text.stateRemembered }}</h3>
        <label v-for="entry in allMemories" :key="entry.memory.id" class="check">
          <input type="checkbox" :checked="entry.isHeld" @change="emit('change', { type: 'memory', memoryId: entry.memory.id, isHeld: ($event.target as HTMLInputElement).checked })">
          {{ entry.memory.name }}
        </label>
      </template>
      <template v-if="allEndings.length > 0">
        <h3>{{ text.stateEndingsSeen }}</h3>
        <label v-for="entry in allEndings" :key="entry.ending.id" class="check">
          <input type="checkbox" :checked="entry.isHeld" @change="emit('change', { type: 'ending', endingId: entry.ending.id, isHeld: ($event.target as HTMLInputElement).checked })">
          {{ entry.ending.name }}
        </label>
      </template>
    </section>
    <section v-else>
      <h3>{{ text.stateRemembered }}</h3>
      <p :class="{ none: memories.length === 0 }">{{ memories.length === 0 ? text.stateNone : memories.join(', ') }}</p>
      <h3>{{ text.stateEndingsSeen }}</h3>
      <p :class="{ none: endings.length === 0 }">{{ endings.length === 0 ? text.stateNone : endings.join(', ') }}</p>
    </section>
  </aside>
</template>

<style scoped>
.state-panel {
  position: absolute;
  top: 24px;
  right: 24px;
  bottom: 360px;
  width: 400px;
  overflow-y: auto;
  padding: 20px 26px;
  border: 1px solid rgb(120 220 255 / 0.35);
  border-radius: 12px;
  background: rgb(5 7 12 / 0.92);
  font: 22px/1.35 system-ui, sans-serif;
  color: #e6e9ef;
  cursor: default;
}

.state-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

h2 {
  margin: 0;
  font: 600 28px/1.2 system-ui, sans-serif;
  color: #9eeaff;
}

h3 {
  margin: 18px 0 6px;
  font: 600 18px/1.2 system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a3acbb;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 0;
}

dt {
  font-weight: 600;
}

dd,
p {
  margin: 0;
}

.none {
  color: #6b7383;
}

.hint {
  margin-top: 8px;
  font-size: 16px;
  color: #a3acbb;
}

.field {
  width: 100%;
  box-sizing: border-box;
  padding: 2px 8px;
  border: 1px solid rgb(120 220 255 / 0.35);
  border-radius: 6px;
  background: #0b0d12;
  font: inherit;
  color: inherit;
}

.field.refused {
  border-color: #ff8a7a;
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
}

.check {
  display: block;
}

.check input,
.choices input {
  width: 20px;
  height: 20px;
  vertical-align: -3px;
}

.close {
  border: 0;
  background: none;
  font-size: 30px;
  color: #9eeaff;
  cursor: pointer;
}
</style>
