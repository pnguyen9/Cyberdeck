<script setup lang="ts">
import { computed } from 'vue'
import { GAUGE_PLACES, type GaugeColor, type ShownGauge } from '@cyberdeck/core'
import { useMessages } from '../i18n/locale'
import { playerMessages } from '../i18n/playerMessages'

/**
 * Counters shown as bars, `[gauge]`, in the corners of the stage: each bar slides to what its counter
 * holds as the story changes it, at once for players who ask for less motion. Without a colour of its
 * own, a bar goes from green to gold to red as it empties, as health does.
 */
const props = defineProps<{ gauges: readonly ShownGauge[]; lessMotion: boolean }>()

const COLORS: Readonly<Record<GaugeColor, string>> = {
  green: '#5fd97a',
  blue: '#6cb8ff',
  red: '#ff6b6b',
  gold: '#f2c94c',
  purple: '#b48cff',
  pink: '#ff8cc6',
}

function colorOf(gauge: ShownGauge): string {
  if (gauge.color !== null) {
    return COLORS[gauge.color]
  }
  return gauge.share > 0.5 ? COLORS.green : gauge.share > 0.2 ? COLORS.gold : COLORS.red
}

const text = useMessages(playerMessages)

const corners = computed(() => GAUGE_PLACES
  .map(place => ({ place, gauges: props.gauges.filter(gauge => gauge.place === place) }))
  .filter(corner => corner.gauges.length > 0))
</script>

<template>
  <div class="gauges" :class="{ 'less-motion': lessMotion }">
    <div v-for="corner in corners" :key="corner.place" class="corner" :class="corner.place.replace(' ', '-')">
      <div
        v-for="gauge in corner.gauges"
        :key="gauge.counterId"
        class="gauge"
        role="meter"
        :aria-label="gauge.label"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(gauge.share * 100)"
        :aria-valuetext="gauge.numbers === null ? `${Math.round(gauge.share * 100)}%` : text.gaugeNumbers(gauge.numbers.held, gauge.numbers.maximum)"
      >
        <div class="heading">
          <span class="label">{{ gauge.label }}</span>
          <span v-if="gauge.numbers !== null" class="numbers">{{ gauge.numbers.held }} / {{ gauge.numbers.maximum }}</span>
        </div>
        <div class="track">
          <div class="fill" :style="{ transform: `scaleX(${gauge.share})`, background: colorOf(gauge) }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauges {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 460px;
}

.top-left {
  top: 36px;
  left: 48px;
}

.top-right {
  top: 36px;
  right: 48px;
}

/* Above the row of buttons over the text box, which rises with a larger text. */
.bottom-left {
  bottom: calc(var(--quick-menu-bottom, 310px) + 64px);
  left: 48px;
}

.bottom-right {
  bottom: calc(var(--quick-menu-bottom, 310px) + 64px);
  right: 48px;
}

.gauge {
  padding: 14px 20px 18px;
  border-radius: 16px;
  background: rgb(10 12 20 / 0.78);
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
  color: #f2f4f8;
  font-family: Georgia, 'Times New Roman', serif;
}

.heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 10px;
  font-size: calc(30px * var(--text-scale, 1));
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.numbers {
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.track {
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.14);
}

.fill {
  height: 100%;
  transform-origin: left;
  transition: transform 0.6s ease-out, background-color 0.6s;
}

.less-motion .fill {
  transition: none;
}
</style>
