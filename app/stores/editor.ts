import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { DraftPayload, Note, Todo } from '~/types/notes'
import { useNotesStore } from '~/stores/notes'
import { createId } from '~/utils/ids'
import { CURRENT_SCHEMA_VERSION } from '~/utils/schema'
import {
  DeltaHistory,
  addTodo as addTodoToNote,
  removeTodo as removeTodoFromNote,
  setTitle as setNoteTitle,
  setTodoText as setNoteTodoText,
  toggleTodo as toggleNoteTodo,
  type TextEditField
} from '~/utils/history'
import { normalizeTodoText, validateNote } from '~/utils/validation'
import {
  DRAFT_WRITE_DEBOUNCE_MS,
  hasSameDraftContent,
  readDraft,
  removeDraft,
  writeDraft
} from '~/utils/draft'

export const NEW_NOTE_ID = 'new'

const DRAFT_READ_ERROR_MESSAGE = 'Не удалось прочитать черновик из браузера.'
const DRAFT_WRITE_ERROR_MESSAGE = 'Не удалось сохранить черновик в браузере.'

export type EditorMode = 'create' | 'edit'

export type EditorSaveFailureReason = 'missing' | 'invalid' | 'external-deleted'

export type EditorSaveResult =
  | {
      ok: true
      note: Note
    }
  | {
      ok: false
      reason: EditorSaveFailureReason
    }

type PendingTextEdit = TextEditField & {
  before: string
}

