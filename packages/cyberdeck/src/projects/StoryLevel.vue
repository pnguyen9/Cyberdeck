<script setup lang="ts">
import {
  definitionsOf,
  describeCondition,
  flattenStoredNodes,
  normalizeName,
  playsOf,
  previewChapterCondition,
  type ChapterDocument,
  languageName as languageName_,
  languagesOf,
} from '@cyberdeck/core'
import { createTextboxLayout, useLocale, useMessages } from '@cyberdeck/stage'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { storyLevelMessages } from '../i18n/storyLevelMessages'
import { commonMessages } from '../i18n/commonMessages'
import { problemMessage } from '../importing/problemMessages'
import { actionFor, firstKeysOf, type ShortcutId } from '../shortcuts/shortcuts'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { useEditorSettings } from '../settings/editorSettings'
import { useEditor } from './editorContext'
import { safeFileName, usePreparedDownload } from './preparedDownload'

/**
 * The story as the storyboard's first level: each chapter a card, in playing order; chapters following
 * one another under one condition gathered in a route, the condition written once; scenes apart, as
 * what chapters call. Enter opens a chapter, and chapters move as cards do.
 */
const emit = defineEmits<{ open: [documentId: string]; import: [] }>()
const { open, project, chapters, scenes, documents, language, act, preview, startEmptyDocument } = useEditor()
/** The language shown, by its name in the editor's language. */
const languageName = computed(() => languageName_(language.value, locale.value) ?? language.value)
/** Every language of the story, named, when there are several: removing a chapter removes it in all of them. */
const everyLanguage = computed(() => languagesOf(project.value).length > 1 ? languagesOf(project.value).map(code => languageName_(code, locale.value) ?? code).join(', ') : null)
const locale = useLocale()
const text = useMessages(storyLevelMessages)
const common = useMessages(commonMessages)
const { shortcuts } = useShortcuts()
const layout = createTextboxLayout()
const settings = useEditorSettings()
const keysOf = (actionId: ShortcutId) => firstKeysOf(shortcuts.value, actionId, locale.value)

const titleOf = (document: ChapterDocument) => document.title ?? common.value.untitledChapter
/** How many pages and endings each chapter and scene holds, counted once per change. */
const countsById = computed(() => new Map(documents.value.map(document => {
  const nodes = flattenStoredNodes(document.nodes)
  return [document.id, { pages: nodes.filter(node => node.type === 'page').length, endings: nodes.filter(node => node.type === 'ending').length }]
})))
const pageCountOf = (document: ChapterDocument) => countsById.value.get(document.id)?.pages ?? 0
const endingCountOf = (document: ChapterDocument) => countsById.value.get(document.id)?.endings ?? 0
const conditionKey = (document: ChapterDocument) => document.condition === undefined ? null : JSON.stringify(document.condition)

/** Chapters in order, those following one another under the same condition gathered in a route. */
const routes = computed(() => {
  const groups: { key: string | null; condition: string | null; chapters: { chapter: ChapterDocument; index: number }[] }[] = []
  chapters.value.forEach((chapter, index) => {
    const key = conditionKey(chapter)
    const last = groups.at(-1)
    if (last !== undefined && key !== null && last.key === key) {
      last.chapters.push({ chapter, index })
    } else {
      groups.push({ key, condition: chapter.condition === undefined ? null : describeCondition(chapter.condition, project.value), chapters: [{ chapter, index }] })
    }
  })
  return groups
})
const sceneRows = computed(() => scenes.value.map(scene => ({ scene, playedBy: playsOf(documents.value, scene.id).map(titleOf) })))

/** Every card in reading order: the chapters, then the scenes. */
const stops = computed(() => documents.value.map(document => document.id))
const focusedId = ref<string | null>(null)
const focused = computed(() => documents.value.find(document => document.id === focusedId.value) ?? null)
const isScene = computed(() => focused.value !== null && scenes.value.some(scene => scene.id === focused.value?.id))
const focusedIndex = computed(() => chapters.value.findIndex(chapter => chapter.id === focusedId.value))
/** The route the focused chapter belongs to, when it plays under a condition. */
const focusedRoute = computed(() => routes.value.find(route => route.key !== null && route.chapters.some(entry => entry.chapter.id === focusedId.value)) ?? null)

