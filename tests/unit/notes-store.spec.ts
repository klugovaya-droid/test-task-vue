import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Note } from '~/types/notes'
import {
  BACKUP_STORAGE_KEY,
  NOTES_STORAGE_KEY,
  parseNotesPayload,
  serializeNotesPayload
} from '~/utils/schema'
import { NOTES_WRITE_DEBOUNCE_MS, useNotesStore } from '~/stores/notes'

const firstNote: Note = {
  id: 'note-1',
  title: 'Первая',
  todos: [{ id: 'todo-1', text: 'Задача', done: false }],
  createdAt: 1_000,
  updatedAt: 1_000
}

const secondNote: Note = {
  id: 'note-2',
  title: 'Вторая',
  todos: [],
  createdAt: 2_000,
  updatedAt: 2_000
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('notes store', () => {
  it('creates notes and sorts them by updatedAt descending', () => {
    const store = useNotesStore()

    const first = store.createNote({ title: '  Первая  ', todos: [] }, 1_000)
    const second = store.createNote({ title: 'Вторая', todos: [] }, 2_000)

    expect(first.title).toBe('Первая')
    expect(store.getNoteById(first.id)?.title).toBe('Первая')
    expect(store.getNoteById('missing')).toBeUndefined()
    expect(store.sortedNotes.map((note) => note.id)).toEqual([second.id, first.id])
  })

  it('drops empty todos and trims todo text', () => {
    const store = useNotesStore()

    const note = store.createNote(
      {
        title: 'Заметка',
        todos: [
          { id: 'empty', text: '   ', done: false },
          { id: 'todo-1', text: '  Задача  ', done: true }
        ]
      },
      1_000
    )

    expect(note.todos).toEqual([{ id: 'todo-1', text: 'Задача', done: true }])
  })

  it('updates an existing note and returns null for an unknown id', () => {
    const store = useNotesStore()
    const note = store.createNote({ title: 'Черновик', todos: [] }, 1_000)

    const updated = store.updateNote(note.id, { title: '  Готово  ', todos: [] }, 2_000)

    expect(updated).toMatchObject({ id: note.id, title: 'Готово', updatedAt: 2_000 })
    expect(store.updateNote('missing', { title: 'Нет', todos: [] })).toBeNull()
  })

  it('hydrates existing notes and does it only once', () => {
    localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([firstNote]))
    const getItem = vi.spyOn(localStorage, 'getItem')
    const store = useNotesStore()

    store.hydrate()
    store.hydrate()

    expect(store.notes).toEqual([firstNote])
    expect(getItem).toHaveBeenCalledTimes(1)
  })

  it('starts empty for corrupt data and keeps a backup', () => {
    const raw = '{"version":1,"notes":['
    localStorage.setItem(NOTES_STORAGE_KEY, raw)
    const store = useNotesStore()

    store.hydrate()

    expect(store.notes).toEqual([])
    expect(store.loadWarning).not.toBeNull()
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe(raw)
  })

  it('starts empty for an unsupported schema version', () => {
    const raw = JSON.stringify({ version: 2, notes: [firstNote] })
    localStorage.setItem(NOTES_STORAGE_KEY, raw)
    const store = useNotesStore()

    store.hydrate()

    expect(store.notes).toEqual([])
    expect(store.loadWarning).not.toBeNull()
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe(raw)
  })

  it('keeps the app usable when reading storage throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('Storage is blocked')
    })
    const store = useNotesStore()

    expect(() => store.hydrate()).not.toThrow()
    expect(store.notes).toEqual([])
    expect(store.storageError).not.toBeNull()
  })

  it('debounces writes into one storage update', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const store = useNotesStore()

    const note = store.createNote({ title: 'Первая', todos: [] }, 1_000)
    store.updateNote(note.id, { title: 'Обновлённая', todos: [] }, 2_000)
    store.createNote({ title: 'Вторая', todos: [] }, 3_000)

    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(NOTES_WRITE_DEBOUNCE_MS - 1)
    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(setItem).toHaveBeenCalledTimes(1)

    const stored = parseNotesPayload(localStorage.getItem(NOTES_STORAGE_KEY))
    expect(stored).toMatchObject({
      ok: true,
      notes: expect.arrayContaining([
        expect.objectContaining({ title: 'Обновлённая' }),
        expect.objectContaining({ title: 'Вторая' })
      ])
    })
  })

  it('flushes pending writes immediately', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const store = useNotesStore()

    store.createNote({ title: 'Заметка', todos: [] }, 1_000)
    store.flush()

    expect(setItem).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(NOTES_WRITE_DEBOUNCE_MS)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('writes deletes immediately and cancels a pending debounce', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const store = useNotesStore()
    const note = store.createNote({ title: 'Заметка', todos: [] }, 1_000)

    expect(store.deleteNote(note.id)).toBe(true)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(store.getNoteById(note.id)).toBeUndefined()

    const stored = parseNotesPayload(localStorage.getItem(NOTES_STORAGE_KEY))
    expect(stored).toMatchObject({ ok: true, notes: [] })

    vi.advanceTimersByTime(NOTES_WRITE_DEBOUNCE_MS)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('returns false when deleting an unknown note', () => {
    const store = useNotesStore()

    expect(store.deleteNote('missing')).toBe(false)
  })

  it('writes explicit saves immediately', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const store = useNotesStore()
    const note = store.createNote({ title: 'Черновик', todos: [] }, 1_000)

    setItem.mockClear()

    const saved = store.saveNote({ ...note, title: '  Сохранено  ' }, 5_000)

    expect(saved.title).toBe('Сохранено')
    expect(saved.updatedAt).toBe(5_000)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(store.notes).toContainEqual(saved)
  })

  it('keeps the app usable when writing storage throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota exceeded')
    })
    const store = useNotesStore()

    expect(() => {
      store.createNote({ title: 'Заметка', todos: [] }, 1_000)
      vi.advanceTimersByTime(NOTES_WRITE_DEBOUNCE_MS)
    }).not.toThrow()

    expect(store.storageError).not.toBeNull()
  })

  it('replaces notes from a storage event', () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const store = useNotesStore()

    store.syncFromStorage(serializeNotesPayload([firstNote, secondNote]))

    expect(store.sortedNotes.map((note) => note.id)).toEqual([secondNote.id, firstNote.id])
    expect(setItem).not.toHaveBeenCalled()
  })

  it('removes a note deleted in another tab', () => {
    localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([firstNote]))
    const store = useNotesStore()
    store.hydrate()

    store.syncFromStorage(serializeNotesPayload([]))

    expect(store.getNoteById(firstNote.id)).toBeUndefined()
    expect(store.notes).toEqual([])
  })

  it('keeps current notes when a storage event contains corrupt data', () => {
    localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([firstNote]))
    const store = useNotesStore()
    store.hydrate()

    store.syncFromStorage('{')

    expect(store.notes).toEqual([firstNote])
    expect(store.loadWarning).not.toBeNull()
  })
})