export const useEditorStore = defineStore('editor', () => {
  const notesStore = useNotesStore()

  const note = ref<Note | null>(null)
  const mode = ref<EditorMode>('create')
  const noteId = ref<string | null>(null)
  const dirty = ref(false)
  const notFound = ref(false)
  const externalDeleted = ref(false)
  const pendingDraft = ref<DraftPayload | null>(null)
  const storageError = ref<string | null>(null)
  const canUndo = ref(false)
  const canRedo = ref(false)

  const isNew = computed(() => mode.value === 'create')

  const history = new DeltaHistory()

  let pendingTextEdit: PendingTextEdit | null = null
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function init(targetId: string): void {
    resetSession()
    notesStore.hydrate()

    if (targetId === NEW_NOTE_ID) {
      mode.value = 'create'
      note.value = createBlankNote()
      loadPendingDraft(NEW_NOTE_ID)
      return
    }

    mode.value = 'edit'
    noteId.value = targetId

    const saved = notesStore.getNoteById(targetId)

    if (!saved) {
      notFound.value = true
      return
    }

    note.value = copyNote(saved)
    loadPendingDraft(targetId)
  }

  function beginTitleEdit(): void {
    if (!note.value) {
      return
    }

    beginTextEdit({
      kind: 'title',
      before: note.value.title
    })
  }

  function beginTodoTextEdit(todoId: string): void {
    const todo = findTodo(todoId)

    if (!todo) {
      return
    }

    beginTextEdit({
      kind: 'todo',
      todoId,
      before: todo.text
    })
  }

  function commitTextEdit(): boolean {
    const pending = pendingTextEdit
    pendingTextEdit = null

    if (!pending || !note.value) {
      return false
    }

    if (pending.kind === 'title') {
      const recorded = history.commitTextEdit(note.value.title)
      syncHistoryFlags()
      return recorded
    }

    const todo = findTodo(pending.todoId)

    if (!todo) {
      history.commitTextEdit(pending.before)
      syncHistoryFlags()
      return false
    }

    if (!normalizeTodoText(todo.text)) {
      note.value = setNoteTodoText(note.value, pending.todoId, pending.before)
      history.commitTextEdit(pending.before)
      syncHistoryFlags()
      return false
    }

    const recorded = history.commitTextEdit(todo.text)
    syncHistoryFlags()
    return recorded
  }

  function setTitle(value: string): void {
    if (!note.value || note.value.title === value) {
      return
    }

    note.value = setNoteTitle(note.value, value)
    markChanged()
  }

  function setTodoText(todoId: string, value: string): void {
    const todo = findTodo(todoId)

    if (!note.value || !todo || todo.text === value) {
      return
    }

    note.value = setNoteTodoText(note.value, todoId, value)
    markChanged()
  }

  function addTodo(text: string): Todo | null {
    commitTextEdit()

    if (!note.value) {
      return null
    }

    const normalized = normalizeTodoText(text)

    if (!normalized) {
      return null
    }

    const todo: Todo = {
      id: createId(),
      text: normalized,
      done: false
    }
    const index = note.value.todos.length

    note.value = addTodoToNote(note.value, todo, index)
    history.recordAddTodo(todo, index)
    syncHistoryFlags()
    markChanged()

    return todo
  }

  function removeTodo(todoId: string): boolean {
    commitTextEdit()

    if (!note.value) {
      return false
    }

    const index = note.value.todos.findIndex((todo) => todo.id === todoId)
    const todo = note.value.todos[index]

    if (!todo) {
      return false
    }

    note.value = removeTodoFromNote(note.value, todoId)
    history.recordRemoveTodo(todo, index)
    syncHistoryFlags()
    markChanged()

    return true
  }

  function toggleTodo(todoId: string): boolean {
    commitTextEdit()

    const todo = findTodo(todoId)

    if (!note.value || !todo) {
      return false
    }

    const before = todo.done

    note.value = toggleNoteTodo(note.value, todoId)
    history.recordToggleTodo(todoId, before, !before)
    syncHistoryFlags()
    markChanged()

    return true
  }

  function undo(): boolean {
    if (!note.value) {
      return false
    }

    commitTextEdit()

    const next = history.undo(note.value)

    if (!next) {
      syncHistoryFlags()
      return false
    }

    note.value = next
    syncHistoryFlags()
    markChanged()

    return true
  }

  function redo(): boolean {
    if (!note.value) {
      return false
    }

    commitTextEdit()

    const next = history.redo(note.value)

    if (!next) {
      syncHistoryFlags()
      return false
    }

    note.value = next
    syncHistoryFlags()
    markChanged()

    return true
  }

  function save(now = Date.now()): EditorSaveResult {
    commitTextEdit()

    if (externalDeleted.value) {
      return {
        ok: false,
        reason: 'external-deleted'
      }
    }

    if (!note.value) {
      return {
        ok: false,
        reason: 'missing'
      }
    }

    if (!validateNote(note.value).valid) {
      return {
        ok: false,
        reason: 'invalid'
      }
    }

    const previousDraftId = currentDraftId()
    const saved = notesStore.saveNote(note.value, now)

    clearStoredDraft(previousDraftId)

    if (previousDraftId !== saved.id) {
      clearStoredDraft(saved.id)
    }

    applySavedNote(saved)

    return {
      ok: true,
      note: saved
    }
  }

  function saveAsNew(now = Date.now()): EditorSaveResult {
    commitTextEdit()

    if (!note.value) {
      return {
        ok: false,
        reason: 'missing'
      }
    }

    if (!validateNote(note.value).valid) {
      return {
        ok: false,
        reason: 'invalid'
      }
    }

    const previousDraftId = currentDraftId()
    const created: Note = {
      ...copyNote(note.value),
      id: createId(),
      createdAt: now,
      updatedAt: now
    }
    const saved = notesStore.saveNote(created, now)

    clearStoredDraft(previousDraftId)
    applySavedNote(saved)

    return {
      ok: true,
      note: saved
    }
  }

  function cancel(): void {
    const currentId = currentDraftId()

    clearDraftTimer()
    clearStoredDraft(currentId)
    history.clear()
    pendingTextEdit = null
    pendingDraft.value = null
    dirty.value = false
    externalDeleted.value = false

    if (mode.value === 'edit' && noteId.value) {
      const saved = notesStore.getNoteById(noteId.value)

      note.value = saved ? copyNote(saved) : null
      notFound.value = !saved
    } else {
      note.value = createBlankNote()
    }

    syncHistoryFlags()
  }

  function deleteNote(): boolean {
    const targetId = noteId.value
    const deleted = targetId ? notesStore.deleteNote(targetId) : false

    clearDraftTimer()
    clearStoredDraft(currentDraftId())
    history.clear()
    pendingTextEdit = null
    pendingDraft.value = null
    note.value = null
    noteId.value = null
    mode.value = 'create'
    dirty.value = false
    externalDeleted.value = false
    notFound.value = false
    syncHistoryFlags()

    return deleted
  }

  function restoreDraft(): boolean {
    const draft = pendingDraft.value

    if (!draft) {
      return false
    }

    note.value = copyNote(draft.note)
    pendingDraft.value = null
    dirty.value = true
    history.clear()
    pendingTextEdit = null
    syncHistoryFlags()
    scheduleDraft()

    return true
  }

  function discardDraft(): boolean {
    if (!pendingDraft.value) {
      return false
    }

    const removed = removeDraft(currentDraftId())

    if (!removed) {
      storageError.value = DRAFT_WRITE_ERROR_MESSAGE
    }

    pendingDraft.value = null

    return removed
  }

  function checkExternalDeleted(): boolean {
    if (mode.value !== 'edit' || !noteId.value) {
      externalDeleted.value = false
      return false
    }

    externalDeleted.value = !notesStore.getNoteById(noteId.value)

    return externalDeleted.value
  }

  function flushDraft(): void {
    if (draftTimer === null) {
      return
    }

    clearTimeout(draftTimer)
    draftTimer = null
    persistDraft()
  }

  function beginTextEdit(edit: PendingTextEdit): void {
    if (pendingTextEdit) {
      if (hasSameTextTarget(pendingTextEdit, edit)) {
        return
      }

      commitTextEdit()
    }

    pendingTextEdit = edit
    history.beginTextEdit(toTextEditField(edit), edit.before)
  }

  function loadPendingDraft(draftId: string): void {
    const result = readDraft(draftId)

    if (!result.ok) {
      if (result.reason === 'storage-error') {
        storageError.value = DRAFT_READ_ERROR_MESSAGE
      }

      return
    }

    const draft = result.draft

    if (!draft) {
      return
    }

    const current = note.value

    if (current && hasSameDraftContent(draft.note, current)) {
      clearStoredDraft(draftId)
      return
    }

    pendingDraft.value = draft
  }

  function markChanged(): void {
    dirty.value = true
    scheduleDraft()
  }

  function scheduleDraft(): void {
    if (!note.value) {
      return
    }

    clearDraftTimer()

    draftTimer = setTimeout(() => {
      draftTimer = null
      persistDraft()
    }, DRAFT_WRITE_DEBOUNCE_MS)
  }

  function persistDraft(): void {
    if (!note.value) {
      return
    }

    const draft: DraftPayload = {
      version: CURRENT_SCHEMA_VERSION,
      noteId: currentDraftId(),
      note: copyNote(note.value),
      savedAt: Date.now()
    }

    storageError.value = writeDraft(draft) ? null : DRAFT_WRITE_ERROR_MESSAGE
  }

  function clearDraftTimer(): void {
    if (draftTimer === null) {
      return
    }

    clearTimeout(draftTimer)
    draftTimer = null
  }

  function clearStoredDraft(draftId: string): void {
    if (!removeDraft(draftId)) {
      storageError.value = DRAFT_WRITE_ERROR_MESSAGE
    }
  }

  function applySavedNote(saved: Note): void {
    note.value = copyNote(saved)
    noteId.value = saved.id
    mode.value = 'edit'
    dirty.value = false
    notFound.value = false
    externalDeleted.value = false
    pendingDraft.value = null
    pendingTextEdit = null
    history.clear()
    clearDraftTimer()
    syncHistoryFlags()
  }

  function resetSession(): void {
    clearDraftTimer()
    history.clear()
    pendingTextEdit = null
    note.value = null
    mode.value = 'create'
    noteId.value = null
    dirty.value = false
    notFound.value = false
    externalDeleted.value = false
    pendingDraft.value = null
    storageError.value = null
    syncHistoryFlags()
  }

  function findTodo(todoId: string): Todo | undefined {
    return note.value?.todos.find((todo) => todo.id === todoId)
  }

  function currentDraftId(): string {
    return mode.value === 'create' ? NEW_NOTE_ID : (noteId.value ?? NEW_NOTE_ID)
  }

  function syncHistoryFlags(): void {
    canUndo.value = history.canUndo
    canRedo.value = history.canRedo
  }

  return {
    note,
    mode,
    noteId,
    dirty,
    notFound,
    externalDeleted,
    pendingDraft,
    storageError,
    canUndo,
    canRedo,
    isNew,
    init,
    beginTitleEdit,
    beginTodoTextEdit,
    commitTextEdit,
    setTitle,
    setTodoText,
    addTodo,
    removeTodo,
    toggleTodo,
    undo,
    redo,
    save,
    saveAsNew,
    cancel,
    deleteNote,
    restoreDraft,
    discardDraft,
    checkExternalDeleted,
    flushDraft
  }
})

function createBlankNote(now = Date.now()): Note {
  return {
    id: createId(),
    title: '',
    todos: [],
    createdAt: now,
    updatedAt: now
  }
}

function copyNote(note: Note): Note {
  return {
    ...note,
    todos: note.todos.map((todo) => ({ ...todo }))
  }
}

function toTextEditField(edit: PendingTextEdit): TextEditField {
  return edit.kind === 'title' ? { kind: 'title' } : { kind: 'todo', todoId: edit.todoId }
}

function hasSameTextTarget(left: PendingTextEdit, right: PendingTextEdit): boolean {
  if (left.kind === 'title' || right.kind === 'title') {
    return left.kind === right.kind
  }

  return left.todoId === right.todoId
}
