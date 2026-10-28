<script setup lang="ts">
import type { PageLayout } from '@cyberdeck/core'
import { useLocale, useMessages } from '@cyberdeck/stage'
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { tagTextMessages, type TagTextMessages } from '../i18n/tagTextMessages'
import { useShortcuts } from '../shortcuts/shortcutStore'
import { actionFor } from '../shortcuts/shortcuts'
import { completionAt, tagEndingAt, tagKind, tagProblem, tagsIn, tagStartingAt, type Completion, type TagVocabulary } from './tagText'

/**
 * Text where tags are drawn as chips, like names tagged in a post. The text field keeps the text,
 * the caret, selection, undo and pasting; a layer behind it, laid out identically, draws the text
 * with each `[…]` as a chip. Chips are removed whole by Backspace and Delete, the arrows step over
 * them, and clicking into one edits it. Typing `[` suggests what may follow.
 */
const props = defineProps<{ vocabulary: TagVocabulary; layout: PageLayout; label: string; placeholder?: string }>()
const text = defineModel<string>({ required: true })
const emit = defineEmits<{ submit: []; cancel: [] }>()
const { shortcuts } = useShortcuts()
const locale = useLocale()
const messages = useMessages(tagTextMessages)

/** Templates to insert, by group; a `|` marks where the caret goes, at the end otherwise. */
const TAG_TEMPLATES: { id: keyof TagTextMessages['templates']; text: string; group: keyof TagTextMessages['templateGroups'] }[] = [
  { id: 'background', text: '[bg: ', group: 'stage' },
  { id: 'transition', text: '[transition: fade]', group: 'stage' },
  { id: 'music', text: '[music: ', group: 'stage' },
  { id: 'sound', text: '[sound: ', group: 'stage' },
  { id: 'voice', text: '[voice: ', group: 'stage' },
  { id: 'video', text: '[video: ', group: 'stage' },
  { id: 'illustration', text: '[illustration: ', group: 'stage' },
  { id: 'shake', text: '[shake]', group: 'screen' },
  { id: 'flash', text: '[flash]', group: 'screen' },
  { id: 'fadeOut', text: '[fade out: 1s]', group: 'screen' },
  { id: 'fadeIn', text: '[fade in: 1s]', group: 'screen' },
  { id: 'tint', text: '[tint: ', group: 'screen' },
  { id: 'style', text: '[style: ', group: 'screen' },
  { id: 'fullScreenText', text: '[text: full]', group: 'screen' },
  { id: 'boxText', text: '[text: box]', group: 'screen' },
  { id: 'clear', text: '[clear]', group: 'screen' },
  { id: 'enter', text: '[enter: ', group: 'characters' },
  { id: 'exit', text: '[exit: ', group: 'characters' },
  { id: 'move', text: '[move: ', group: 'characters' },
  { id: 'expression', text: '[', group: 'characters' },
  { id: 'pause', text: '[wait: 1]', group: 'characters' },
  { id: 'choice', text: '[choice: |]\n> \n> ', group: 'story' },
  { id: 'ifEnd', text: '[if: |]\n\n[end]', group: 'story' },
  { id: 'elseIf', text: '[else if: |]', group: 'story' },
  { id: 'else', text: '[else]', group: 'story' },
  { id: 'decision', text: '[decision: | = ]', group: 'story' },
  { id: 'set', text: '[set: ', group: 'story' },
  { id: 'unset', text: '[unset: ', group: 'story' },
  { id: 'counter', text: '[counter: | = 0]', group: 'story' },
  { id: 'add', text: '[add: ', group: 'story' },
  { id: 'loopEnd', text: '[loop]\n|\n[end]', group: 'story' },
  { id: 'break', text: '[break]', group: 'story' },
  { id: 'play', text: '[play: ', group: 'story' },
  { id: 'onlyIf', text: '[only if: |]', group: 'story' },
  { id: 'remember', text: '[remember: ', group: 'story' },
  { id: 'ending', text: '[ending: ', group: 'story' },
]
const TEMPLATE_GROUPS = ['stage', 'screen', 'characters', 'story'] as const