const board = useTemplateRef<HTMLElement>('board')
defineExpose({ focus: () => board.value?.focus() })
onMounted(() => {
  focusedId.value ??= stops.value[0] ?? null
  board.value?.focus()
})
watch(stops, ids => {
  if (focusedId.value === null || !ids.includes(focusedId.value)) {
    focusedId.value = ids[0] ?? null
  }
})

const cutId = ref<string | null>(null)
const renaming = ref<{ id: string; title: string } | null>(null)
const removingId = ref<string | null>(null)
const textDownload = usePreparedDownload()
const textChapterId = ref<string | null>(null)

/** Scenes are played by name in texts: two of the same name could not be told apart. */
const renameProblem = computed(() => {
  const target = renaming.value
  if (target === null || !scenes.value.some(scene => scene.id === target.id)) {
    return null
  }
  if (target.title.trim() === '') {
    return text.value.sceneNeedsName
  }
  return scenes.value.some(scene => scene.id !== target.id && normalizeName(scene.title ?? '') === normalizeName(target.title)) ? text.value.sceneNameTaken : null
})

async function confirmRename() {
  const target = renaming.value
  if (target !== null && renameProblem.value === null && await act(() => open.renameChapter(target.id, target.title))) {
    renaming.value = null
    board.value?.focus()
  }
}

const movedDefinitions = (document: ChapterDocument) => definitionsOf(document, project.value)
/** What removing the focused card would change: the definitions it moves, and the plays of a scene left playing nothing. */
const focusedMovedDefinitions = computed(() => focused.value === null ? [] : movedDefinitions(focused.value))
const focusedPlayers = computed(() => sceneRows.value.find(row => row.scene.id === focused.value?.id)?.playedBy ?? [])

async function confirmRemove(document: ChapterDocument) {
  if (await act(() => open.removeChapter(document.id), text.value.removed(titleOf(document), movedDefinitions(document), keysOf('undo')))) {
    removingId.value = null
    board.value?.focus()
  }
}

function exportText(document: ChapterDocument) {
  textChapterId.value = document.id
  textDownload.offer(`${safeFileName(titleOf(document), locale.value)}.txt`, open.exportText([document.id], settings.value.paragraphsAsWritten ? layout : null))
}

/** The condition written for the focused chapter, or its route, checked as it is typed. */
const conditionDraft = ref('')
watch(focused, document => {
  conditionDraft.value = document?.condition === undefined ? '' : describeCondition(document.condition, project.value)
  renaming.value = null
  removingId.value = null
}, { immediate: true })
const conditionPreview = computed(() => previewChapterCondition(conditionDraft.value, project.value, layout, documents.value))

async function applyCondition(chapterIds: readonly string[]) {
  const { condition, problems } = conditionPreview.value
  if (problems.length > 0) {
    return
  }
  await act(() => open.setChapterConditions(chapterIds, condition), condition === undefined ? text.value.alwaysPlayedNow(chapterIds.length) : text.value.conditionApplied(chapterIds.length))
}

async function moveTo(chapterId: string, toIndex: number) {
  if (toIndex >= 0 && toIndex < chapters.value.length) {
    await act(() => open.moveChapter(chapterId, toIndex))
  }
}

/** A new chapter right after the one focused, or at the end. */
function addChapterAfterFocus() {
  startEmptyDocument('chapter', focusedIndex.value === -1 ? undefined : focusedIndex.value + 1)
}

