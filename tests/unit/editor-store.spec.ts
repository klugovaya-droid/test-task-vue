import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { DraftPayload, Note } from '~/types/notes'
import { useNotesStore } from '~/stores/notes'
import { NEW_NOTE_ID, useEditorStore } from '~/stores/editor'
import {
  NOTES_STORAGE_KEY,
  serializeNotesPayload
} from '~/utils/schema'
import { DRAFT_WRITE_DEBOUNCE_MS, draftStorageKey, readDraft, writeDraft } from '~/utils/draft'

const savedNote: Note = {
  id: 'note-1',
  title: 'Сохранённая',
  todos: [{ id: 'todo-1', text: 'Задача', done: false }],
  createdAt: 1_000,
  updatedAt: 2_000
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function openExisting(note: Note = savedNote) {
  localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([note]))
  setActivePinia(createPinia())

  const notes = useNotesStore()
  const editor = useEditorStore()

  editor.init(note.id)

  return { notes, editor }
}

function openNew() {
  setActivePinia(createPinia())

  const notes = useNotesStore()
  const editor = useEditorStore()

  editor.init(NEW_NOTE_ID)

  return { notes, editor }
}

function seedDraft(note: Note, title: string): void {
  localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([note]))
  writeDraft({
    version: 1,
    noteId: note.id,
    note: {
      ...note,
      title
    },
    savedAt: 3_000
  })
}

function requireDraft(noteId: string): DraftPayload {
  const result = readDraft(noteId)

  if (!result.ok || !result.draft) {
    throw new Error('Expected a stored draft')
  }

  return result.draft
}

describe('editor store init', () => {
  it('starts a blank note in create mode', () => {
    const { editor } = openNew()

    expect(editor.mode).toBe('create')
    expect(editor.isNew).toBe(true)
    expect(editor.noteId).toBeNull()
    expect(editor.note?.title).toBe('')
    expect(editor.note?.todos).toEqual([])
    expect(editor.dirty).toBe(false)
  })

  it('loads an existing note into an isolated working copy', () => {
    const { notes, editor } = openExisting()

    expect(editor.mode).toBe('edit')
    expect(editor.isNew).toBe(false)
    expect(editor.note).toEqual(savedNote)
    expect(editor.dirty).toBe(false)

    editor.setTitle('Изменено')

    expect(editor.note?.title).toBe('Изменено')
    expect(editor.dirty).toBe(true)
    expect(notes.getNoteById(savedNote.id)?.title).toBe('Сохранённая')
  })

  it('reports a missing note instead of opening an empty editor', () => {
    setActivePinia(createPinia())

    const editor = useEditorStore()

    editor.init('missing')

    expect(editor.notFound).toBe(true)
    expect(editor.note).toBeNull()
  })
})

describe('editor text edits', () => {
  it('groups one title edit into a single undo step', () => {
    const { editor } = openExisting()

    editor.beginTitleEdit()
    editor.setTitle('Н')
    editor.setTitle('Новая')

    expect(editor.canUndo).toBe(false)
    expect(editor.commitTextEdit()).toBe(true)
    expect(editor.canUndo).toBe(true)

    expect(editor.undo()).toBe(true)
    expect(editor.note?.title).toBe('Сохранённая')
    expect(editor.canRedo).toBe(true)

    expect(editor.redo()).toBe(true)
    expect(editor.note?.title).toBe('Новая')
    expect(editor.canUndo).toBe(true)
    expect(editor.canRedo).toBe(false)
  })

  it('does not create a history entry for an unchanged text', () => {
    const { editor } = openExisting()

    editor.beginTitleEdit()

    expect(editor.commitTextEdit()).toBe(false)
    expect(editor.canUndo).toBe(false)
    expect(editor.dirty).toBe(false)
  })

  it('reverts an empty todo text without recording it', () => {
    const { editor } = openExisting()

    editor.beginTodoTextEdit('todo-1')
    editor.setTodoText('todo-1', '   ')

    expect(editor.note?.todos[0]?.text).toBe('   ')
    expect(editor.commitTextEdit()).toBe(false)
    expect(editor.note?.todos[0]?.text).toBe('Задача')
    expect(editor.canUndo).toBe(false)
    expect(editor.dirty).toBe(true)
  })

  it('exposes a pending text edit for the undo button', () => {
    const { editor } = openExisting()

    expect(editor.hasPendingTextEdit).toBe(false)

    editor.beginTitleEdit()
    expect(editor.hasPendingTextEdit).toBe(false)

    editor.setTitle('Новая')
    expect(editor.hasPendingTextEdit).toBe(true)
    expect(editor.canUndo).toBe(false)

    expect(editor.commitTextEdit()).toBe(true)
    expect(editor.hasPendingTextEdit).toBe(false)
    expect(editor.canUndo).toBe(true)
  })

  it('does not expose an empty todo as a pending undo step', () => {
    const { editor } = openExisting()

    editor.beginTodoTextEdit('todo-1')
    editor.setTodoText('todo-1', '   ')

    expect(editor.hasPendingTextEdit).toBe(false)

    editor.commitTextEdit()

    expect(editor.canUndo).toBe(false)
    expect(editor.note?.todos[0]?.text).toBe('Задача')
  })

  it('commits a pending text edit before undo', () => {
    const { editor } = openExisting()

    editor.beginTitleEdit()
    editor.setTitle('Черновик')

    expect(editor.canUndo).toBe(false)
    expect(editor.undo()).toBe(true)
    expect(editor.note?.title).toBe('Сохранённая')
    expect(editor.canRedo).toBe(true)

    expect(editor.redo()).toBe(true)
    expect(editor.note?.title).toBe('Черновик')
  })
})