const field = useTemplateRef<HTMLTextAreaElement>('field')
const mirror = useTemplateRef<HTMLDivElement>('mirror')
const caretMarker = useTemplateRef<HTMLSpanElement>('caretMarker')
const caret = ref(0)
const hasFocus = ref(false)
const completion = ref<Completion | null>(null)
const chosenIndex = ref(0)
const completionPosition = ref({ left: 0, top: 0 })
const isMenuOpen = ref(false)
/** Problems of tags, kept by content so that the import runs once per distinct tag; each vocabulary has its own. */
const problemCache = computed(() => ({ vocabulary: props.vocabulary, locale: locale.value, problems: new Map<string, string | null>() }))

const problemOf = (content: string) => {
  const { vocabulary, locale: problemLocale, problems } = problemCache.value
  if (!problems.has(content)) {
    problems.set(content, tagProblem(content, vocabulary, props.layout, problemLocale))
  }
  return problems.get(content) ?? null
}

type Piece =
  | { type: 'text'; text: string }
  | { type: 'caret' }
  | { type: 'chip'; before: string; after: string; hasCaret: boolean; kind: string; problem: string | null }

/** The text cut into plain pieces and chips, with a marker where the caret is, for placing suggestions. */
const pieces = computed((): Piece[] => {
  const result: Piece[] = []
  const value = text.value
  const pushText = (from: number, to: number) => {
    if (caret.value >= from && caret.value <= to && hasFocus.value) {
      result.push({ type: 'text', text: value.slice(from, caret.value) }, { type: 'caret' }, { type: 'text', text: value.slice(caret.value, to) })
    } else {
      result.push({ type: 'text', text: value.slice(from, to) })
    }
  }
  let position = 0
  for (const tag of tagsIn(value)) {
    pushText(position, tag.start)
    const caretInside = hasFocus.value && caret.value > tag.start && caret.value < tag.end
    const split = caretInside ? caret.value - tag.start : tag.end - tag.start
    result.push({
      type: 'chip',
      before: value.slice(tag.start, tag.start + split),
      after: value.slice(tag.start + split, tag.end),
      hasCaret: caretInside,
      kind: tagKind(tag.content),
      problem: problemOf(tag.content),
    })
    position = tag.end
  }
  pushText(position, value.length)
  // A final line break needs something after it to take a line in the layer.
  result.push({ type: 'text', text: '​' })
  return result
})

/** The problem of the tag the caret is in or next to, said under the text. */
const caretProblem = computed(() => {
  if (!hasFocus.value) {
    return null
  }
  const tag = tagsIn(text.value).find(candidate => caret.value >= candidate.start && caret.value <= candidate.end)
  return tag === undefined ? null : problemOf(tag.content)
})

function onInput(event: Event) {
  text.value = (event.target as HTMLTextAreaElement).value
  void refreshCaret()
}

/** Where the selection ended at the last refresh, with `caret` where it started. */
let selectionEnd = 0

/** Keys that only move through the suggestions or close them leave the caret in place: they change nothing. */
function onKeyup() {
  const element = field.value
  if (element !== null && (element.selectionStart !== caret.value || element.selectionEnd !== selectionEnd)) {
    void refreshCaret()
  }
}

async function refreshCaret() {
  const element = field.value
  if (element === null) {
    return
  }
  // The field holds the text as typed; the model catches up only once the parent has re-rendered.
  caret.value = element.selectionStart
  selectionEnd = element.selectionEnd
  completion.value = element.selectionStart === element.selectionEnd ? completionAt(element.value, caret.value, props.vocabulary, locale.value) : null
  chosenIndex.value = 0
  await nextTick()
  syncScroll()
  const marker = caretMarker.value
  if (marker !== null) {
    completionPosition.value = { left: marker.offsetLeft, top: marker.offsetTop + marker.offsetHeight - element.scrollTop + 4 }
  }
}

function syncScroll() {
  if (mirror.value !== null && field.value !== null) {
    mirror.value.scrollTop = field.value.scrollTop
  }
}

