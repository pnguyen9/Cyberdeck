<script setup lang="ts">
import { isStageLocked, journalOf, layOutProgressMap, stateFromSave, type MapNode, type PlayableStory, type ProgressData, type SaveData } from '@cyberdeck/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useLocale, useMessages } from '../i18n/locale'
import { mapMessages } from '../i18n/mapMessages'
import { describeInput, isPlainKeyPress, type InputBinding } from '../input/bindings'
import { useSystemLessMotion } from '../settings/lessMotion'
import { useDialogFocus } from '../useDialogFocus'
import { useScrollEdges } from '../useScrollEdges'

/**
 * `ignoresLocks`: an author testing the story plays from any point, `[no going back]` or not.
 * `everyPath`: the map explored from the story for its author rather than the paths played, whole or
 * in part; its points tell all their values. `switchLabel`: a button to show the other map.
 */
/** `closeInputs`: the player's inputs for the map, which close it as they open it. */
const props = defineProps<{ story: PlayableStory; progress: ProgressData; closeLabel: string; ignoresLocks?: boolean; everyPath?: { isWhole: boolean } | null; switchLabel?: string; closeInputs?: readonly InputBinding[] }>()
const emit = defineEmits<{ play: [save: SaveData]; close: []; switch: [] }>()
const text = useMessages(mapMessages)
/** What a point held of what the journal shows players, as it was then: shown on hovering its card, or with its button. */
function valuesAt(save: SaveData): string | undefined {
  if (props.everyPath != null) {
    // The author sees every value of the point, not only what players are shown.
    const lines = [...Object.entries(save.decisions).map(([name, values]) => `${name}: ${values.join(', ')}`), ...Object.entries(save.counters ?? {}).map(([name, count]) => `${name}: ${count}`)]
    return lines.length === 0 ? undefined : lines.join('\n')
  }
  const entries = journalOf(props.story.project, stateFromSave(props.story, save), props.progress.endingIds).entries
  return entries.length === 0 ? undefined : entries.map(entry => `${entry.name}: ${entry.items.join(', ')}`).join('\n')
}

/** The key of the point whose values are shown over its card, opened by its button, until it is pressed again. */
const valuesShownOf = ref<string | null>(null)
/** The option whose button is pointed at or focused, as `<point key>/<option id>`: its line stands out. */
const highlighted = ref<string | null>(null)

/** Playing from a point reached where the story goes only forward would take the player back: not while that holds. */
function canPlayFrom(save: SaveData): boolean {
  return props.ignoresLocks === true || !isStageLocked({ gameMode: save.stage.game ?? null, noGoingBack: save.stage.locked ?? null }, props.progress.endingIds.length > 0)
}

const CARD_WIDTH = 260
const COLUMN_GAP = 160
/** The gap between rows, at least: it grows when more lines run under a row than it holds. */
const ROW_GAP = 40
/** The straight run a line takes from its point before turning, carrying the option it follows. */
const LABEL_RUN = 100
/** A line going under a point turns down and back up within this much of the gap between columns. */
const TURN = 40
/** Lines running under the same row, apart from one another, and away from the cards above and below. */
const LANE_SPACING = 8
const LANE_MARGIN = 12
/** From the top of a card to its first option: the curves leave from the middle of each option's row. */
const HEADER_HEIGHT = 64
const CARD_PADDING_TOP = 10
const OPTION_HEIGHT = 26
const FOOTER_HEIGHT = 48
const END_HEIGHT = 56
const PADDING = 24

const map = computed(() => layOutProgressMap(props.progress, props.story))

const heightOf = (node: MapNode) => node.type === 'end' ? END_HEIGHT : HEADER_HEIGHT + node.options.length * OPTION_HEIGHT + FOOTER_HEIGHT
const xOf = (column: number) => PADDING + column * (CARD_WIDTH + COLUMN_GAP)

/** Each point's values, worked out once for the map rather than at each drawing. */
const values = computed(() => new Map(map.value.nodes.flatMap(node => node.type === 'point' ? [[node.key, valuesAt(node.point.save)] as const] : [])))

/**
 * The map laid out: where each card stands, and the lines from each option taken to where it led.
 * Where the point branches, a line takes a straight run first, with the option it follows written
 * over it; a line with a point in its way steps down between the rows, runs under it in a lane of
 * its own, and comes back up. The gap between rows grows to hold all the lanes under a row.
 */
