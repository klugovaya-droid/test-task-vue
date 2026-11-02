import { describe, expect, it } from 'vitest'
import {
  HOME_TODO_LIMIT,
  TITLE_MAX_LENGTH,
  TODO_TEXT_MAX_LENGTH,
  normalizeTitle,
  normalizeTodoText,
  truncateTodos,
  validateNote
} from '~/utils/validation'
import type { Todo } from '~/types/notes'

const todos: Todo[] = [
  { id: 'todo-1', text: 'Первая', done: false },
  { id: 'todo-2', text: 'Вторая', done: true },
  { id: 'todo-3', text: 'Третья', done: false },
  { id: 'todo-4', text: 'Четвёртая', done: false }
]

describe('normalizeTitle', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTitle('  Заметка  ')).toBe('Заметка')
  })
})

describe('normalizeTodoText', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTodoText('\t Задача \n')).toBe('Задача')
  })
})

describe('truncateTodos', () => {
  it('returns the first three todos by default', () => {
    expect(truncateTodos(todos)).toEqual(todos.slice(0, HOME_TODO_LIMIT))
  })

  it('supports a custom limit', () => {
    expect(truncateTodos(todos, 2)).toEqual(todos.slice(0, 2))
  })

  it('does not mutate the source array', () => {
    const source = [...todos]

    truncateTodos(source, 1)

    expect(source).toEqual(todos)
  })

  it('returns an empty array for a non-positive limit', () => {
    expect(truncateTodos(todos, 0)).toEqual([])
    expect(truncateTodos(todos, -1)).toEqual([])
  })
})

describe('validateNote', () => {
  it('accepts a note with empty todos', () => {
    expect(validateNote({ title: '  Заметка  ', todos: [] })).toEqual({
      valid: true,
      title: null,
      todos: {}
    })
  })

  it('requires a non-empty title', () => {
    const result = validateNote({ title: '   ', todos: [] })

    expect(result.valid).toBe(false)
    expect(result.title).toBe('required')
  })

  it('rejects a title longer than the limit', () => {
    const result = validateNote({
      title: 'a'.repeat(TITLE_MAX_LENGTH + 1),
      todos: []
    })

    expect(result.valid).toBe(false)
    expect(result.title).toBe('too-long')
  })

  it('reports empty and oversized todos separately', () => {
    const result = validateNote({
      title: 'Заметка',
      todos: [
        { id: 'empty', text: '   ', done: false },
        { id: 'long', text: 'a'.repeat(TODO_TEXT_MAX_LENGTH + 1), done: false }
      ]
    })

    expect(result.valid).toBe(false)
    expect(result.title).toBeNull()
    expect(result.todos).toEqual({
      empty: 'required',
      long: 'too-long'
    })
  })

  it('does not report valid todos', () => {
    const result = validateNote({
      title: 'Заметка',
      todos: [{ id: 'todo-1', text: 'Задача', done: false }]
    })

    expect(result.valid).toBe(true)
    expect(result.todos).toEqual({})
  })
})