describe('editor todo actions', () => {
  it('records add, toggle and remove as atomic undo steps', () => {
    const { editor } = openExisting()

    const added = editor.addTodo('  Новая  ')

    expect(added).toMatchObject({ text: 'Новая', done: false })
    expect(editor.note?.todos.map((todo) => todo.text)).toEqual(['Задача', 'Новая'])
    expect(editor.addTodo('   ')).toBeNull()

    expect(editor.undo()).toBe(true)
    expect(editor.note?.todos).toHaveLength(1)
    expect(editor.redo()).toBe(true)
    expect(editor.note?.todos).toHaveLength(2)

    expect(editor.toggleTodo(added!.id)).toBe(true)
    expect(editor.note?.todos[1]?.done).toBe(true)
    expect(editor.undo()).toBe(true)
    expect(editor.note?.todos[1]?.done).toBe(false)

    expect(editor.removeTodo(added!.id)).toBe(true)
    expect(editor.note?.todos).toHaveLength(1)
    expect(editor.undo()).toBe(true)
    expect(editor.note?.todos[1]?.text).toBe('Новая')
  })

  it('ignores unknown todo ids', () => {
    const { editor } = openExisting()

    expect(editor.toggleTodo('missing')).toBe(false)
    expect(editor.removeTodo('missing')).toBe(false)
    expect(editor.canUndo).toBe(false)
  })
})

describe('editor save, cancel and delete', () => {
  it('saves an edited note, clears history and removes the draft', () => {
    const { notes, editor } = openExisting()

    editor.beginTitleEdit()
    editor.setTitle('  Обновлённая  ')
    editor.beginTodoTextEdit('todo-1')
    editor.setTodoText('todo-1', '  Изменено  ')

    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)
    expect(requireDraft(savedNote.id).note.title).toBe('  Обновлённая  ')

    const result = editor.save(5_000)

    if (!result.ok) {
      throw new Error(`Expected save, got ${result.reason}`)
    }

    expect(result.note.title).toBe('Обновлённая')
    expect(result.note.todos[0]?.text).toBe('Изменено')
    expect(notes.getNoteById(savedNote.id)).toEqual(result.note)
    expect(notes.getNoteById(savedNote.id)?.updatedAt).toBe(5_000)
    expect(editor.note).toEqual(result.note)
    expect(editor.dirty).toBe(false)
    expect(editor.canUndo).toBe(false)
    expect(editor.canRedo).toBe(false)
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })

  it('creates a new note on save and switches to edit mode', () => {
    const { notes, editor } = openNew()

    expect(editor.save(1_000)).toEqual({ ok: false, reason: 'invalid' })

    editor.setTitle('Новая заметка')
    editor.addTodo('Пункт')

    const result = editor.save(1_000)

    if (!result.ok) {
      throw new Error(`Expected save, got ${result.reason}`)
    }

    expect(notes.notes).toHaveLength(1)
    expect(result.note.id).not.toBe(NEW_NOTE_ID)
    expect(editor.mode).toBe('edit')
    expect(editor.noteId).toBe(result.note.id)
    expect(editor.note).toEqual(result.note)
    expect(editor.dirty).toBe(false)
    expect(localStorage.getItem(draftStorageKey(NEW_NOTE_ID))).toBeNull()
  })

  it('cancels edits, restores the saved note and clears the draft', () => {
    const { editor } = openExisting()

    editor.beginTitleEdit()
    editor.setTitle('Изменено')
    editor.commitTextEdit()
    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).not.toBeNull()

    editor.cancel()

    expect(editor.note?.title).toBe('Сохранённая')
    expect(editor.dirty).toBe(false)
    expect(editor.canUndo).toBe(false)
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })

  it('deletes the current note and clears history and draft', () => {
    const { notes, editor } = openExisting()

    editor.beginTitleEdit()
    editor.setTitle('Изменено')
    editor.commitTextEdit()
    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)

    expect(editor.deleteNote()).toBe(true)
    expect(notes.notes).toEqual([])
    expect(editor.note).toBeNull()
    expect(editor.canUndo).toBe(false)
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })
})

