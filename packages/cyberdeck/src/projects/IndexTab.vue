<script setup lang="ts">
import {
  homeOf,
  indexNames,
  nameWarnings,
  placeDescriber,
  normalizeName,
  storyFlow,
  type IndexedName,
  type NameKind,
} from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, nextTick, onMounted, ref } from 'vue'
import { indexMessages } from '../i18n/indexMessages'
import { useEditor } from './editorContext'
import { describeUse, summariseUses, warningMessage } from './nameUses'
import { storyWords } from '../i18n/storyWords'

/**
 * Every decision, counter and memory of the project with every place it is used, and above them, what looks
 * forgotten across the whole story: a condition that never holds, an ending nobody reaches.
 */
const { project, chapters, scenes, openStoryboard, indexFocus } = useEditor()
const locale = useLocale()
const text = useMessages(indexMessages)

const documents = computed(() => [...chapters.value, ...scenes.value])
const index = computed(() => indexNames(project.value, documents.value))
const warnings = computed(() => nameWarnings(index.value, project.value, storyFlow(chapters.value, scenes.value)))
const placeOf = computed(() => placeDescriber(documents.value, project.value, storyWords[locale.value]))

const filter = ref('')
/** Names shown open; a name the author came for opens on arrival. */
const openKeys = ref(new Set<string>())
const keyOf = (name: { kind: NameKind; id: string }) => `${name.kind}:${name.id}`

const LISTED: { kind: NameKind; title: 'decisions' | 'counters' | 'memories' }[] = [
  { kind: 'decision', title: 'decisions' },
  { kind: 'counter', title: 'counters' },
  { kind: 'memory', title: 'memories' },
]
/** The names the Index lists, each with its places: the others lead to the storyboard. */
const isListed = (kind: NameKind) => LISTED.some(section => section.kind === kind)
/** Decisions and counters are declared somewhere, or made by use. */
const isDeclarable = (kind: NameKind) => kind === 'decision' || kind === 'counter'
const sections = computed(() => {
  const wanted = normalizeName(filter.value)
  return LISTED.map(section => ({
    kind: section.kind,
    title: text.value[section.title],
    names: index.value.filter(name => name.kind === section.kind && (wanted === '' || normalizeName(name.name).includes(wanted))),
  }))
})

function homeText(name: IndexedName): string {
  const home = homeOf(name, project.value)
  switch (home.type) {
    case 'chapter':
      return text.value.declaredIn(placeOf.value(home.documentId, home.nodeId), name.kind)
    case 'definitions':
      return text.value.declaredInDefinitions(name.kind)
    case 'implicit':
      return name.kind === 'counter' ? text.value.madeByAdd : text.value.madeByChoices
  }
}

function valuesOf(name: IndexedName): string[] {
  if (name.kind === 'counter') {
    const counter = project.value.counters.find(candidate => candidate.id === name.id)
    return counter === undefined ? [] : [text.value.startsAt(counter.initial)]
  }
  return name.kind === 'decision' ? project.value.decisions.find(decision => decision.id === name.id)?.values.map(value => value.name) ?? [] : []
}
const isMultiple = (name: IndexedName) => name.kind === 'decision' && project.value.decisions.find(decision => decision.id === name.id)?.multiple === true

function toggle(name: IndexedName) {
  const keys = new Set(openKeys.value)
  if (!keys.delete(keyOf(name))) {
    keys.add(keyOf(name))
  }
  openKeys.value = keys
}