const layout = computed(() => {
  const nodes = new Map(map.value.nodes.map(node => [node.key, node]))
  const lanesUnder = new Map<number, number>()
  const lines = map.value.edges.flatMap(edge => {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (from?.type !== 'point' || to === undefined) {
      return []
    }
    const startX = xOf(from.column) + CARD_WIDTH
    const runX = startX + (edge.label === null ? 0 : LABEL_RUN)
    const endX = xOf(to.column)
    const under = endX > runX + 2 * TURN ? edge.under : null
    const lane = under === null ? 0 : lanesUnder.get(under) ?? 0
    if (under !== null) {
      lanesUnder.set(under, lane + 1)
    }
    return [{ edge, from, to, startX, runX, endX, under, lane }]
  })
  const rowGap = Math.max(ROW_GAP, Math.max(0, ...lanesUnder.values()) * LANE_SPACING + 2 * LANE_MARGIN)
  const rowHeight = Math.max(END_HEIGHT, ...map.value.nodes.map(heightOf)) + rowGap
  const cardsHeight = rowHeight - rowGap
  const yOf = (row: number) => PADDING + row * rowHeight
  const curves = lines.map(({ edge, from, to, startX, runX, endX, under, lane }) => {
    const optionIndex = from.options.findIndex(option => option.optionId === edge.optionId)
    const startY = yOf(from.row) + HEADER_HEIGHT + optionIndex * OPTION_HEIGHT + OPTION_HEIGHT / 2
    const endY = yOf(to.row) + (to.type === 'end' ? END_HEIGHT / 2 : HEADER_HEIGHT / 2)
    let path: string
    if (under !== null) {
      // The lanes under a row, centred in the gap below it.
      const laneY = yOf(under + 1) - rowGap / 2 + (lane - ((lanesUnder.get(under) ?? 1) - 1) / 2) * LANE_SPACING
      path = `M ${startX} ${startY} H ${runX} C ${runX + TURN / 2} ${startY}, ${runX + TURN / 2} ${laneY}, ${runX + TURN} ${laneY} H ${endX - TURN} C ${endX - TURN / 2} ${laneY}, ${endX - TURN / 2} ${endY}, ${endX} ${endY}`
    } else {
      const bend = Math.max(40, (endX - runX) / 2)
      path = `M ${startX} ${startY} H ${runX} C ${runX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`
    }
    return {
      key: `${edge.from}/${edge.optionId}/${edge.to}`,
      from: edge.from,
      option: `${edge.from}/${edge.optionId}`,
      path,
      isUnder: under !== null,
      label: edge.label === null ? null : { text: edge.label, x: startX + 6, y: startY - 5 },
    }
  })
  return {
    positions: new Map(map.value.nodes.map(node => [node.key, { x: xOf(node.column), y: yOf(node.row) }])),
    curves,
    rowHeight,
    cardsHeight,
    lastColumnTop: Math.min(...map.value.nodes.filter(node => node.column === map.value.columnCount - 1).map(node => yOf(node.row))),
    width: PADDING * 2 + map.value.columnCount * (CARD_WIDTH + COLUMN_GAP) - COLUMN_GAP,
    // The gap below the last row included, for the lines that run under it.
    height: PADDING * 2 + map.value.rowCount * rowHeight,
  }
})
/** The card that has the keyboard focus: its lines stand out, as an option's do when pointed at. */
const focusedCard = ref<string | null>(null)
const isHighlighted = (curve: { from: string; option: string }) => curve.option === highlighted.value || curve.from === focusedCard.value
/** The lines of the option pointed at, or of the card focused, drawn again over the others. */
const highlightedCurves = computed(() => layout.value.curves.filter(isHighlighted))

/** What a page turn keeps in view of the page before, at least. */
const PAGE_OVERLAP = 64

/**
 * Turning a page, across the columns or down the rows: forward, the last column (or row) wholly in
 * view comes first, so that the reader sees again where each line leads; backward, the first one
 * wholly in view comes last. Columns and rows stand at `PADDING + index * pitch`, each `size` long;
 * a page always moves on by one at least. It moves on by the view less a strip of what it showed at
 * most, as Page Down does: where columns or rows are longer than the view, or apart by more, a page
 * never lands past everything the reader saw.
 */
