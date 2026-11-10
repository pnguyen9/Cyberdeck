<script setup lang="ts">
import type { StageCatalog, StoredGrid } from '@cyberdeck/core'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'

/**
 * A choice shown as rows of picture buttons: each place shows the picture its list names, or the
 * value itself without one. The arrows move from tile to tile, Enter or Space picks; the story's
 * own keys wait while the grid has the focus.
 */
/** `start`: the tile focused first, the one picked last, so that the keyboard goes on from there. */
const props = defineProps<{ grid: StoredGrid; items: readonly string[]; catalog: StageCatalog; start: number }>()
const emit = defineEmits<{ pick: [number: number] }>()

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
    >
      <img v-if="tile.url !== null" :src="tile.url" alt="" draggable="false">
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

.tile img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