/** Opens a name and brings it into view: from a warning, or from the storyboard's "In this view". */
function show(name: { kind: NameKind; id: string }) {
  if (!isListed(name.kind)) {
    return
  }
  filter.value = ''
  openKeys.value = new Set([...openKeys.value, keyOf(name)])
  void nextTick(() => document.getElementById(`name-${keyOf(name)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

/** Whether a warning's name leads somewhere: a decision, counter or memory here, a scene, an ending or a style to a card of its. */
const leadsSomewhere = (name: IndexedName) => isListed(name.kind) || name.kind === 'scene' || name.uses.some(entry => entry.nodeId !== null)

/** Where a warning about an ending, a style or a scene leads: the place it is reached, used or declared. */
function showWhere(name: IndexedName) {
  if (isListed(name.kind)) {
    show(name)
    return
  }
  const place = name.uses.find(entry => entry.nodeId !== null) ?? null
  if (name.kind === 'scene') {
    openStoryboard(name.id)
  } else if (place !== null && place.nodeId !== null) {
    openStoryboard(place.documentId, place.nodeId)
  }
}

onMounted(() => {
  if (indexFocus.value !== null) {
    show(indexFocus.value)
    indexFocus.value = null
  }
})
</script>

<template>
  <section class="index">
    <h2 class="section-title">{{ text.toLookAt }}</h2>
    <p v-if="warnings.length === 0" class="muted">{{ text.nothingToLookAt }}</p>
    <ul v-else class="warnings">
      <li v-for="warning in warnings" :key="`${warning.code}:${keyOf(warning.name)}:${warning.valueName ?? ''}`" :class="warning.severity">
        <span class="kind">{{ text.kindLabels[warning.name.kind] }}</span>
        <button v-if="leadsSomewhere(warning.name)" class="link-button name" @click="showWhere(warning.name)">{{ warning.name.name }}</button>
        <span v-else class="name">{{ warning.name.name }}</span>
        <span>{{ warningMessage(warning, locale) }}</span>
      </li>
    </ul>

    <label class="field filter">
      <span>{{ text.find }}</span>
      <input v-model="filter" class="text-input" type="search" autocomplete="off" :placeholder="text.findPlaceholder">
    </label>

    <section v-for="section in sections" :key="section.kind" class="names">
      <h2 class="section-title">{{ section.title }} · {{ section.names.length }}</h2>
      <p v-if="section.names.length === 0" class="muted">{{ filter === '' ? text.noneYet(section.kind) : text.noneOfThatName(section.kind) }}</p>
      <article v-for="name in section.names" :id="`name-${keyOf(name)}`" :key="keyOf(name)" class="name-entry" :class="{ open: openKeys.has(keyOf(name)) }">
        <button class="name-header" :aria-expanded="openKeys.has(keyOf(name))" @click="toggle(name)">
          <span class="name-title">{{ name.name }}<span v-if="isMultiple(name)" class="muted">{{ text.several }}</span></span>
          <span class="muted">{{ isDeclarable(name.kind) ? homeText(name) : text.placeCount(name.uses.length) }}</span>
          <span class="summary muted">{{ summariseUses(name, name.uses, project, locale) || text.usedNowhere(name.kind) }}</span>
        </button>
        <div v-if="openKeys.has(keyOf(name))" class="name-body">
          <p v-if="valuesOf(name).length > 0" class="values">
            <span v-for="value in valuesOf(name)" :key="value" class="value">{{ value }}</span>
          </p>
          <ul class="uses">
            <li v-for="(entry, useIndex) in name.uses" :key="useIndex">
              <button class="link-button" @click="entry.nodeId === null ? openStoryboard(entry.documentId) : openStoryboard(entry.documentId, entry.nodeId)">{{ placeOf(entry.documentId, entry.nodeId) }}</button>
              <span class="muted use-role">{{ describeUse(entry, project, name, locale) }}</span>
            </li>
          </ul>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.index {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
  list-style: none;
}

.warnings li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.warnings .warning {
  color: #f6c177;
}

.warnings .notice {
  color: #a3acbb;
}

.kind {
  min-width: 70px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #7b8597;
}

.name {
  font-weight: 600;
  color: #9eeaff;
}

.filter {
  max-width: 420px;
  margin-top: 12px;
}

.names {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-entry {
  border-radius: 8px;
  background: #11151d;
}

.name-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.name-header:hover,
.name-header:focus-visible {
  outline: none;
  background: #18202c;
}

.name-title {
  font-weight: 600;
}

.summary {
  flex-basis: 100%;
  font-size: 14px;
}

.name-body {
  padding: 0 12px 12px;
}

.values {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 8px;
}

.value {
  padding: 1px 10px;
  border: 1px solid #2c3442;
  border-radius: 999px;
  font-size: 13px;
}

.use-role {
  margin-left: 0.4em;
}

.uses {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}
</style>
