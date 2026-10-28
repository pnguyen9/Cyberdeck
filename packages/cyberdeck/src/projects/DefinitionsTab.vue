<script setup lang="ts">
import {
  checkAuthorCss,
  definitionLine,
  definitionsText,
  describeDefinition as describeNameDefinition,
  homeOf,
  indexNames,
  knownNamesFor,
  MAXIMUM_CSS_LENGTH,
  pagesTooLong,
  placeDescriber,
  previewDefinitions,
  type IndexedName,
} from '@cyberdeck/core'
import { createTextboxLayout, useLocale, useMessages } from '@cyberdeck/stage'
import { computed, ref, watch } from 'vue'
import TagTextEditor from '../editing/TagTextEditor.vue'
import { vocabularyOf } from '../editing/tagText'
import { commonMessages } from '../i18n/commonMessages'
import { cssReasonText } from '../i18n/cssReasons'
import { definitionsMessages } from '../i18n/definitionsMessages'
import { importMessages } from '../i18n/importMessages'
import { indexMessages } from '../i18n/indexMessages'
import { problemMessage } from '../importing/problemMessages'
import { useEditor } from './editorContext'
import { storyWords } from '../i18n/storyWords'
import UnsavedQuestion from './UnsavedQuestion.vue'
import { useUnsavedChanges } from './unsavedChanges'

/**
 * The decisions and styles of the project: those of no chapter, edited here as text, and those a
 * chapter declares, or that choices made, listed with where they are.
 */
const { open, project, chapters, scenes, act, openStoryboard, openIndex } = useEditor()
const layout = createTextboxLayout()
const locale = useLocale()
const text = useMessages(definitionsMessages)
const common = useMessages(commonMessages)
const lineLabels = useMessages(importMessages)
const indexText = useMessages(indexMessages)

const documents = computed(() => [...chapters.value, ...scenes.value])
const storedText = computed(() => definitionsText(project.value, documents.value))
/** The text as last stored, which the draft started from: it differs from it once the author types. */
const baseText = ref(storedText.value)
const draft = ref(storedText.value)
const isChanged = computed(() => draft.value !== baseText.value)
// Saved, moved or changed elsewhere: the text follows, unless the author is changing it.
watch(storedText, text => {
  if (!isChanged.value) {
    draft.value = text
  }
  baseText.value = text
})
/** Worked out once for the project as stored, not on every key typed. */
const words = computed(() => storyWords[locale.value])
const knownNames = computed(() => knownNamesFor(project.value, documents.value, undefined, words.value))
const allNames = computed(() => indexNames(project.value, documents.value))
const preview = computed(() => previewDefinitions(draft.value, project.value, documents.value, layout, { baseText: baseText.value, knownNames: knownNames.value, index: allNames.value }))

/** The CSS of the styles, saved apart from the definitions: it is checked as it is typed. */
const cssDraft = ref(project.value.css)
const isCssChanged = computed(() => cssDraft.value !== project.value.css)
const checkedCss = computed(() => checkAuthorCss(cssDraft.value))
/** How much wider the CSS draws each class: what pages depend on, which changes far less often than the CSS typed. */
const cssWidths = computed(() => JSON.stringify([...checkedCss.value.widthScales]))
/** The CSS as pages are measured with: it follows the draft when a class changes size, not at every key. */
const measuredCss = ref(cssDraft.value)
watch(cssWidths, () => {
  measuredCss.value = cssDraft.value
})
/** Pages cut before, which this CSS draws too large for the text box. */
const tooLong = computed(() => pagesTooLong({ ...project.value, css: measuredCss.value }, documents.value, layout))
const isCssTooLong = computed(() => cssDraft.value.length > MAXIMUM_CSS_LENGTH)
const hasChanges = computed(() => isChanged.value || isCssChanged.value)

async function saveCss() {
  if (isCssChanged.value && !isCssTooLong.value) {
    const css = cssDraft.value
    await act(() => open.saveCss(css), checkedCss.value.dropped.length === 0 ? text.value.cssSaved : text.value.cssSavedWithoutDropped)
  }
}
const vocabulary = computed(() => vocabularyOf(project.value, scenes.value))

const index = computed(() => allNames.value.filter(name => name.kind === 'decision' || name.kind === 'style'))
const placeOf = computed(() => placeDescriber(documents.value, project.value, words.value))

/** `Confession: Accept | Refuse`, `Clues (several): Letter | Key`, `Whisper: italic, small`. */
const describeDefinition = (kind: 'decision' | 'style', definedId: string) => describeNameDefinition(kind, definedId, project.value, words.value)

