<script setup lang="ts">
import type { Todo } from '~/types/notes'
import AppButton from '~/components/ui/AppButton.vue'
import AppCheckbox from '~/components/ui/AppCheckbox.vue'
import AppInput from '~/components/ui/AppInput.vue'
import { TODO_TEXT_MAX_LENGTH } from '~/utils/validation'

defineProps<{
  todo: Todo
  error?: string | null
}>()

const emit = defineEmits<{
  toggle: []
  'begin-edit': []
  'update-text': [value: string]
  'commit-edit': []
  remove: []
}>()
</script>

<template>
  <div class="todo-item" :data-todo-id="todo.id">
    <AppCheckbox
      :model-value="todo.done"
      :label="todo.text || 'Задача без текста'"
      label-hidden
      @update:model-value="emit('toggle')"
    />

    <AppInput
      label="Текст задачи"
      label-hidden
      :model-value="todo.text"
      :error="error"
      :maxlength="TODO_TEXT_MAX_LENGTH"
      autocomplete="off"
      @update:model-value="emit('update-text', $event)"
      @focus="emit('begin-edit')"
      @blur="emit('commit-edit')"
    />

    <AppButton
      class="todo-item__remove"
      variant="ghost"
      size="sm"
      :aria-label="`Удалить задачу ${todo.text || 'без текста'}`"
      @click="emit('remove')"
    >
      <span aria-hidden="true">×</span>
    </AppButton>
  </div>
</template>

<style scoped lang="scss">
.todo-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);

  :deep(.app-field) {
    min-width: 0;
    flex: 1;
  }

  &__remove {
    flex: 0 0 auto;
    font-size: 1.25rem;
  }
}
</style>