/** Replaces a range through the browser's editing, so that Ctrl+Z undoes it like typing. */
function replaceRange(from: number, to: number, replacement: string) {
  const element = field.value
  if (element === null) {
    return
  }
  element.focus()
  element.setSelectionRange(from, to)
  const isReplaced = replacement === '' ? document.execCommand('delete') : document.execCommand('insertText', false, replacement)
  if (!isReplaced) {
    element.setRangeText(replacement, from, to, 'end')
    element.dispatchEvent(new Event('input'))
  }
  void refreshCaret()
}

function accept(index: number) {
  const current = completion.value
  const item = current?.items[index]
  if (current === null || item === undefined) {
    return
  }
  const insert = item.insert.endsWith(']') && field.value?.value[caret.value] === ']' ? item.insert.slice(0, -1) : item.insert
  replaceRange(current.from, caret.value, insert)
}

function insertTemplate(template: string) {
  isMenuOpen.value = false
  const element = field.value
  if (element === null) {
    return
  }
  const from = element.selectionStart
  const caretIndex = template.indexOf('|')
  replaceRange(from, element.selectionEnd, template.replace('|', ''))
  if (caretIndex !== -1) {
    element.setSelectionRange(from + caretIndex, from + caretIndex)
    void refreshCaret()
  }
}

function onKeydown(event: KeyboardEvent) {
  const element = event.target as HTMLTextAreaElement
  const current = completion.value
  if (current !== null) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      chosenIndex.value = (chosenIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + current.items.length) % current.items.length
      return
    }
    if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') {
      event.preventDefault()
      accept(chosenIndex.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      completion.value = null
      return
    }
  }
  const action = actionFor(shortcuts.value, event, 'Editing a page')
  if (action === 'save' || action === 'cancel') {
    event.preventDefault()
    if (action === 'save') {
      emit('submit')
    } else {
      emit('cancel')
    }
    return
  }

  const start = element.selectionStart
  const isCollapsed = start === element.selectionEnd
  const before = tagEndingAt(element.value, start)
  const after = tagStartingAt(element.value, start)
  if (isCollapsed && event.key === 'Backspace' && before !== null) {
    event.preventDefault()
    replaceRange(before.start, before.end, '')
  } else if (isCollapsed && event.key === 'Delete' && after !== null) {
    event.preventDefault()
    replaceRange(after.start, after.end, '')
  } else if (isCollapsed && !event.shiftKey && !event.altKey && event.key === 'ArrowLeft' && before !== null) {
    event.preventDefault()
    element.setSelectionRange(before.start, before.start)
    void refreshCaret()
  } else if (isCollapsed && !event.shiftKey && !event.altKey && event.key === 'ArrowRight' && after !== null) {
    event.preventDefault()
    element.setSelectionRange(after.end, after.end)
    void refreshCaret()
  }
}

function onFocus() {
  hasFocus.value = true
  void refreshCaret()
}

