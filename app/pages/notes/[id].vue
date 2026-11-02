<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TodoItem from '~/components/notes/TodoItem.vue'
import AppButton from '~/components/ui/AppButton.vue'
import AppInput from '~/components/ui/AppInput.vue'
import BaseModal from '~/components/ui/BaseModal.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import { useEditorStore } from '~/stores/editor'
import { useNotesStore } from '~/stores/notes'
import { useToastStore } from '~/stores/toast'
import {
  hasOpenModal,
  isEditableTarget,
  isRedoShortcut,
  isUndoShortcut
} from '~/utils/keyboard'
import {
  TITLE_MAX_LENGTH,
  TODO_TEXT_MAX_LENGTH,
  validateNote,
  type FieldError
} from '~/utils/validation'

const route = useRoute()
const router = useRouter()
const editor = useEditorStore()
const notesStore = useNotesStore()
const toast = useToastStore()

const titleTouched = ref(false)
const newTodoText = ref('')
const newTodoError = ref<string | null>(null)
const cancelDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const recoveryOpen = ref(false)

const noteId = computed(() => {
  const value = route.params.id

  if (Array.isArray(value)) {
    return value[0] ?? ''
  }

  return value ?? ''
})

const validation = computed(() => (editor.note ? validateNote(editor.note) : null))
const canSave = computed(
  () =>
    Boolean(editor.note) &&
    Boolean(validation.value?.valid) &&
    editor.dirty &&
    !editor.externalDeleted
)
const titleError = computed(() =>
  titleTouched.value ? titleErrorMessage(validation.value?.title) : null
)
const statusLabel = computed(() => {
  if (editor.dirty) {
    return 'Не сохранено'
  }

  return editor.isNew ? 'Новая заметка' : 'Все изменения сохранены'
})
const deleteMessage = computed(() =>
  editor.note
    ? `«${editor.note.title}» будет удалена без возможности восстановления.`
    : ''
)
const recoveryDescription = computed(() => {
  const draft = editor.pendingDraft

  if (!draft) {
    return ''
  }

  const savedAt = new Date(draft.savedAt)
  const formatted = Number.isNaN(savedAt.getTime())
    ? ''
    : savedAt.toLocaleString('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'short'
      })

  return formatted
    ? `Найден черновик от ${formatted}. Восстановить изменения?`
    : 'Найден несохранённый черновик. Восстановить изменения?'
})

watch(
  noteId,
  (id) => {
    titleTouched.value = false
    newTodoText.value = ''
    newTodoError.value = null
    cancelDialogOpen.value = false
    deleteDialogOpen.value = false
    editor.init(id)
    recoveryOpen.value = Boolean(editor.pendingDraft)
  },
  { immediate: true }
)

watch(
  () => notesStore.notes,
  () => {
    editor.checkExternalDeleted()
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleHistoryShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleHistoryShortcut)
})