function pageTurned(scrolled: number, viewSize: number, pitch: number, size: number, direction: 1 | -1): number {
  const furthest = Math.max(1, viewSize - PAGE_OVERLAP)
  const firstWhole = Math.max(0, Math.ceil((scrolled - PADDING - 1) / pitch))
  if (direction === 1) {
    const lastWhole = Math.floor((scrolled + viewSize - PADDING - size + 1) / pitch)
    return Math.min(Math.max(lastWhole, firstWhole + 1) * pitch, scrolled + furthest)
  }
  // The page starts at the first column that leaves the last one wholly in view.
  const fitting = Math.max(0, Math.floor((viewSize - size - PADDING) / pitch))
  return Math.max(Math.max(0, Math.min(firstWhole - fitting, firstWhole - 1)) * pitch, scrolled - furthest)
}

const scroller = useTemplateRef<HTMLElement>('scroller')
const locale = useLocale()
const keysHint = computed(() => ({
  arrows: (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const).map(code => describeInput({ type: 'key', code }, locale.value)),
  ends: (['Home', 'End'] as const).map(code => describeInput({ type: 'key', code }, locale.value)),
}))
const systemLessMotion = useSystemLessMotion()

/** Where there is more map beyond the edges of the view, and how much room the scrollbars take there. */
const mapContent = useTemplateRef<HTMLElement>('mapContent')
const edges = useScrollEdges(scroller, mapContent)
const { scrollbarRight, scrollbarBottom, measure: measureScroll } = edges
const moreAt = { left: edges.moreLeft, right: edges.moreRight, up: edges.moreUp, down: edges.moreDown }
/**
 * Where a page turn is taking the view, while it scrolls smoothly there: a turn following quickly
 * on another goes on from it, not from wherever the scrolling has got to. The player scrolling the
 * map in between (wheel, pointer, arrows) forgets it.
 */
let turning: { left: number; top: number; startedAt: number } | null = null
const TURN_MILLISECONDS = 700
function forgetTurn() {
  turning = null
}

/** Scrolls the map smoothly to a position, as near as the map allows, and tells where the view lands. */
function scrollMapTo(position: { left?: number; top?: number }): { left: number; top: number } | null {
  const element = scroller.value
  if (element === null) {
    return null
  }
  const left = Math.min(Math.max(0, position.left ?? element.scrollLeft), element.scrollWidth - element.clientWidth)
  const top = Math.min(Math.max(0, position.top ?? element.scrollTop), element.scrollHeight - element.clientHeight)
  turning = { left, top, startedAt: performance.now() }
  element.scrollTo({ left, top, behavior: scrollBehavior() })
  return { left, top }
}

const scrollBehavior = () => systemLessMotion.value ? 'auto' : 'smooth'

function turnPage(axis: 'across' | 'down', direction: 1 | -1) {
  const element = scroller.value
  if (element === null) {
    return
  }
  const { left, top } = turning !== null && performance.now() - turning.startedAt < TURN_MILLISECONDS ? turning : { left: element.scrollLeft, top: element.scrollTop }
  const landed = axis === 'across'
    ? scrollMapTo({ left: pageTurned(left, element.clientWidth, CARD_WIDTH + COLUMN_GAP, CARD_WIDTH, direction), top })
    : scrollMapTo({ left, top: pageTurned(top, element.clientHeight, layout.value.rowHeight, layout.value.cardsHeight, direction) })
  if (landed === null) {
    return
  }
  // The focus follows to the first card wholly on the new page, in the column (or row) it starts with; with none, it stays.
  const view = { ...landed, width: element.clientWidth, height: element.clientHeight }
  const whole = map.value.nodes.filter(node => {
    const position = layout.value.positions.get(node.key)
    return position !== undefined && position.x >= view.left && position.x + CARD_WIDTH <= view.left + view.width && position.y >= view.top && position.y + heightOf(node) <= view.top + view.height
  })
  const first = nearest(whole, node => placeOrder(node, axis))
  if (first !== undefined) {
    focusCard(first.key, false)
  }
}