/** Declared in a chapter or scene, at a definition node. */
const local = computed(() => index.value.flatMap(name => {
  const home = homeOf(name, project.value)
  return home.type === 'chapter' ? [{ name, documentId: home.documentId, nodeId: home.nodeId }] : []
}))
/** Declared nowhere: made by the choices that name it, or a style named after a property alone. */
const implicit = computed(() => index.value.filter(name => homeOf(name, project.value).type === 'implicit').map(name => {
  const first = name.uses.find(entry => entry.role !== 'declared')
  return { name, place: first === undefined ? null : { documentId: first.documentId, nodeId: first.nodeId } }
}))

async function removeUnused(name: IndexedName) {
  const kind = name.kind === 'decision' ? 'decision' : 'style'
  await act(() => open.removeUnusedDefinition(kind, name.id), text.value.removedUnused(name.name, kind))
}

async function save() {
  if (preview.value.hasErrors || !isChanged.value) {
    return
  }
  const saved = preview.value
  if (await act(() => open.saveDefinitions(saved), text.value.definitionsSaved)) {
    draft.value = storedText.value
    baseText.value = storedText.value
  }
}

async function moveHere(entry: { name: IndexedName; documentId: string; nodeId: string }) {
  await act(() => open.moveToDefinitions(entry.documentId, entry.nodeId), text.value.movedHere(entry.name.name))
}

/** A name declared nowhere gets its declaration written at the end of the text, to save or change first. */
function declare(name: IndexedName) {
  const line = definitionLine(project.value, name.kind === 'decision' ? 'decision' : 'style', name.id)
  if (line !== null) {
    draft.value = draft.value.trim() === '' ? line : `${draft.value.replace(/\n+$/, '')}\n${line}`
  }
}

/** What waits for the author to save or drop the changes of the text: nothing written is thrown away unasked. */
const pending = ref<{ run: () => void } | null>(null)

function ask(run: () => void) {
  pending.value = { run }
}

async function answerSave() {
  const waiting = pending.value
  await save()
  await saveCss()
  if (!hasChanges.value) {
    pending.value = null
    waiting?.run()
  }
}

function answerDiscard() {
  const waiting = pending.value
  draft.value = baseText.value
  cssDraft.value = project.value.css
  pending.value = null
  waiting?.run()
}

useUnsavedChanges(() => hasChanges.value, ask)
</script>

