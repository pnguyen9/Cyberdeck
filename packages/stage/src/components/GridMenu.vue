<script setup lang="ts">
import type { StageCatalog, StoredGrid } from '@cyberdeck/core'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import StagePicture from './StagePicture.vue'
import { marksTile, MOUSE_BUTTON, type Bindings } from '../input/bindings'

/**
 * A choice shown as rows of picture buttons: each place shows the picture its list names, or the
 * value itself without one. The arrows move from tile to tile, Enter or Space picks; the story's
 * own keys wait while the grid has the focus.
 */
/**
 * `start`: the tile focused first, the one picked last, so that the keyboard goes on from there.
 * `bindings`: the player's, whose *Mark a tile* inputs mark on a grid that marks.
 */
const props = defineProps<{ grid: StoredGrid; items: readonly string[]; catalog: StageCatalog; start: number; bindings: Bindings }>()
const emit = defineEmits<{ pick: [number: number]; mark: [number: number] }>()
/**
 * A grid that marks too, `marking Flag`: the player's *Mark a tile* inputs, F and a right click unless
 * changed, mark a tile rather than pick it. Elsewhere, and on other grids, they do what they always do.
 */
const canMark = computed(() => props.grid.markCounterId !== undefined)
const marksWithKey = (code: string) => canMark.value && marksTile(props.bindings, { type: 'key', code })
const marksWithButton = (button: number) => canMark.value && button !== MOUSE_BUTTON.main && marksTile(props.bindings, { type: 'mouseButton', button })

/** A mouse button that marks, on a tile: the player's own use of it waits. */
function onTileButton(event: MouseEvent, number: number | null) {
  if (!marksWithButton(event.button)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  // The right button marks with its menu event, the others as they are let go of.
  if (number !== null && event.type === (event.button === MOUSE_BUTTON.secondary ? 'contextmenu' : 'mouseup')) {
    emit('mark', number)
  }
}

/** The area the grid may take on the stage: above the menu, which stands 310 pixels over the bottom. */
const AREA = { width: 1600, height: 660 }
const GAP = 6
const tileSize = computed(() => Math.floor(Math.min((AREA.width - GAP * (props.grid.columns - 1)) / props.grid.columns, (AREA.height - GAP * (props.grid.rows - 1)) / props.grid.rows)))
const tiles = computed(() => props.items.map((item, index) => ({
  number: index + 1,
  item,
  url: props.grid.characterId === null || item === '' ? null : props.catalog.expressionUrlByName(props.grid.characterId, item),
})))

const focused = ref(1)
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')
function focusTile(number: number) {
  focused.value = Math.min(Math.max(number, 1), props.items.length)
  void nextTick(() => buttons.value?.[focused.value - 1]?.focus())
}
onMounted(() => focusTile(props.start))

function onKeydown(event: KeyboardEvent) {
  const columns = props.grid.columns
  const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }
  if (event.key in moves) {
    focusTile(focused.value + moves[event.key]!)
  } else if (event.key === 'Enter' || event.key === ' ') {
    emit('pick', focused.value)
  } else if (marksWithKey(event.code)) {
    emit('mark', focused.value)
  } else if (event.key !== 'Escape') {
    return
  }
  event.preventDefault()
  if (event.key !== 'Escape') {
    event.stopPropagation()
  }
}
</script>

<template>
  <div
    class="grid-menu"
    role="grid"
    :style="{ gridTemplateColumns: `repeat(${grid.columns}, ${tileSize}px)`, gap: `${GAP}px` }"
    @click.stop
    @keydown="onKeydown"
  >
    <button
      v-for="tile in tiles"
      :key="tile.number"
      ref="buttons"
      class="tile"
      role="gridcell"
      :tabindex="tile.number === focused ? 0 : -1"
      :aria-label="tile.item === '' ? String(tile.number) : `${tile.number}: ${tile.item}`"
      :style="{ width: `${tileSize}px`, height: `${tileSize}px`, fontSize: `${Math.max(10, Math.floor(tileSize / 3))}px` }"
      @focus="focused = tile.number"
      @click="emit('pick', tile.number)"
      @mousedown="onTileButton($event, null)"
      @mouseup="onTileButton($event, tile.number)"
      @contextmenu="onTileButton($event, tile.number)"
    >
      <StagePicture v-if="tile.url !== null" class="picture" :url="tile.url" alt="" />
      <span v-else-if="tile.item !== ''" class="value">{{ tile.item }}</span>
    </button>
  </div>
</template>

<style scoped>
.grid-menu {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
}

.tile {
  display: grid;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: 2px solid rgb(120 220 255 / 0.35);
  border-radius: 8px;
  background: rgb(8 10 16 / 0.75);
  color: #f2f4f8;
  font-family: system-ui, sans-serif;
  cursor: pointer;
}

.tile:hover,
.tile:focus-visible {
  outline: none;
  border-color: #9eeaff;
  box-shadow: 0 0 18px rgb(0 200 255 / 0.35);
}

.picture {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