/** A strip at each edge beyond which there is more map. */
const strips = computed(() => {
  const [left, right, up, down] = keysHint.value.arrows
  return ([
    { side: 'left', axis: 'across', direction: -1, arrow: '‹', label: text.value.pageLeft, key: left },
    { side: 'right', axis: 'across', direction: 1, arrow: '›', label: text.value.pageRight, key: right },
    { side: 'up', axis: 'down', direction: -1, arrow: '˄', label: text.value.pageUp, key: up },
    { side: 'down', axis: 'down', direction: 1, arrow: '˅', label: text.value.pageDown, key: down },
  ] as const).filter(strip => moreAt[strip.side].value)
})

const PAGE_KEYS: Readonly<Record<string, readonly ['across' | 'down', 1 | -1]>> = { ArrowRight: ['across', 1], ArrowLeft: ['across', -1], ArrowDown: ['down', 1], ArrowUp: ['down', -1] }

/** The candidate at the least distance, the first of those at the same. */
function nearest(candidates: readonly MapNode[], distance: (node: MapNode) => number): MapNode | undefined {
  let best: MapNode | undefined
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const candidateDistance = distance(candidate)
    if (best === undefined || candidateDistance < bestDistance) {
      best = candidate
      bestDistance = candidateDistance
    }
  }
  return best
}

/** A card's place in reading order: column after column (across), or row after row (down). */
function placeOrder(node: MapNode, axis: 'across' | 'down' = 'across'): number {
  return axis === 'across' ? node.column * map.value.rowCount + node.row : node.row * map.value.columnCount + node.column
}

/**
 * The card an arrow leads to from another: left and right, the nearest card in the column before or
 * after, the closest by height (the higher of two as close); up and down, the next card in the same
 * column. Past the edge of the map, none.
 */
function cardTowards(node: MapNode, arrow: string): MapNode | undefined {
  const nodes = map.value.nodes
  if (arrow === 'ArrowUp' || arrow === 'ArrowDown') {
    const step = arrow === 'ArrowDown' ? 1 : -1
    return nearest(nodes.filter(other => other.column === node.column && (other.row - node.row) * step > 0), other => Math.abs(other.row - node.row))
  }
  const step = arrow === 'ArrowRight' ? 1 : -1
  const ahead = nodes.filter(other => (other.column - node.column) * step > 0)
  const column = nearest(ahead, other => Math.abs(other.column - node.column))?.column
  return nearest(ahead.filter(other => other.column === column), other => 2 * Math.abs(other.row - node.row) + (other.row > node.row ? 1 : 0))
}

/** The card holding the map's one Tab stop: the one last focused, else the one reached last, else the first. */
const chosenCard = ref<string | null>(null)
const firstCard = (nodes: readonly MapNode[]) => nearest(nodes, node => placeOrder(node))
const tabStop = computed(() => {
  const nodes = map.value.nodes
  if (chosenCard.value !== null && nodes.some(node => node.key === chosenCard.value)) {
    return chosenCard.value
  }
  const byPlace = [...nodes].sort((first, second) => placeOrder(first) - placeOrder(second))
  return nearest(byPlace, node => node.type === 'point' ? -Date.parse(node.point.reachedAt) : Infinity)?.key ?? null
})

/** A card's buttons, and the card itself, are reached by Tab on the map's one Tab stop only. */
const tabIndexOf = (node: MapNode) => node.key === tabStop.value ? 0 : -1

const cards = useTemplateRef<HTMLElement[]>('cards')
const cardElement = (key: string | null) => cards.value?.find(card => card.dataset.key === key)

function focusCard(key: string, scrollsIntoView: boolean) {
  const card = cardElement(key)
  card?.focus({ preventScroll: true })
  if (scrollsIntoView) {
    forgetTurn()
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: scrollBehavior() })
  }
}

const playKey = computed(() => describeInput({ type: 'key', code: 'Enter' }, locale.value))
/** A card's name for a screen reader: its chapter and decision, and whether Enter plays from it; an end, its name. */
function cardLabel(node: MapNode): string {
  if (node.type === 'end') {
    return node.endingName ?? text.value.theEnd
  }
  return text.value.pointCard(node.chapterTitle ?? text.value.untitledChapter, node.decisionName, canPlayFrom(node.point.save) ? playKey.value : null)
}

/**
 * The keys of the map, on a card or one of its buttons: arrows go from card to card, Ctrl with an
 * arrow turns a page, Home and End go to the first card and to the first of the last column. On a
 * card, Enter plays from it and Escape closes the map; on a button, Escape goes back to its card.
 */