describe('editor drafts', () => {
  it('debounces draft writes and keeps the latest content', () => {
    const { editor } = openExisting()
    const setItem = vi.spyOn(localStorage, 'setItem')

    editor.setTitle('А')

    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS - 1)
    expect(setItem).not.toHaveBeenCalled()

    editor.setTitle('АБ')
    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS - 1)
    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(requireDraft(savedNote.id).note.title).toBe('АБ')
  })

  it('flushes a pending draft immediately', () => {
    const { editor } = openExisting()

    editor.setTitle('Черновик')
    editor.flushDraft()

    expect(requireDraft(savedNote.id).note.title).toBe('Черновик')
  })

  it('stores a draft for a new note under the new id key', () => {
    const { editor } = openNew()

    editor.setTitle('Черновик новой')
    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)

    expect(requireDraft(NEW_NOTE_ID).note.title).toBe('Черновик новой')

    setActivePinia(createPinia())

    const reloaded = useEditorStore()
    reloaded.init(NEW_NOTE_ID)

    expect(reloaded.pendingDraft?.note.title).toBe('Черновик новой')
  })

  it('offers a differing draft and restores it on demand', () => {
    seedDraft(savedNote, 'Восстановленная')
    setActivePinia(createPinia())

    const editor = useEditorStore()
    editor.init(savedNote.id)

    expect(editor.pendingDraft?.note.title).toBe('Восстановленная')
    expect(editor.note?.title).toBe('Сохранённая')

    expect(editor.restoreDraft()).toBe(true)
    expect(editor.note?.title).toBe('Восстановленная')
    expect(editor.pendingDraft).toBeNull()
    expect(editor.dirty).toBe(true)
    expect(editor.canUndo).toBe(false)
  })

  it('discards a draft without touching the saved note', () => {
    seedDraft(savedNote, 'Восстановленная')
    setActivePinia(createPinia())

    const editor = useEditorStore()
    editor.init(savedNote.id)

    expect(editor.discardDraft()).toBe(true)
    expect(editor.pendingDraft).toBeNull()
    expect(editor.note?.title).toBe('Сохранённая')
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })

  it('removes a draft that equals the saved note', () => {
    localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([savedNote]))
    writeDraft({
      version: 1,
      noteId: savedNote.id,
      note: {
        ...savedNote,
        updatedAt: 9_999
      },
      savedAt: 3_000
    })
    setActivePinia(createPinia())

    const editor = useEditorStore()
    editor.init(savedNote.id)

    expect(editor.pendingDraft).toBeNull()
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })

  it('ignores a corrupt draft', () => {
    localStorage.setItem(NOTES_STORAGE_KEY, serializeNotesPayload([savedNote]))
    localStorage.setItem(draftStorageKey(savedNote.id), '{')
    setActivePinia(createPinia())

    const editor = useEditorStore()

    expect(() => editor.init(savedNote.id)).not.toThrow()
    expect(editor.pendingDraft).toBeNull()
    expect(editor.note?.title).toBe('Сохранённая')
  })

  it('keeps working when a draft write fails', () => {
    const { editor } = openExisting()
    const setItem = vi.spyOn(localStorage, 'setItem')

    setItem.mockImplementation(() => {
      throw new Error('Quota exceeded')
    })

    editor.setTitle('Без места')

    expect(() => vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)).not.toThrow()
    expect(editor.storageError).not.toBeNull()
    expect(editor.note?.title).toBe('Без места')

    setItem.mockRestore()
  })
})

describe('editor external delete', () => {
  it('flags an external delete and blocks save', () => {
    const { notes, editor } = openExisting()

    notes.syncFromStorage(serializeNotesPayload([]))

    expect(editor.checkExternalDeleted()).toBe(true)
    expect(editor.save()).toEqual({ ok: false, reason: 'external-deleted' })
  })

  it('saves the working copy as a new note after an external delete', () => {
    const { notes, editor } = openExisting()

    editor.setTitle('Восстановленная')
    vi.advanceTimersByTime(DRAFT_WRITE_DEBOUNCE_MS)
    notes.syncFromStorage(serializeNotesPayload([]))
    editor.checkExternalDeleted()

    const result = editor.saveAsNew(5_000)

    if (!result.ok) {
      throw new Error(`Expected save, got ${result.reason}`)
    }

    expect(result.note.id).not.toBe(savedNote.id)
    expect(result.note.title).toBe('Восстановленная')
    expect(notes.getNoteById(savedNote.id)).toBeUndefined()
    expect(notes.getNoteById(result.note.id)?.title).toBe('Восстановленная')
    expect(editor.noteId).toBe(result.note.id)
    expect(editor.externalDeleted).toBe(false)
    expect(editor.dirty).toBe(false)
    expect(localStorage.getItem(draftStorageKey(savedNote.id))).toBeNull()
  })
})