<template>
  <section class="definitions">
    <p class="muted intro">
      {{ text.intro }}
    </p>

    <h2 class="section-title">{{ text.inDefinitions }}</h2>
    <UnsavedQuestion
      v-if="pending !== null"
      :question="text.unsavedChanges(isChanged, isCssChanged)"
      :can-save="!preview.hasErrors && !isCssTooLong"
      :cannot-save-reason="text.cannotSave"
      @save="answerSave"
      @discard="answerDiscard"
      @keep="pending = null"
    />
    <TagTextEditor
      v-model="draft"
      :vocabulary="vocabulary"
      :layout="layout"
      :label="text.projectDefinitions"
      :placeholder="text.placeholder"
      @submit="save"
      @cancel="isChanged && ask(() => {})"
    />
    <ul v-if="preview.problems.length > 0" class="problems">
      <li v-for="(problem, problemIndex) in preview.problems" :key="problemIndex" :class="problem.severity">
        <strong v-if="problem.line > 0">{{ lineLabels.line(problem.line) }}</strong><template v-if="problem.line > 0"> — </template>{{ problemMessage(problem, locale) }}
      </li>
    </ul>
    <div class="actions">
      <button class="button primary" :disabled="preview.hasErrors || !isChanged" @click="save">{{ common.save }}</button>
      <button class="button" :disabled="!isChanged" @click="draft = baseText">{{ text.undoChanges }}</button>
      <span v-if="isChanged" class="muted">{{ text.notSavedYet }}</span>
    </div>

    <h2 class="section-title">{{ text.cssOfStyles }}</h2>
    <p class="muted">
      {{ text.cssHelpStart }} <code>.ghost</code> {{ text.cssHelpDraws }} <code>[style: ghost]</code>{{ text.cssHelpClass }}
      <code>.whisper</code> {{ text.cssHelpEnd }}
    </p>
    <textarea
      v-model="cssDraft"
      class="text-input css"
      rows="8"
      spellcheck="false"
      :aria-label="text.cssOfStyles"
      :placeholder="'.ghost {\n  color: #8af;\n  text-shadow: 0 0 6px #8af;\n  animation: drift 2s ease-in-out infinite;\n}\n@keyframes drift {\n  50% { opacity: 0.6; }\n}'"
    />
    <p v-if="checkedCss.classes.length > 0" class="muted">{{ text.stylesFromCss(checkedCss.classes.join(', ')) }}</p>
    <ul v-if="checkedCss.dropped.length > 0" class="problems">
      <li v-for="(entry, droppedIndex) in checkedCss.dropped" :key="droppedIndex" class="warning">
        {{ text.leftOut }} <code>{{ entry.text }}</code> — {{ cssReasonText(entry, locale) }}.
      </li>
    </ul>
    <div v-if="tooLong.length > 0" class="problems">
      <p class="warning">
        {{ text.pagesTooLong(tooLong.length) }}
      </p>
      <ul class="pages">
        <li v-for="page in tooLong" :key="page.nodeId">
          <button class="link-button" @click="openStoryboard(page.documentId, page.nodeId)">{{ placeOf(page.documentId, page.nodeId) }}</button>
        </li>
      </ul>
    </div>
    <div class="actions">
      <button class="button primary" :disabled="!isCssChanged || isCssTooLong" @click="saveCss">{{ text.saveCss }}</button>
      <span v-if="isCssTooLong" class="error">{{ text.cssTooLong(MAXIMUM_CSS_LENGTH) }}</span>
      <button class="button" :disabled="!isCssChanged" @click="cssDraft = project.css">{{ text.undoChanges }}</button>
    </div>

    <h2 class="section-title">{{ text.titleCards }}</h2>
    <label class="check">
      <input
        type="checkbox"
        :checked="project.chapterTitleCards"
        @change="act(() => open.setChapterTitleCards(($event.target as HTMLInputElement).checked), ($event.target as HTMLInputElement).checked ? text.titleCardsShown : text.titleCardsHidden)"
      >
      {{ text.showTitleCards }}
    </label>
    <p class="muted">
      {{ text.titleCardsHelpStart }} <code>chapter title</code>{{ text.titleCardsHelpAnd }} <code>ending</code> {{ text.titleCardsHelpEnding }}
      <code>[style: Chapter title = gold, large, fade-in]</code>{{ text.titleCardsHelpClass }}
      <code>.chapter-title</code>, <code>.ending</code>{{ text.titleCardsHelpEnd }}
    </p>

    <h2 class="section-title">{{ text.declaredInChapters }}</h2>
    <p v-if="local.length === 0" class="muted">{{ text.noneInChapters }}</p>
    <ul v-else class="entries">
      <li v-for="entry in local" :key="`${entry.name.kind}:${entry.name.id}`" class="entry">
        <span class="definition">{{ describeDefinition(entry.name.kind === 'decision' ? 'decision' : 'style', entry.name.id) }}</span>
        <span class="muted">{{ placeOf(entry.documentId, entry.nodeId) }}</span>
        <span class="entry-actions">
          <button class="link-button" @click="openStoryboard(entry.documentId, entry.nodeId)">{{ text.show }}</button>
          <button v-if="entry.name.kind === 'decision'" class="link-button" @click="openIndex(entry.name.kind, entry.name.id)">{{ text.uses }}</button>
          <button class="link-button" @click="moveHere(entry)">{{ text.moveToDefinitions }}</button>
        </span>
      </li>
    </ul>

    <h2 class="section-title">{{ text.madeByUse }}</h2>
    <p v-if="implicit.length === 0" class="muted">{{ text.none }}</p>
    <template v-else>
      <p class="muted">{{ text.implicitHelp }}</p>
      <ul class="entries">
        <li v-for="entry in implicit" :key="`${entry.name.kind}:${entry.name.id}`" class="entry">
          <span class="definition">{{ describeDefinition(entry.name.kind === 'decision' ? 'decision' : 'style', entry.name.id) }}</span>
          <span class="muted">{{ entry.place === null ? indexText.usedNowhere(entry.name.kind) : text.firstIn(placeOf(entry.place.documentId, entry.place.nodeId)) }}</span>
          <span class="entry-actions">
            <button v-if="entry.name.kind === 'decision' && entry.place !== null" class="link-button" @click="openIndex(entry.name.kind, entry.name.id)">{{ text.uses }}</button>
            <button v-if="entry.place === null" class="link-button" @click="removeUnused(entry.name)">{{ common.remove }}</button>
            <button v-if="entry.name.kind === 'decision'" class="link-button" @click="declare(entry.name)">{{ text.declareHere }}</button>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.definitions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intro {
  margin: 0;
}

.section-title {
  margin-top: 16px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.problems {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
  list-style: none;
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
}

.css {
  font: 14px/1.5 ui-monospace, monospace;
  resize: vertical;
}

.problems .warning {
  margin: 0;
}

.pages {
  margin: 6px 0 0;
  padding-left: 18px;
}

code {
  font-size: 0.9em;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #11151d;
}

.definition {
  font-family: ui-monospace, monospace;
  font-size: 14px;
}

.entry-actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}
</style>
