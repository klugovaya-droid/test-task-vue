<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button'
  }
)

const classes = computed(() => [
  'app-button',
  `app-button--${props.variant}`,
  `app-button--${props.size}`
])
</script>

<template>
  <button :type="type" :class="classes" v-bind="$attrs">
    <slot />
  </button>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &--sm {
    padding: 0 var(--space-3);
    font-size: 0.875rem;
  }

  &--md {
    padding: 0 var(--space-4);
    font-size: 0.9375rem;
  }

  &--primary {
    background: var(--color-primary);
    color: var(--color-surface);

    &:hover:not(:disabled) {
      background: var(--color-primary-strong);
    }
  }

  &--secondary {
    border-color: var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
    }
  }

  &--danger {
    background: var(--color-danger);
    color: var(--color-surface);

    &:hover:not(:disabled) {
      background: var(--color-danger-strong);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--color-text-muted);

    &:hover:not(:disabled) {
      background: var(--color-surface-muted);
      color: var(--color-text);
    }
  }
}
</style>
