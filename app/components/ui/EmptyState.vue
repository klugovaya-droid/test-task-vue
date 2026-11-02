<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.empty-state {
  padding: var(--space-8) var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  text-align: center;

  &__title {
    margin: 0;
    font-size: 1.375rem;
  }

  &__description {
    max-width: 38ch;
    margin: var(--space-3) auto 0;
    color: var(--color-text-muted);
  }

  &__action {
    display: flex;
    justify-content: center;
    margin-top: var(--space-5);
  }
}
</style>