function onKeydown(event: KeyboardEvent) {
  if (event.target !== board.value) {
    return
  }
  const action = actionFor(shortcuts.value, event, 'Storyboard')
  const index = stops.value.indexOf(focusedId.value ?? '')
  const moves: Partial<Record<ShortcutId, number>> = { focusPrevious: -1, focusAbove: -1, focusNext: 1, focusBelow: 1 }
  if (action === null) {
    return
  }
  const step = moves[action]
  if (step !== undefined || action === 'focusFirst' || action === 'focusLast') {
    event.preventDefault()
    const target = action === 'focusFirst' ? 0 : action === 'focusLast' ? stops.value.length - 1 : Math.min(stops.value.length - 1, Math.max(0, index + (step ?? 0)))
    focusedId.value = stops.value[target] ?? focusedId.value
    void nextTick(() => document.getElementById(`story-${focusedId.value}`)?.scrollIntoView({ block: 'nearest' }))
    return
  }
  const chapterId = focusedIndex.value === -1 ? null : focusedId.value
  switch (action) {
    case 'edit':
      event.preventDefault()
      if (focusedId.value !== null) {
        emit('open', focusedId.value)
      }
      return
    case 'moveSelectionBack':
    case 'moveSelectionUp':
    case 'moveSelectionForward':
    case 'moveSelectionDown':
      event.preventDefault()
      if (chapterId !== null) {
        void moveTo(chapterId, focusedIndex.value + (action === 'moveSelectionBack' || action === 'moveSelectionUp' ? -1 : 1))
      }
      return
    case 'cut':
      event.preventDefault()
      cutId.value = chapterId
      return
    case 'paste': {
      event.preventDefault()
      const cut = cutId.value
      const from = chapters.value.findIndex(chapter => chapter.id === cut)
      if (cut !== null && from !== -1 && focusedIndex.value !== -1) {
        cutId.value = null
        void moveTo(cut, from < focusedIndex.value ? focusedIndex.value : focusedIndex.value + 1)
      }
      return
    }
    case 'remove':
      event.preventDefault()
      removingId.value = focusedId.value
      return
    case 'addPage':
      event.preventDefault()
      void addChapterAfterFocus()
      return
    case 'undo':
      event.preventDefault()
      if (open.canUndo) {
        void act(() => open.undo(), () => open.canUndo ? common.value.undone : common.value.undoneLast)
      }
      return
    case 'previewFromHere':
      event.preventDefault()
      if (chapterId !== null) {
        preview(chapterId)
      }
      return
    case 'leave':
      cutId.value = null
      removingId.value = null
      return
  }
}
</script>