function onBlur() {
  hasFocus.value = false
  completion.value = null
}

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <div class="tag-editor">
    <div class="toolbar">
      <div class="insert">
        <button class="button small" type="button" :aria-expanded="isMenuOpen" @click="isMenuOpen = !isMenuOpen">{{ messages.insertTag }}</button>
        <div v-if="isMenuOpen" class="menu" role="menu">
          <template v-for="group in TEMPLATE_GROUPS" :key="group">
            <p class="menu-group">{{ messages.templateGroups[group] }}</p>
            <button
              v-for="template in TAG_TEMPLATES.filter(candidate => candidate.group === group)"
              :key="template.id"
              class="menu-item"
              type="button"
              role="menuitem"
              @mousedown.prevent
              @click="insertTemplate(template.text)"
            >
              {{ messages.templates[template.id] }}
            </button>
          </template>
        </div>
      </div>
      <span class="muted hint">{{ messages.orType }} <kbd>[</kbd></span>
    </div>

    <div class="area">
      <div ref="mirror" class="mirror" aria-hidden="true">
        <template v-for="(piece, index) in pieces" :key="index">
          <span v-if="piece.type === 'caret'" ref="caretMarker" class="caret-marker" />
          <span v-else-if="piece.type === 'text'">{{ piece.text }}</span>
          <span v-else class="chip" :class="[piece.kind, { invalid: piece.problem !== null }]">{{ piece.before }}<span v-if="piece.hasCaret" ref="caretMarker" class="caret-marker" />{{ piece.after }}</span>
        </template>
      </div>
      <textarea
        ref="field"
        :value="text"
        class="field"
        spellcheck="true"
        :aria-label="label"
        :placeholder="placeholder"
        @input="onInput"
        @keydown="onKeydown"
        @keyup="onKeyup"
        @click="refreshCaret"
        @focus="onFocus"
        @blur="onBlur"
        @scroll="syncScroll"
      />
      <ul v-if="completion !== null && hasFocus" class="completion" role="listbox" :style="{ left: `${completionPosition.left}px`, top: `${completionPosition.top}px` }">
        <li
          v-for="(item, index) in completion.items"
          :key="item.label"
          role="option"
          :aria-selected="index === chosenIndex"
          :class="{ chosen: index === chosenIndex }"
          @mousedown.prevent="accept(index)"
        >
          <span class="item-label">{{ item.label }}</span>
          <span class="item-detail">{{ item.detail }}</span>
        </li>
      </ul>
    </div>
    <p v-if="caretProblem !== null" class="chip-problem" role="status">{{ caretProblem }}</p>
  </div>
</template>

<style scoped>
.tag-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.insert {
  position: relative;
}

.menu {
  position: absolute;
  z-index: 3;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  min-width: 190px;
  padding: 6px 0;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #0b0d12;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
}

.menu-group {
  margin: 6px 12px 2px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7b8597;
}

.menu-item {
  padding: 4px 12px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 14px;
  color: #e6e9ef;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: #0e2a36;
  color: #9eeaff;
}

.hint {
  font-size: 13px;
}

/* The field and the layer behind it share every measure, so that the drawn text stays under the caret. */
.area {
  position: relative;
}

.mirror,
.field {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid transparent;
  font: 14px/1.6 ui-monospace, monospace;
  letter-spacing: normal;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  tab-size: 4;
}

.mirror {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: #e6e9ef;
  pointer-events: none;
}

.field {
  position: relative;
  display: block;
  min-height: 160px;
  border-color: #2c3442;
  border-radius: 6px;
  background: transparent;
  color: transparent;
  caret-color: #e6e9ef;
  resize: vertical;
}

.field::placeholder {
  color: #7b8597;
}

.field:focus {
  outline: none;
  border-color: #9eeaff;
}

.field::selection {
  background: rgb(158 234 255 / 0.3);
}

/* Chips are drawn without changing the width of a single character. */
.chip {
  border-radius: 4px;
  box-shadow: 0 0 0 1px currentcolor;
}

.chip.stage {
  background: rgb(94 234 212 / 0.14);
  color: #5eead4;
}

.chip.character {
  background: rgb(196 181 253 / 0.16);
  color: #c4b5fd;
}

.chip.control {
  background: rgb(251 191 36 / 0.14);
  color: #fbbf24;
}

.chip.pause {
  background: rgb(147 197 253 / 0.14);
  color: #93c5fd;
}

.chip.invalid {
  background: rgb(242 139 130 / 0.2);
  color: #f28b82;
  text-decoration: underline wavy;
}

.caret-marker {
  display: inline-block;
  width: 0;
  height: 1em;
}

.completion {
  position: absolute;
  z-index: 3;
  min-width: 200px;
  max-width: 320px;
  margin: 0;
  padding: 4px 0;
  border: 1px solid #2c3442;
  border-radius: 6px;
  background: #0b0d12;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
  list-style: none;
}

.completion li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 10px;
  font-size: 14px;
  cursor: pointer;
}

.completion li.chosen {
  background: #0e2a36;
  color: #9eeaff;
}

.item-detail {
  color: #7b8597;
  font-size: 12px;
}

.chip-problem {
  margin: 0;
  font-size: 13px;
  color: #f28b82;
}

kbd {
  font: 12px/1 ui-monospace, monospace;
}
</style>
