<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Note } from '~/types/notes'
import NoteCard from '~/components/notes/NoteCard.vue'
import AppToast from '~/components/ui/AppToast.vue'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import EmptyState from '~/components/ui/EmptyState.vue'
import { useNotesStore } from '~/stores/notes'

const notesStore = useNotesStore()

notesStore.hydrate()

const notes = computed(() => notesStore.sortedNotes)
const noteToDelete = ref<Note | null>(null)
const toastMessage = ref<string | null>(null)

const deleteMessage = computed(() =>
  noteToDelete.value
    ? `«${noteToDelete.value.title}» будет удалена без возможности восстановления.`
    : ''
)

function openDeleteDialog(note: Note): void {
  noteToDelete.value = note
}

function closeDeleteDialog(): void {
  noteToDelete.value = null
}

function confirmDelete(): void {
  const target = noteToDelete.value

  if (!target) {
    return
  }

  notesStore.deleteNote(target.id)
  noteToDelete.value = null
  toastMessage.value = `Заметка «${target.title}» удалена.`
}
</script>

<template>
  <section class="home">
    <header class="home__header">
      <div>
        <p class="home__eyebrow">Личные заметки</p>
        <h1 class="home__title">Заметки</h1>
        <p class="home__subtitle">Короткие записи и задачи к ним.</p>
      </div>

      <NuxtLink to="/notes/new" class="home__create">Создать заметку</NuxtLink>
    </header>

    <EmptyState
      v-if="notes.length === 0"
      title="Пока нет заметок"
      description="Создайте первую заметку и добавьте к ней задачи."
    >
      <template #action>
        <NuxtLink to="/notes/new" class="home__create">Создать заметку</NuxtLink>
      </template>
    </EmptyState>

    <ul v-else class="home__grid">
      <li v-for="note in notes" :key="note.id" class="home__grid-item">
        <NoteCard :note="note" @delete="openDeleteDialog" />
      </li>
    </ul>

    <ConfirmDialog
      :open="Boolean(noteToDelete)"
      title="Удалить заметку?"
      :message="deleteMessage"
      confirm-label="Удалить"
      cancel-label="Отмена"
      @cancel="closeDeleteDialog"
      @confirm="confirmDelete"
    />

    <AppToast :message="toastMessage" @dismiss="toastMessage = null" />
  </section>
</template>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);

  &__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-5);
  }

  &__eyebrow {
    margin: 0 0 var(--space-2);
    color: var(--color-primary);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title {
    margin: 0;
    font-size: clamp(2rem, 6vw, 3.25rem);
    line-height: 1;
  }

  &__subtitle {
    margin: var(--space-3) 0 0;
    color: var(--color-text-muted);
    font-size: 1.0625rem;
  }

  &__create {
    display: inline-flex;
    min-height: 44px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--color-primary);
    color: var(--color-surface);
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: none;
    transition: background-color var(--transition-fast);

    &:hover {
      background: var(--color-primary-strong);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__grid-item {
    display: flex;
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .home {
    &__header {
      align-items: stretch;
      flex-direction: column;
    }

    &__create {
      width: 100%;
    }
  }
}
</style>