<template>
  <div class="story-level">
    <div
      ref="board"
      class="story-board"
      tabindex="0"
      role="listbox"
      :aria-label="text.story"
      :aria-activedescendant="focusedId === null ? undefined : `story-${focusedId}`"
      @keydown="onKeydown"
    >
      <p class="muted keys">{{ text.storyKeys(keysOf('edit'), keysOf('moveSelectionForward'), keysOf('cut'), keysOf('paste'), keysOf('addPage')) }}</p>
      <p v-if="chapters.length === 0" class="muted">
        {{ text.noChaptersBefore }} <button class="link-button" @click="emit('import')">{{ text.importText }}</button> {{ text.noChaptersAfter }}
        {{ text.orStartWithout }} <button class="link-button" @click="addChapterAfterFocus">{{ text.newChapter }}</button>.
      </p>
      <div class="routes">
        <section v-for="(route, routeIndex) in routes" :key="route.chapters[0]?.chapter.id ?? routeIndex" class="route" :class="{ conditional: route.key !== null }">
          <p v-if="route.condition !== null" class="route-heading">{{ text.playedOnlyIf(route.condition) }}</p>
          <div class="cards">
            <button
              v-for="entry in route.chapters"
              :id="`story-${entry.chapter.id}`"
              :key="entry.chapter.id"
              class="card chapter"
              :class="{ focused: focusedId === entry.chapter.id, cut: cutId === entry.chapter.id, hollow: entry.chapter.hollow === true }"
              role="option"
              tabindex="-1"
              :aria-selected="focusedId === entry.chapter.id"
              @click="focusedId = entry.chapter.id; board?.focus()"
              @dblclick="emit('open', entry.chapter.id)"
            >
              <span class="number">{{ entry.index + 1 }}</span>
              <span class="title">{{ titleOf(entry.chapter) }}</span>
              <span v-if="entry.chapter.hollow === true" class="muted">{{ text.notWrittenIn(languageName) }}</span>
              <span v-else class="muted">{{ common.pageCount(pageCountOf(entry.chapter)) }}<template v-if="endingCountOf(entry.chapter) > 0"> · ★ {{ endingCountOf(entry.chapter) }}</template></span>
            </button>
          </div>
        </section>
      </div>
      <template v-if="sceneRows.length > 0">
        <h3 class="scenes-heading">{{ text.scenes }}</h3>
        <p class="muted">{{ text.scenesIntroBefore }} <code>[play: …]</code> {{ text.scenesIntroAfter }}</p>
        <div class="cards">
          <button
            v-for="row in sceneRows"
            :id="`story-${row.scene.id}`"
            :key="row.scene.id"
            class="card chapter scene"
            :class="{ focused: focusedId === row.scene.id, hollow: row.scene.hollow === true }"
            role="option"
            tabindex="-1"
            :aria-selected="focusedId === row.scene.id"
            @click="focusedId = row.scene.id; board?.focus()"
            @dblclick="emit('open', row.scene.id)"
          >
            <span class="number">▷</span>
            <span class="title">{{ row.scene.title }}</span>
            <span v-if="row.scene.hollow === true" class="muted">{{ text.notWrittenIn(languageName) }}</span>
            <span v-else class="muted">{{ row.playedBy.length === 0 ? text.playedNowhere : text.playedBy(row.playedBy.join(', ')) }}</span>
          </button>
        </div>
      </template>
      <div class="add-actions">
        <button class="button small" @click="addChapterAfterFocus">{{ text.newChapter }} <kbd>{{ keysOf('addPage') }}</kbd></button>
        <button class="button small" @click="startEmptyDocument('scene')">{{ text.newScene }}</button>
      </div>
    </div>

    <aside v-if="focused !== null" class="inspector">
      <form v-if="renaming?.id === focused.id" class="rename" @submit.prevent="confirmRename">
        <input v-model="renaming.title" class="text-input" :aria-label="isScene ? text.sceneName : text.chapterTitle" autocomplete="off">
        <button class="button primary small" type="submit" :disabled="renameProblem !== null">{{ common.rename }}</button>
        <button class="button small" type="button" @click="renaming = null">{{ common.cancel }}</button>
        <span v-if="renameProblem !== null" class="error">{{ renameProblem }}</span>
      </form>
      <h3 v-else>{{ isScene ? focused.title : titleOf(focused) }}</h3>
      <p v-if="focused.hollow === true" class="muted">{{ text.hollowHelp(languageName) }}</p>
      <p v-else class="muted">
        {{ common.pageCount(pageCountOf(focused)) }} ·
        {{ focused.importedFrom === undefined ? text.writtenHere : text.importedFrom(focused.importedFrom.fileName, new Date(focused.importedFrom.importedAt).toLocaleDateString(locale, { dateStyle: 'medium' })) }}
      </p>

      <div v-if="removingId === focused.id" class="confirmation">
        <p>
          {{ isScene ? text.confirmRemoveScene(focused.title ?? '', everyLanguage) : text.confirmRemoveChapter(titleOf(focused), everyLanguage) }}
          <template v-if="focused.importedFrom !== undefined">{{ text.importedTextKept }}</template>
        </p>
        <p v-if="isScene && focusedPlayers.length > 0" class="warning">{{ text.scenePlayedBy(focusedPlayers.join(', '), focusedPlayers.length) }}</p>
        <p v-if="focusedMovedDefinitions.length > 0" class="muted">{{ text.declarationsMove(focusedMovedDefinitions.join(', ')) }}</p>
        <div class="actions">
          <button class="button danger small" @click="confirmRemove(focused)">{{ common.remove }}</button>
          <button class="button small" @click="removingId = null; board?.focus()">{{ common.cancel }}</button>
        </div>
      </div>
      <div v-else class="actions">
        <button class="button small primary" @click="emit('open', focused.id)">{{ text.open }} <kbd>{{ keysOf('edit') }}</kbd></button>
        <button v-if="!isScene" class="button small" @click="preview(focused.id)">{{ text.previewFromHere }}</button>
        <button class="button small" @click="exportText(focused)">{{ text.exportAsText }}</button>
        <button class="button small" @click="renaming = { id: focused.id, title: focused.title ?? '' }">{{ common.rename }}</button>
        <button class="button small" @click="removingId = focused.id">{{ common.remove }} <kbd>{{ keysOf('remove') }}</kbd></button>
      </div>
      <p v-if="textChapterId === focused.id && textDownload.prepared.value !== null" class="text-download">
        <a class="download" :href="textDownload.prepared.value.url" :download="textDownload.prepared.value.fileName">{{ common.download(textDownload.prepared.value.fileName) }}</a>
        <span class="muted"> {{ isScene ? text.sceneTextHelp : text.chapterTextHelp }}</span>
      </p>

      <form v-if="!isScene" class="condition" @submit.prevent="applyCondition([focused.id])">
        <label class="field">
          <span>{{ text.conditionLabel }}</span>
          <input v-model="conditionDraft" class="text-input" autocomplete="off" :placeholder="text.conditionPlaceholder">
        </label>
        <p class="muted">{{ text.conditionHelp }}</p>
        <ul v-if="conditionPreview.problems.length > 0" class="problems">
          <li v-for="(problem, problemIndex) in conditionPreview.problems" :key="problemIndex" class="error">{{ problemMessage(problem, locale) }}</li>
        </ul>
        <div class="actions">
          <button class="button small" type="submit" :disabled="conditionPreview.problems.length > 0">{{ text.applyToChapter }}</button>
          <button
            v-if="focusedRoute !== null && focusedRoute.chapters.length > 1"
            class="button small"
            type="button"
            :disabled="conditionPreview.problems.length > 0"
            @click="applyCondition(focusedRoute.chapters.map(entry => entry.chapter.id))"
          >
            {{ text.applyToRoute(focusedRoute.chapters.length) }}
          </button>
        </div>
      </form>
    </aside>
  </div>
