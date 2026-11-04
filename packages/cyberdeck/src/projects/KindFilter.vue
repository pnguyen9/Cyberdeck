<script setup lang="ts" generic="Kind extends string">
/** Buttons showing every kind of a list, or one alone: the storyboard's view switch, for kinds. */
defineProps<{ kinds: readonly { kind: Kind; label: string }[]; shown: Kind | 'all'; allLabel: string; label?: string }>()
const emit = defineEmits<{ show: [kind: Kind | 'all'] }>()
</script>

<template>
  <div class="kind-filter" role="group" :aria-label="label">
    <button class="button small" :class="{ primary: shown === 'all' }" :aria-pressed="shown === 'all'" @click="emit('show', 'all')">{{ allLabel }}</button>
    <button
      v-for="entry in kinds"
      :key="entry.kind"
      class="button small"
      :class="{ primary: shown === entry.kind }"
      :aria-pressed="shown === entry.kind"
      @click="emit('show', entry.kind)"
    >
      {{ entry.label }}
    </button>
  </div>
</template>

<style scoped>
.kind-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