function onCardKeydown(event: KeyboardEvent, node: MapNode) {
  if (event.altKey || event.shiftKey) {
    return
  }
  const isOnCard = event.target === event.currentTarget
  const isCtrl = event.ctrlKey || event.metaKey
  const turn = PAGE_KEYS[event.code]
  if (turn !== undefined) {
    event.preventDefault()
    if (isCtrl) {
      turnPage(...turn)
    } else {
      const next = cardTowards(node, event.code)
      if (next !== undefined) {
        focusCard(next.key, true)
      }
    }
  } else if ((event.code === 'Home' || event.code === 'End') && !isCtrl) {
    event.preventDefault()
    const target = event.code === 'Home' ? firstCard(map.value.nodes) : nearest(map.value.nodes.filter(other => other.column === map.value.columnCount - 1), other => other.row)
    scrollMapTo(event.code === 'Home' ? { left: 0, top: 0 } : { left: Infinity, top: layout.value.lastColumnTop - PADDING })
    if (target !== undefined) {
      focusCard(target.key, false)
    }
  } else if (event.code === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (isOnCard) {
      emit('close')
    } else {
      focusCard(node.key, false)
    }
  } else if ((event.code === 'Enter' || event.code === 'NumpadEnter') && isOnCard && node.type === 'point' && canPlayFrom(node.point.save)) {
    event.preventDefault()
    // The player that opens in the map's place listens to the window: this Enter is not its own.
    event.stopPropagation()
    emit('play', node.point.save)
  }
}

const screen = useTemplateRef<HTMLElement>('screen')
/**
 * The map opens with the focus on the card reached last, scrolled into view; with no card, on the
 * screen, where Escape closes it.
 */