</template>

<style scoped>
.story-level {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 900px) {
  .story-level {
    grid-template-columns: 1fr;
  }
}

.story-board {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  outline: none;
}

.story-board:focus-visible {
  box-shadow: 0 0 0 2px rgb(158 234 255 / 0.4);
}

.keys {
  margin: 0;
  font-size: 13px;
}

.routes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.route {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.route.conditional {
  padding: 8px 10px 10px;
  border: 1px solid #c4b5fd66;
  border-radius: 10px;
  background: rgb(196 181 253 / 0.05);
}

.route-heading {
  margin: 0;
  font-size: 13px;
  color: #c4b5fd;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 180px;
  min-height: 90px;
  padding: 10px 12px;
  border: 1px solid #2c3442;
  border-radius: 8px;
  background: #11151d;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.card.focused {
  border-color: #9eeaff;
  box-shadow: 0 0 0 1px #9eeaff;
}

/* A chapter not written in the language shown: there, but hollow. */
.card.hollow {
  border-style: dotted;
  background: none;
}

.card.hollow .title {
  font-style: italic;
  color: #a3acbb;
}

.card.cut {
  opacity: 0.5;
  border-style: dashed;
}

.card .number {
  font-size: 12px;
  color: #7b8597;
}

.card .title {
  font-weight: 600;
}

.scenes-heading {
  margin: 12px 0 0;
}

.add-actions,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inspector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #11151d;
}

.inspector h3 {
  margin: 0;
}

.inspector p {
  margin: 0;
}

.condition {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid #2c3442;
}

.problems {
  margin: 0;
  padding-left: 18px;
}

.rename {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
