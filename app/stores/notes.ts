import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Note, Todo } from '~/types/notes'
import { createId } from '~/utils/ids'
import {
  backupCorruptedPayload,
  NOTES_STORAGE_KEY,
  parseNotesPayload,
  serializeNotesPayload
} from '~/utils/schema'
import { normalizeTitle, normalizeTodoText } from '~/utils/validation'

export const NOTES_WRITE_DEBOUNCE_MS = 300

const STORAGE_ERROR_MESSAGE = 'Не удалось сохранить заметки в браузере.'
const CORRUPTED_DATA_MESSAGE = 'Сохранённые заметки повреждены. Открыт пустой список.'
const UNSUPPORTED_VERSION_MESSAGE = 'Версия сохранённых заметок не поддерживается. Открыт пустой список.'

export type NoteInput = {
  title: string
  todos?: readonly Todo[]
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const hydrated = ref(false)
  const storageError = ref<string | null>(null)
  const loadWarning = ref<string | null>(null)

  const sortedNotes = computed(() =>
    [...notes.value].sort((left, right) => right.updatedAt - left.updatedAt)
  )

  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function hydrate(): void {
    if (hydrated.value) {
      return
    }

    hydrated.value = true

    if (typeof localStorage === 'undefined') {
      return
    }

    let raw: string | null

    try {
      raw = localStorage.getItem(NOTES_STORAGE_KEY)
    } catch {
      storageError.value = STORAGE_ERROR_MESSAGE
      return
    }

    const result = parseNotesPayload(raw)

    if (result.ok) {
      notes.value = result.notes
      return
    }

    notes.value = []
    loadWarning.value =
      result.reason === 'unsupported-version' ? UNSUPPORTED_VERSION_MESSAGE : CORRUPTED_DATA_MESSAGE

    if (!backupCorruptedPayload(result.raw)) {
      storageError.value = STORAGE_ERROR_MESSAGE
    }
  }

  function createNote(input: NoteInput, now = Date.now()): Note {
    const note: Note = {
      id: createId(),
      title: normalizeTitle(input.title),
      todos: prepareTodos(input.todos ?? []),
      createdAt: now,
      updatedAt: now
    }

    notes.value = [...notes.value, note]
    schedulePersist()

    return note
  }

  function updateNote(id: string, input: NoteInput, now = Date.now()): Note | null {
    const index = notes.value.findIndex((note) => note.id === id)
    const existing = notes.value[index]

    if (index === -1 || !existing) {
      return null
    }

    const updated: Note = {
      ...existing,
      title: normalizeTitle(input.title),
      todos: prepareTodos(input.todos ?? []),
      updatedAt: now
    }

    notes.value = notes.value.map((note, noteIndex) => (noteIndex === index ? updated : note))
    schedulePersist()

    return updated
  }

  function saveNote(note: Note, now = Date.now()): Note {
    const saved: Note = {
      ...note,
      title: normalizeTitle(note.title),
      todos: prepareTodos(note.todos),
      updatedAt: now
    }

    const index = notes.value.findIndex((item) => item.id === note.id)

    if (index === -1) {
      notes.value = [...notes.value, saved]
    } else {
      notes.value = notes.value.map((item, itemIndex) => (itemIndex === index ? saved : item))
    }

    writeNow()

    return saved
  }

  function deleteNote(id: string): boolean {
    const nextNotes = notes.value.filter((note) => note.id !== id)

    if (nextNotes.length === notes.value.length) {
      return false
    }

    notes.value = nextNotes
    writeNow()

    return true
  }

  function getNoteById(id: string): Note | undefined {
    return notes.value.find((note) => note.id === id)
  }

  function syncFromStorage(raw: string | null): void {
    hydrated.value = true

    if (raw === null) {
      notes.value = []
      loadWarning.value = null
      return
    }

    const result = parseNotesPayload(raw)

    if (!result.ok) {
      loadWarning.value =
        result.reason === 'unsupported-version' ? UNSUPPORTED_VERSION_MESSAGE : CORRUPTED_DATA_MESSAGE

      if (!backupCorruptedPayload(result.raw)) {
        storageError.value = STORAGE_ERROR_MESSAGE
      }

      return
    }

    notes.value = result.notes
    loadWarning.value = null
  }

  function flush(): void {
    if (persistTimer === null) {
      return
    }

    clearPersistTimer()
    writeToStorage()
  }

  function dismissLoadWarning(): void {
    loadWarning.value = null
  }

  function schedulePersist(): void {
    clearPersistTimer()

    persistTimer = setTimeout(() => {
      persistTimer = null
      writeToStorage()
    }, NOTES_WRITE_DEBOUNCE_MS)
  }

  function writeNow(): void {
    clearPersistTimer()
    writeToStorage()
  }

  function writeToStorage(): boolean {
    if (typeof localStorage === 'undefined') {
      return false
    }

    try {
      localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload(notes.value))
      storageError.value = null
      return true
    } catch {
      storageError.value = STORAGE_ERROR_MESSAGE
      return false
    }
  }

  function clearPersistTimer(): void {
    if (persistTimer === null) {
      return
    }

    clearTimeout(persistTimer)
    persistTimer = null
  }

  return {
    notes,
    hydrated,
    storageError,
    loadWarning,
    sortedNotes,
    hydrate,
    createNote,
    updateNote,
    saveNote,
    deleteNote,
    getNoteById,
    syncFromStorage,
    flush,
    dismissLoadWarning
  }
})

function prepareTodos(todos: readonly Todo[]): Todo[] {
  return todos
    .map((todo) => ({
      ...todo,
      text: normalizeTodoText(todo.text)
    }))
    .filter((todo) => todo.text.length > 0)
}
