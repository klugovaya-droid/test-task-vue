<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '~/types/notes'
import AppButton from '~/components/ui/AppButton.vue'
import AppCheckbox from '~/components/ui/AppCheckbox.vue'
import { truncateTodos } from '~/utils/validation'

const props = defineProps<{
  note: Note
}>()

const emit = defineEmits<{
  delete: [note: Note]
}>()

const visibleTodos = computed(() => truncateTodos(props.note.todos))
const hiddenCount = computed(() => Math.max(0, props.note.todos.length - visibleTodos.value.length))
const doneCount = computed(() => props.note.todos.filter((todo) => todo.done).length)
const progressLabel = computed(() =>
  props.note.todos.length === 0
    ? 'Нет задач'
    : `Выполнено ${doneCount.value} из ${props.note.todos.length}`
)
</script>

<template>
  <article class="note-card" :data-note-id="note.id">
    <header class="note-card__header">
      <h2 class="note-card__title">{{ note.title }}</h2>
      <p class="note-card__meta">{{ progressLabel }}</p>
    </header>

    <ul v-if="visibleTodos.length > 0" class="note-card__todos">
      <li v-for="todo in visibleTodos" :key="todo.id" class="note-card__todo">
        <AppCheckbox :model-value="todo.done" :label="todo.text" disabled />
      </li>
    </ul>

    <p v-else class="note-card__empty">Задач пока нет.</p>

    <p v-if="hiddenCount > 0" class="note-card__more">+{{ hiddenCount }} ещё</p>

    <footer class="note-card__footer">
      <NuxtLink
        :to="`/notes/${note.id}`"
        class="note-card__edit"
        :aria-label="`Редактировать заметку ${note.title}`"
      >
        Редактировать
      </NuxtLink>

      <AppButton
        variant="ghost"
        size="sm"
        :aria-label="`Удалить заметку ${note.title}`"
        @click="emit('delete', note)"
      >
        Удалить
      </AppButton>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.note-card {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);

  &__title {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  &__meta {
    margin: var(--space-1) 0 0;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
  }

  &__todos {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__todo {
    min-width: 0;

    :deep(.app-checkbox__label) {
      overflow-wrap: anywhere;
    }
  }

  &__empty,
  &__more {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  &__more {
    font-size: 0.8125rem;
    font-weight: 600;
  }

  &__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: auto;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }

  &__edit {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--color-primary);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      background: var(--color-surface-muted);
    }
  }
}
</style>
