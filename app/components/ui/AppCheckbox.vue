<script setup lang="ts">
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    disabled?: boolean
  }>(),
  {
    disabled: false
  }
)

const model = defineModel<boolean>({ default: false })
const inputId = `checkbox-${useId()}`
</script>

<template>
  <label
    :for="inputId"
    class="app-checkbox"
    :class="{ 'app-checkbox--disabled': props.disabled }"
  >
    <input
      :id="inputId"
      v-model="model"
      type="checkbox"
      class="app-checkbox__input"
      :disabled="props.disabled"
    />

    <span class="app-checkbox__box" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <span class="app-checkbox__label">{{ label }}</span>
  </label>
</template>

<style scoped lang="scss">
.app-checkbox {
  position: relative;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text);
  cursor: pointer;

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &__input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
  }

  &__box {
    display: inline-flex;
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-surface);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);

    svg {
      width: 14px;
      height: 14px;
      opacity: 0;
      transform: scale(0.8);
      transition:
        opacity var(--transition-fast),
        transform var(--transition-fast);
    }
  }

  &__input:checked + &__box {
    border-color: var(--color-primary);
    background: var(--color-primary);

    svg {
      opacity: 1;
      transform: scale(1);
    }
  }

  &__input:focus-visible + &__box {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}
</style>
