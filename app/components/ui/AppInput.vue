<script setup lang="ts">
import { computed, useId } from 'vue'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<{
    label: string
    error?: string | null
    hint?: string
    labelHidden?: boolean
    type?: string
  }>(),
  {
    error: null,
    hint: '',
    labelHidden: false,
    type: 'text'
  }
)

const model = defineModel<string>({ default: '' })
const uid = useId()
const inputId = computed(() => `field-${uid}`)
const hintId = computed(() => `${inputId.value}-hint`)
const errorId = computed(() => `${inputId.value}-error`)

const describedBy = computed(() => {
  const ids: string[] = []

  if (props.hint) {
    ids.push(hintId.value)
  }

  if (props.error) {
    ids.push(errorId.value)
  }

  return ids.length > 0 ? ids.join(' ') : undefined
})
</script>

<template>
  <div class="app-field" :class="{ 'app-field--invalid': Boolean(error) }">
    <label
      :for="inputId"
      class="app-field__label"
      :class="{ 'app-field__label--hidden': labelHidden }"
    >
      {{ label }}
    </label>

    <input
      v-bind="$attrs"
      :id="inputId"
      v-model="model"
      :type="type"
      class="app-field__input"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
    />

    <p v-if="hint" :id="hintId" class="app-field__hint">
      {{ hint }}
    </p>

    <p v-if="error" :id="errorId" class="app-field__error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.app-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  &__label {
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 600;

    &--hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  &__input {
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:focus-visible {
      border-color: var(--color-focus);
      outline: 2px solid var(--color-focus);
      outline-offset: 1px;
    }
  }

  &--invalid &__input {
    border-color: var(--color-danger);
  }

  &__hint,
  &__error {
    margin: 0;
    font-size: 0.8125rem;
  }

  &__hint {
    color: var(--color-text-muted);
  }

  &__error {
    color: var(--color-danger);
  }
}
</style>