function handleHistoryShortcut(event: KeyboardEvent): void {
  if (!editor.note || event.defaultPrevented) {
    return
  }

  const undo = isUndoShortcut(event)
  const redo = isRedoShortcut(event)

  if (!undo && !redo) {
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  event.preventDefault()

  if (hasOpenModal()) {
    return
  }

  if (redo) {
    editor.redo()
    return
  }

  editor.undo()
}

function handleUndo(): void {
  editor.undo()
}

function handleRedo(): void {
  editor.redo()
}

function handleTitleUpdate(value: string): void {
  titleTouched.value = true
  editor.setTitle(value)
}

function handleTitleCommit(): void {
  titleTouched.value = true
  editor.commitTextEdit()
}

function handleNewTodoInput(value: string): void {
  newTodoText.value = value

  if (newTodoError.value && value.trim()) {
    newTodoError.value = null
  }
}

function handleAddTodo(): void {
  const text = newTodoText.value.trim()

  if (!text) {
    newTodoError.value = 'Введите текст задачи'
    return
  }

  if (!editor.addTodo(text)) {
    newTodoError.value = 'Введите текст задачи'
    return
  }

  newTodoText.value = ''
  newTodoError.value = null
}

function handleSave(): void {
  titleTouched.value = true

  if (!editor.note) {
    return
  }

  if (editor.externalDeleted) {
    toast.show('Заметка удалена в другой вкладке. Сохраните её как новую.', 'error')
    return
  }

  if (!editor.dirty) {
    return
  }

  if (!validation.value?.valid) {
    toast.show('Проверьте название и задачи.', 'error')
    return
  }

  const wasNew = editor.isNew
  const result = editor.save()

  if (!result.ok) {
    toast.show(
      result.reason === 'invalid'
        ? 'Проверьте название и задачи.'
        : 'Не удалось сохранить заметку.',
      'error'
    )
    return
  }

  toast.show('Заметка сохранена.')

  if (wasNew) {
    void router.replace(`/notes/${result.note.id}`)
  }
}

function handleBack(): void {
  if (editor.dirty) {
    cancelDialogOpen.value = true
    return
  }

  void router.push('/')
}

function confirmCancel(): void {
  cancelDialogOpen.value = false
  editor.cancel()
  void router.push('/')
}

function confirmDelete(): void {
  const title = editor.note?.title
  deleteDialogOpen.value = false
  editor.deleteNote()
  toast.show(title ? `Заметка «${title}» удалена.` : 'Заметка удалена.')
  void router.push('/')
}

function handleSaveAsNew(): void {
  titleTouched.value = true

  if (!validation.value?.valid) {
    toast.show('Проверьте название и задачи.', 'error')
    return
  }

  const result = editor.saveAsNew()

  if (!result.ok) {
    toast.show(
      result.reason === 'invalid'
        ? 'Проверьте название и задачи.'
        : 'Не удалось сохранить заметку.',
      'error'
    )
    return
  }

  toast.show('Заметка сохранена как новая.')
  void router.replace(`/notes/${result.note.id}`)
}

function leaveAfterExternalDelete(): void {
  editor.cancel()
  void router.push('/')
}

function restorePendingDraft(): void {
  if (!editor.pendingDraft) {
    recoveryOpen.value = false
    return
  }

  if (editor.restoreDraft()) {
    recoveryOpen.value = false
    toast.show('Черновик восстановлен.')
  }
}

function discardPendingDraft(): void {
  const removed = editor.discardDraft()

  recoveryOpen.value = false

  if (!removed) {
    toast.show('Не удалось удалить черновик.', 'error')
  }
}

function todoError(todoId: string): string | null {
  return todoErrorMessage(validation.value?.todos[todoId])
}

function titleErrorMessage(error: FieldError | null | undefined): string | null {
  if (error === 'required') {
    return 'Введите название'
  }

  if (error === 'too-long') {
    return `Не больше ${TITLE_MAX_LENGTH} символов`
  }

  return null
}

function todoErrorMessage(error: FieldError | null | undefined): string | null {
  if (error === 'required') {
    return 'Введите текст задачи'
  }

  if (error === 'too-long') {
    return `Не больше ${TODO_TEXT_MAX_LENGTH} символов`
  }

  return null
}
</script>

<template>
  <section class="editor-page">
    <EmptyState
      v-if="editor.notFound"
      :heading-level="1"
      title="Заметка не найдена"
      description="Возможно, она была удалена или ссылка неверна."
    >
      <template #action>
        <NuxtLink to="/" class="editor-page__home-link">Вернуться на главную</NuxtLink>
      </template>
    </EmptyState>

    <template v-else-if="editor.note">
      <header class="editor-page__header">
        <div class="editor-page__intro">
          <button type="button" class="editor-page__back" @click="handleBack">
            ← К списку
          </button>

          <h1 class="editor-page__title">
            {{ editor.isNew ? 'Новая заметка' : 'Редактирование заметки' }}
          </h1>

          <p
            class="editor-page__status"
            :class="{ 'editor-page__status--dirty': editor.dirty }"
            aria-live="polite"
          >
            {{ statusLabel }}
          </p>
        </div>

        <div class="editor-page__actions">
          <div class="editor-page__history" role="group" aria-label="История изменений">
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="!editor.canUndo && !editor.hasPendingTextEdit"
              aria-label="Отменить последнее действие"
              title="Отменить последнее действие (Ctrl+Z или Cmd+Z)"
              @click="handleUndo"
            >
              <span aria-hidden="true">↶</span>
            </AppButton>

            <AppButton
              variant="secondary"
              size="sm"
              :disabled="!editor.canRedo || editor.hasPendingTextEdit"
              aria-label="Повторить действие"
              title="Повторить действие (Ctrl+Shift+Z или Cmd+Shift+Z)"
              @click="handleRedo"
            >
              <span aria-hidden="true">↷</span>
            </AppButton>
          </div>

          <AppButton
            v-if="!editor.isNew && !editor.externalDeleted"
            variant="danger"
            @click="deleteDialogOpen = true"
          >
            Удалить
          </AppButton>
          <AppButton variant="secondary" @click="cancelDialogOpen = true">
            Отменить
          </AppButton>
          <AppButton :disabled="!canSave" @click="handleSave">Сохранить</AppButton>
        </div>
      </header>

      <div v-if="editor.externalDeleted" class="editor-page__external" role="alert">
        <div>
          <strong class="editor-page__external-title">Заметка удалена в другой вкладке.</strong>
          <p class="editor-page__external-hint">
            Рабочую копию можно сохранить как новую заметку.
          </p>
        </div>

        <div class="editor-page__external-actions">
          <AppButton variant="secondary" @click="leaveAfterExternalDelete">
            Вернуться на главную
          </AppButton>
          <AppButton @click="handleSaveAsNew">Сохранить как новую</AppButton>
        </div>
      </div>

      <form class="editor-page__form" @submit.prevent="handleSave">
        <AppInput
          label="Название"
          hint="До 120 символов"
          :model-value="editor.note.title"
          :maxlength="TITLE_MAX_LENGTH"
          :error="titleError"
          autocomplete="off"
          @update:model-value="handleTitleUpdate"
          @focus="editor.beginTitleEdit()"
          @blur="handleTitleCommit"
        />

        <section class="editor-page__todos" aria-labelledby="editor-todos-heading">
          <div class="editor-page__todos-header">
            <h2 id="editor-todos-heading" class="editor-page__section-title">Задачи</h2>
            <span class="editor-page__count" aria-label="Количество задач">
              {{ editor.note.todos.length }}
            </span>
          </div>

          <ul v-if="editor.note.todos.length > 0" class="editor-page__todo-list">
            <li v-for="todo in editor.note.todos" :key="todo.id">
              <TodoItem
                :todo="todo"
                :error="todoError(todo.id)"
                @toggle="editor.toggleTodo(todo.id)"
                @begin-edit="editor.beginTodoTextEdit(todo.id)"
                @update-text="editor.setTodoText(todo.id, $event)"
                @commit-edit="editor.commitTextEdit()"
                @remove="editor.removeTodo(todo.id)"
              />
            </li>
          </ul>

          <p v-else class="editor-page__empty">Задач пока нет. Добавьте первую.</p>

          <div class="editor-page__add-todo">
            <AppInput
              label="Новая задача"
              hint="До 200 символов"
              label-hidden
              placeholder="Новая задача"
              :model-value="newTodoText"
              :maxlength="TODO_TEXT_MAX_LENGTH"
              :error="newTodoError"
              autocomplete="off"
              @update:model-value="handleNewTodoInput"
              @keydown.enter.prevent="handleAddTodo"
            />

            <AppButton
              variant="secondary"
              :disabled="!newTodoText.trim()"
              @click="handleAddTodo"
            >
              Добавить
            </AppButton>
          </div>
        </section>
      </form>

      <ConfirmDialog
        :open="cancelDialogOpen"
        title="Отменить изменения?"
        message="Несохранённые изменения будут потеряны."
        confirm-label="Отменить изменения"
        cancel-label="Продолжить редактирование"
        @cancel="cancelDialogOpen = false"
        @confirm="confirmCancel"
      />

      <ConfirmDialog
        :open="deleteDialogOpen"
        title="Удалить заметку?"
        :message="deleteMessage"
        confirm-label="Удалить"
        cancel-label="Отмена"
        @cancel="deleteDialogOpen = false"
        @confirm="confirmDelete"
      />

      <BaseModal
        :open="recoveryOpen"
        title="Восстановить черновик?"
        :description="recoveryDescription"
        role="alertdialog"
        size="sm"
        :close-on-overlay="false"
        :close-on-escape="false"
        :show-close="false"
        @escape="restorePendingDraft"
      >
        <template #footer>
          <AppButton variant="secondary" @click="discardPendingDraft">
            Удалить черновик
          </AppButton>
          <AppButton data-autofocus @click="restorePendingDraft">Восстановить</AppButton>
        </template>
      </BaseModal>
    </template>
  </section>
</template>

<style scoped lang="scss">
.editor-page {
  display: flex;
  max-width: 760px;
  margin: 0 auto;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-5);
  }

  &__intro {
    min-width: 0;
  }

  &__back {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-size: 0.875rem;
    font-weight: 600;

    &:hover {
      color: var(--color-primary-strong);
    }
  }

  &__title {
    margin: var(--space-2) 0 0;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    line-height: 1.05;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    color: var(--color-text-muted);
    font-size: 0.8125rem;

    &::before {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      content: "";
    }

    &--dirty {
      color: var(--color-danger);
      font-weight: 600;
    }
  }

  &__actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__history {
    display: flex;
    gap: var(--space-1);
  }

  &__external {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  &__external-title {
    color: var(--color-danger);
    font-size: 0.9375rem;
  }

  &__external-hint {
    margin: var(--space-1) 0 0;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  &__external-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  &__todos {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  &__todos-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  &__section-title {
    margin: 0;
    font-size: 1.125rem;
  }

  &__count {
    display: inline-flex;
    min-width: 28px;
    min-height: 24px;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-2);
    border-radius: 999px;
    background: var(--color-surface-muted);
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 700;
  }

  &__todo-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__empty {
    margin: 0;
    color: var(--color-text-muted);
  }

  &__add-todo {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);

    :deep(.app-field) {
      min-width: 0;
      flex: 1;
    }
  }

  &__home-link {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    padding: 0 var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--color-primary);
    color: var(--color-surface);
    font-weight: 600;
    text-decoration: none;

    &:hover {
      background: var(--color-primary-strong);
    }
  }
}

@media (max-width: 720px) {
  .editor-page {
    &__header {
      flex-direction: column;
    }

    &__actions {
      width: 100%;

      :deep(.app-button) {
        flex: 1;
      }
    }

    &__form {
      padding: var(--space-4);
    }

    &__external {
      align-items: stretch;
      flex-direction: column;
    }

    &__external-actions {
      :deep(.app-button) {
        flex: 1;
      }
    }

    &__add-todo {
      flex-direction: column;

      :deep(.app-button) {
        width: 100%;
      }
    }
  }
}
</style>
