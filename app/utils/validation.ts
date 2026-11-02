import type { Note, Todo } from '~/types/notes'

export const TITLE_MAX_LENGTH = 120
export const TODO_TEXT_MAX_LENGTH = 200
export const HOME_TODO_LIMIT = 3

export type FieldError = 'required' | 'too-long'

export type NoteValidation = {
  valid: boolean
  title: FieldError | null
  todos: Record<string, FieldError>
}

export function normalizeTitle(value: string): string {
  return value.trim()
}

export function normalizeTodoText(value: string): string {
  return value.trim()
}

export function validateNote(note: Pick<Note, 'title' | 'todos'>): NoteValidation {
  const title = getTextError(normalizeTitle(note.title), TITLE_MAX_LENGTH)
  const todos: Record<string, FieldError> = {}

  for (const todo of note.todos) {
    const error = getTextError(normalizeTodoText(todo.text), TODO_TEXT_MAX_LENGTH)

    if (error) {
      todos[todo.id] = error
    }
  }

  return {
    valid: title === null && Object.keys(todos).length === 0,
    title,
    todos
  }
}

export function truncateTodos(todos: readonly Todo[], limit = HOME_TODO_LIMIT): Todo[] {
  if (limit <= 0) {
    return []
  }

  return todos.slice(0, limit)
}

function getTextError(value: string, maxLength: number): FieldError | null {
  if (!value) {
    return 'required'
  }

  if (Array.from(value).length > maxLength) {
    return 'too-long'
  }

  return null
}
