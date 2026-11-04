<script setup lang="ts">
import { valuesReader, type PlayableStory, type PlayerSnapshot } from '@cyberdeck/core'
import { computed } from 'vue'
import { useMessages } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'

/**
 * What the story holds on the page shown, for an author testing it: each decision's values, each
 * counter's number, the names given, what the profile remembers and the endings it has seen. Beside
 * the stage, never over the text.
 */
const props = defineProps<{ story: PlayableStory; snapshot: PlayerSnapshot; memoryIds: readonly string[]; endingIds: readonly string[] }>()
const emit = defineEmits<{ close: [] }>()
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
</script>

<template>
  <aside class="state-panel" :aria-label="text.state" @click.stop @wheel.stop>
    <header class="state-header">
      <h2>{{ text.state }}</h2>
      <button class="close" :aria-label="text.close" @click="emit('close')">×</button>
    </header>
    <section v-if="decisions.length > 0">
      <h3>{{ text.stateDecisions }}</h3>
      <dl>
        <template v-for="entry in decisions" :key="entry.name">
          <dt>{{ entry.name }}</dt>
          <dd :class="{ none: entry.value === '' }">{{ entry.value === '' ? text.stateNone : entry.value }}</dd>
        </template>
      </dl>
    </section>
    <section v-if="counters.length > 0">
      <h3>{{ text.stateCounters }}</h3>
      <dl>
        <template v-for="entry in counters" :key="entry.name">
          <dt>{{ entry.name }}</dt>
          <dd>{{ entry.value }}</dd>
        </template>
      </dl>
    </section>
    <section v-if="names.length > 0">
      <h3>{{ text.stateNames }}</h3>
      <dl>
        <template v-for="entry in names" :key="entry.name">
          <dt>{{ entry.name }}</dt>
          <dd :class="{ none: entry.value === '' }">{{ entry.value === '' ? text.stateNotGiven(entry.defaultName) : entry.value }}</dd>
        </template>
      </dl>
    </section>
    <section>
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

.close {
  border: 0;
  background: none;
  font-size: 30px;
  color: #9eeaff;
  cursor: pointer;
}
</style>
