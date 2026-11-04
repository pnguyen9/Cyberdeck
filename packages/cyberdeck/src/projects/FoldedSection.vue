<script setup lang="ts">
/** A section folded until opened, its title saying how many entries it holds and how many lack a file. */
defineProps<{ title: string; count: number; open: boolean; missingText?: string | null }>()
const emit = defineEmits<{ toggle: [isOpen: boolean] }>()
</script>

<template>
  <details :open="open" @toggle="emit('toggle', ($event.target as HTMLDetailsElement).open)">
    <summary class="section-title">{{ title }} · {{ count }}<span v-if="missingText" class="missing-count"> · {{ missingText }}</span></summary>
    <slot />
  </details>
</template>

<style scoped>
summary.section-title {
  cursor: pointer;
}

.missing-count {
  color: #f6c177;
}
</style>