useDialogFocus(() => {
  const card = cardElement(tabStop.value)
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return card ?? screen.value
})
/** A map drawn only once explored takes the focus then, unless something else has it. */
watch(() => map.value.nodes.length > 0, isDrawn => {
  const isFocusFree = document.activeElement === null || document.activeElement === document.body || document.activeElement === screen.value
  if (isDrawn) {
    void nextTick(() => {
      if (tabStop.value !== null && isFocusFree) {
        focusCard(tabStop.value, false)
      }
      cardElement(tabStop.value)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
})

/** Escape, or the player's key for the map, closes the map from anywhere on it: a header button, its background, an empty map. A card's buttons keep theirs. */
function onScreenKeydown(event: KeyboardEvent) {
  const isMapKey = !event.repeat && isPlainKeyPress(event)
    && (props.closeInputs ?? []).some(input => input.type === 'key' && input.code === event.code)
  if ((event.code === 'Escape' || isMapKey) && !event.defaultPrevented) {
    event.preventDefault()
    emit('close')
  }
}

/** Ctrl (⌘ on a Mac, where the map takes either) with an arrow turns a page: the hint names the one the keyboard has. */
const ctrlName = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
const escapeKey = computed(() => describeInput({ type: 'key', code: 'Escape' }, locale.value))
</script>

<template>
  <div ref="screen" class="map-screen" tabindex="-1" @keydown="onScreenKeydown">
    <header class="map-header">
      <button class="close-button" @click="emit('close')">← {{ closeLabel }} <kbd>{{ escapeKey }}</kbd></button>
      <h1>{{ story.project.name }} <span class="subtitle">{{ everyPath != null ? text.everyPath : text.routesExplored }}</span></h1>
      <p v-if="map.endingsTotal > 0" class="endings">{{ text.endingsReached(map.endingsReached, map.endingsTotal) }}</p>
      <button v-if="switchLabel !== undefined" class="close-button switch-button" @click="emit('switch')">{{ switchLabel }}</button>
      <p v-if="map.nodes.length > 0" id="map-keys" class="keys-hint">
        <kbd v-for="arrow in keysHint.arrows" :key="arrow">{{ arrow }}</kbd> {{ text.fromCardToCard }} ·
        <kbd>{{ ctrlName }}</kbd> + <kbd v-for="arrow in keysHint.arrows" :key="arrow">{{ arrow }}</kbd> {{ text.turnPage }} ·
        <kbd v-for="end in keysHint.ends" :key="end">{{ end }}</kbd> {{ text.startOrLastColumn }}
      </p>
    </header>
    <p v-if="everyPath != null && !everyPath.isWhole" class="partly">{{ text.partly }}</p>

    <p v-if="map.nodes.length === 0" class="empty">{{ text.nothingExplored }}</p>
    <div v-else class="map-area" :style="{ '--scrollbar-right': `${scrollbarRight}px`, '--scrollbar-bottom': `${scrollbarBottom}px` }">
      <div
        ref="scroller"
        class="map-scroll"
        role="region"
        :aria-label="everyPath != null ? text.everyPath : text.routesExplored"
        aria-describedby="map-keys"
        @scroll="measureScroll"
        @wheel.passive="forgetTurn"
        @pointerdown="forgetTurn"
      >
        <div ref="mapContent" class="map" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
          <svg class="curves" :width="layout.width" :height="layout.height" aria-hidden="true">
            <path v-for="curve in layout.curves" :key="curve.key" :d="curve.path" :data-under="curve.isUnder ? '' : undefined" />
            <path v-for="curve in highlightedCurves" :key="`${curve.key}/highlighted`" class="highlighted" :d="curve.path" />
            <template v-for="curve in layout.curves" :key="`${curve.key}/label`">
              <text v-if="curve.label !== null" class="line-label" :class="{ highlighted: isHighlighted(curve) }" :x="curve.label.x" :y="curve.label.y">{{ curve.label.text }}</text>
            </template>
          </svg>
          <section
            v-for="node in map.nodes"
            ref="cards"
            :key="node.key"
            class="node"
            :class="node.type"
            :data-key="node.key"
            role="group"
            :tabindex="tabIndexOf(node)"
            :aria-label="cardLabel(node)"
            :title="values.get(node.key)"
            @focusin="chosenCard = node.key"
            @focus="focusedCard = node.key"
            @blur="focusedCard = null"
            @keydown="onCardKeydown($event, node)"
            :style="{ left: `${layout.positions.get(node.key)?.x}px`, top: `${layout.positions.get(node.key)?.y}px`, width: `${CARD_WIDTH}px`, height: `${heightOf(node)}px` }"
          >
            <template v-if="node.type === 'point'">
              <div class="point-header" :style="{ height: `${HEADER_HEIGHT - CARD_PADDING_TOP}px` }">
                <p class="chapter">{{ node.chapterTitle ?? text.untitledChapter }}</p>
                <h2>{{ node.decisionName }}</h2>
              </div>
              <p v-if="valuesShownOf === node.key" :id="`map-values-${node.key}`" class="values" :style="{ top: `${HEADER_HEIGHT}px` }" @click="valuesShownOf = null">{{ values.get(node.key) }}</p>
              <ul class="options">
                <li
                  v-for="option in node.options"
                  :key="option.optionId"
                  :class="{ untried: !option.isTaken }"
                  @mouseenter="highlighted = `${node.key}/${option.optionId}`"
                  @mouseleave="highlighted = null"
                >
                  <button
                    v-if="option.offeredIn !== null && canPlayFrom(option.offeredIn)"
                    class="option-play"
                    :tabindex="tabIndexOf(node)"
                    :title="text.playOption(option.text)"
                    :aria-label="text.playOption(option.text)"
                    @focus="highlighted = `${node.key}/${option.optionId}`"
                    @blur="highlighted = null"
                    @click="emit('play', option.offeredIn)"
                  >
                    ▶
                  </button>
                  <span v-else>{{ option.isTaken ? '›' : '?' }}</span> {{ option.text }}
                </li>
              </ul>
              <!-- After the options, in the order Tab goes through a card's buttons; drawn in its corner all the same. -->
              <button
                v-if="values.get(node.key) !== undefined"
                class="values-button"
                :tabindex="tabIndexOf(node)"
                :aria-label="text.showValues"
                :aria-expanded="valuesShownOf === node.key"
                :aria-controls="`map-values-${node.key}`"
                @click="valuesShownOf = valuesShownOf === node.key ? null : node.key"
              >
                i
              </button>
              <button v-if="canPlayFrom(node.point.save)" class="play-button" :tabindex="tabIndexOf(node)" @click="emit('play', node.point.save)">{{ text.playFromHere }}</button>
              <p v-else class="forward-only">{{ text.forwardOnly }}</p>
            </template>
            <p v-else class="ending">{{ node.endingName === null ? text.theEnd : `★ ${node.endingName}` }}</p>
          </section>
        </div>
      </div>
      <!-- Pressing a strip leaves the focus on the map, where its keys work: a strip goes once its edge is reached. -->
      <button
        v-for="strip in strips"
        :key="strip.side"
        class="page-strip"
        :class="strip.side"
        :aria-label="strip.label"
        :title="`${strip.label} (${ctrlName} + ${strip.key})`"
        tabindex="-1"
        @mousedown.prevent
        @click="turnPage(strip.axis, strip.direction)"
      >
        {{ strip.arrow }}
      </button>
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
  /* The map keeps the player's colours, whatever the application's look: its scrollbars stay dark. */
  color-scheme: dark;
}

/* Focused only to hear Escape when no card has the focus: nothing to show. */
.map-screen:focus {
  outline: none;
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

.partly {
  margin: 0 32px 8px;
  color: #a3acbb;
  font-size: 15px;
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

.close-button kbd {
  margin-left: 6px;
  font: inherit;
  opacity: 0.6;
}

.empty {
  padding: 24px;
  color: #7b8597;
}

.keys-hint {
  margin: 0 0 0 auto;
  font-size: 14px;
  color: #7b8597;
}

.keys-hint kbd {
  padding: 0 5px;
  border: 1px solid #2c3442;
  border-radius: 4px;
  font: inherit;
  color: #a3acbb;
}

.keys-hint kbd + kbd {
  margin-left: 3px;
}

/* No keyboard to turn pages with on a touch screen: the strips and the scrollbars are there. */
@media (hover: none) and (pointer: coarse) {
  .keys-hint {
    display: none;
  }
}

.map-area {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.map-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.node:focus-visible {
  outline: 2px solid #9eeaff;
  outline-offset: 2px;
}

.page-strip {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: rgb(11 13 18 / 0.75);
  font: 22px/1 system-ui, sans-serif;
  color: #7b8597;
  cursor: pointer;
}

.page-strip:hover {
  background: #0e2a36;
  color: #9eeaff;
}

.page-strip.left,
.page-strip.right {
  top: 0;
  bottom: var(--scrollbar-bottom);
  width: 24px;
}

.page-strip.left {
  left: 0;
  border-right: 1px solid #2c3442;
}

.page-strip.right {
  right: var(--scrollbar-right);
  border-left: 1px solid #2c3442;
}

.page-strip.up,
.page-strip.down {
  right: calc(var(--scrollbar-right) + 24px);
  left: 24px;
  height: 24px;
  /* ˄ and ˅ are drawn smaller than ‹ and ›. */
  font-size: 32px;
  line-height: 1.6;
}

.page-strip.up {
  top: 0;
  border-bottom: 1px solid #2c3442;
}

.page-strip.down {
  bottom: var(--scrollbar-bottom);
  border-top: 1px solid #2c3442;
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

.curves path.highlighted {
  stroke: #9eeaff;
  stroke-width: 3.5;
}

.curves .line-label {
  font-size: 13px;
  fill: #8cc4d4;
  stroke: #0b0d12;
  stroke-width: 3px;
  paint-order: stroke;
}

.curves .line-label.highlighted {
  font-weight: 600;
  fill: #9eeaff;
}

.node {
  position: absolute;
  /* A card brought into view by the keyboard stays clear of the strips at the edges. */
  scroll-margin: 32px;
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

.option-play {
  width: 1.2em;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: #9eeaff;
  cursor: pointer;
}

.option-play:hover,
.option-play:focus-visible {
  color: #fff;
}

.options li.untried {
  color: #7b8597;
}

.options li.untried span {
  color: #7b8597;
}

.forward-only {
  margin: 0;
  font: italic 14px/1.3 system-ui, sans-serif;
  color: #8a94a6;
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

.values-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #3e6f80;
  border-radius: 50%;
  background: #0e2a36;
  font: italic 600 15px/1 Georgia, serif;
  color: #9eeaff;
  cursor: pointer;
}

.values-button:hover,
.values-button:focus-visible,
.values-button[aria-expanded='true'] {
  border-color: #9eeaff;
}

.point-header {
  padding-right: 30px;
}

.values {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  margin: 0;
  padding: 8px 14px;
  overflow: auto;
  border-radius: 0 0 8px 8px;
  background: #0e2a36;
  font-size: 14px;
  white-space: pre-line;
}

.ending {
  margin: 0;
  font-weight: 600;
  text-align: center;
}
</style>
